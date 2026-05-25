/**
 * StegaCrypt - LSB Steganography Engine
 *
 * Hides data in the least significant bits of image pixel channels.
 * Header format (first 80 bits):
 *   - Magic number: 16 bits (0xDEAD)
 *   - Data type:     8 bits (0=text, 1=file, 2=image)
 *   - Encrypted:     8 bits (0 or 1)
 *   - Name length:  16 bits (filename/ext length in bytes)
 *   - Data length:  32 bits (payload length in bytes)
 *   Total: 80 bits header before name + payload
 */

const Stego = (() => {
  const MAGIC = 0xDEAD;
  const HEADER_BITS = 80;
  const TYPE_TEXT = 0;
  const TYPE_FILE = 1;
  const TYPE_IMAGE = 2;
  const BITS_PER_CHANNEL = 1; // LSB

  /**
   * Calculate the maximum number of bytes that can be hidden in an image.
   */
  function capacity(width, height) {
    const totalBits = width * height * 3 * BITS_PER_CHANNEL; // RGB channels
    const availableBits = totalBits - HEADER_BITS;
    return Math.floor(availableBits / 8);
  }

  /**
   * Convert a Uint8Array to a bit array.
   */
  function toBits(bytes) {
    const bits = [];
    for (let i = 0; i < bytes.length; i++) {
      for (let b = 7; b >= 0; b--) {
        bits.push((bytes[i] >> b) & 1);
      }
    }
    return bits;
  }

  /**
   * Convert a bit array back to a Uint8Array.
   */
  function fromBits(bits) {
    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        byte = (byte << 1) | bits[i * 8 + b];
      }
      bytes[i] = byte;
    }
    return bytes;
  }

  /**
   * Build the header as a bit array.
   */
  function buildHeader(dataType, encrypted, nameLength, dataLength) {
    const header = new Uint8Array(10); // 80 bits = 10 bytes
    // Magic (16 bits)
    header[0] = (MAGIC >> 8) & 0xFF;
    header[1] = MAGIC & 0xFF;
    // Data type (8 bits)
    header[2] = dataType;
    // Encrypted (8 bits)
    header[3] = encrypted ? 1 : 0;
    // Name length (16 bits)
    header[4] = (nameLength >> 8) & 0xFF;
    header[5] = nameLength & 0xFF;
    // Data length (32 bits)
    header[6] = (dataLength >> 24) & 0xFF;
    header[7] = (dataLength >> 16) & 0xFF;
    header[8] = (dataLength >> 8) & 0xFF;
    header[9] = dataLength & 0xFF;
    return toBits(header);
  }

  /**
   * Parse the header from a bit array.
   */
  function parseHeader(bits) {
    const headerBytes = fromBits(bits.slice(0, HEADER_BITS));
    const magic = (headerBytes[0] << 8) | headerBytes[1];
    if (magic !== MAGIC) {
      return null; // No hidden data
    }
    return {
      dataType: headerBytes[2],
      encrypted: headerBytes[3] === 1,
      nameLength: (headerBytes[4] << 8) | headerBytes[5],
      dataLength: (headerBytes[6] << 24) | (headerBytes[7] << 16) |
                  (headerBytes[8] << 8) | headerBytes[9],
    };
  }

  /**
   * Load an image from a File/Blob and return its ImageData.
   */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve({
          imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
          width: img.width,
          height: img.height,
          canvas,
          ctx,
        });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Encode data into an image.
   * @param {File} carrierFile - The carrier PNG image
   * @param {Uint8Array} payload - The data to hide
   * @param {number} dataType - TYPE_TEXT, TYPE_FILE, or TYPE_IMAGE
   * @param {string} name - Filename or extension info
   * @param {boolean} encrypted - Whether the payload is encrypted
   * @returns {Promise<Blob>} - The resulting PNG blob
   */
  async function encode(carrierFile, payload, dataType, name, encrypted) {
    const { imageData, width, height, canvas, ctx } = await loadImage(carrierFile);
    const maxBytes = capacity(width, height);

    const nameBytes = new TextEncoder().encode(name);
    const totalPayloadSize = nameBytes.length + payload.length;

    if (totalPayloadSize > maxBytes) {
      throw new Error(
        `Data too large. Carrier can hold ${formatBytes(maxBytes)} but data is ${formatBytes(totalPayloadSize)}.`
      );
    }

    // Build bit stream: header + name + payload
    const headerBits = buildHeader(dataType, encrypted, nameBytes.length, payload.length);
    const nameBits = toBits(nameBytes);
    const dataBits = toBits(payload);
    const allBits = [...headerBits, ...nameBits, ...dataBits];

    // Embed bits into LSB of RGB channels
    const pixels = imageData.data;
    let bitIndex = 0;
    for (let i = 0; i < pixels.length && bitIndex < allBits.length; i++) {
      // Skip alpha channel (every 4th byte)
      if ((i + 1) % 4 === 0) continue;
      pixels[i] = (pixels[i] & 0xFE) | allBits[bitIndex];
      bitIndex++;
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
  }

  /**
   * Decode hidden data from an image.
   * @param {File} encodedFile - The encoded PNG image
   * @returns {Promise<{dataType: number, name: string, data: Uint8Array, encrypted: boolean}|null>}
   */
  async function decode(encodedFile) {
    const { imageData } = await loadImage(encodedFile);
    const pixels = imageData.data;

    // Extract all LSBs from RGB channels
    const bits = [];
    for (let i = 0; i < pixels.length; i++) {
      if ((i + 1) % 4 === 0) continue; // Skip alpha
      bits.push(pixels[i] & 1);
    }

    // Parse header
    const header = parseHeader(bits);
    if (!header) {
      return null;
    }

    // Validate
    if (header.dataType > 2) return null;
    if (header.nameLength > 1024) return null;
    if (header.dataLength < 0) return null;

    const totalBitsNeeded = HEADER_BITS + (header.nameLength + header.dataLength) * 8;
    if (totalBitsNeeded > bits.length) {
      return null;
    }

    // Extract name
    const nameStart = HEADER_BITS;
    const nameEnd = nameStart + header.nameLength * 8;
    const nameBytes = fromBits(bits.slice(nameStart, nameEnd));
    const name = new TextDecoder().decode(nameBytes);

    // Extract data
    const dataStart = nameEnd;
    const dataEnd = dataStart + header.dataLength * 8;
    const data = fromBits(bits.slice(dataStart, dataEnd));

    return {
      dataType: header.dataType,
      name,
      data,
      encrypted: header.encrypted,
    };
  }

  /**
   * Format bytes to human readable string.
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
  }

  /**
   * Read a File as a Uint8Array.
   */
  function readFileAsBytes(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  return {
    encode,
    decode,
    capacity,
    formatBytes,
    readFileAsBytes,
    loadImage,
    TYPE_TEXT,
    TYPE_FILE,
    TYPE_IMAGE,
  };
})();
