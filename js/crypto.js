/**
 * StegaCrypt - Web Crypto API wrapper for AES-GCM encryption.
 */

const StegoCrypto = (() => {
  /**
   * Derive a 256-bit key from a password using PBKDF2.
   */
  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data with AES-GCM.
   * Returns: salt (16 bytes) + iv (12 bytes) + ciphertext
   */
  async function encrypt(data, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    // Combine: salt + iv + ciphertext
    const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(ciphertext), salt.length + iv.length);
    return result;
  }

  /**
   * Decrypt data with AES-GCM.
   * Expects: salt (16 bytes) + iv (12 bytes) + ciphertext
   */
  async function decrypt(data, password) {
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const ciphertext = data.slice(28);
    const key = await deriveKey(password, salt);
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      return new Uint8Array(plaintext);
    } catch {
      throw new Error('Decryption failed. Wrong password?');
    }
  }

  return { encrypt, decrypt };
})();
