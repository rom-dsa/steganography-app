#!/usr/bin/env python3
"""
StegaCrypt - CLI Steganography Tool

Hide and extract messages, files, and images within PNG images
using LSB (Least Significant Bit) steganography.

Usage:
    python stegacrypt.py encode --carrier image.png --data "secret message" --output encoded.png
    python stegacrypt.py encode --carrier image.png --file secret.pdf --output encoded.png
    python stegacrypt.py encode --carrier image.png --image hidden.jpg --output encoded.png
    python stegacrypt.py decode --input encoded.png

Optional encryption:
    python stegacrypt.py encode --carrier image.png --data "secret" --password mypass --output out.png
    python stegacrypt.py decode --input encoded.png --password mypass

Requirements:
    pip install Pillow cryptography
"""

import argparse
import hashlib
import os
import struct
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes

    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

# Constants
MAGIC = 0xDEAD
TYPE_TEXT = 0
TYPE_FILE = 1
TYPE_IMAGE = 2
HEADER_SIZE = 10  # bytes


def derive_key(password: str, salt: bytes) -> bytes:
    """Derive a 256-bit key from a password using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_data(data: bytes, password: str) -> bytes:
    """Encrypt data using AES-GCM. Returns salt + nonce + ciphertext."""
    salt = os.urandom(16)
    nonce = os.urandom(12)
    key = derive_key(password, salt)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, data, None)
    return salt + nonce + ciphertext


def decrypt_data(data: bytes, password: str) -> bytes:
    """Decrypt data using AES-GCM. Expects salt + nonce + ciphertext."""
    salt = data[:16]
    nonce = data[16:28]
    ciphertext = data[28:]
    key = derive_key(password, salt)
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)


def to_bits(data: bytes) -> list[int]:
    """Convert bytes to a list of bits."""
    bits = []
    for byte in data:
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)
    return bits


def from_bits(bits: list[int]) -> bytes:
    """Convert a list of bits back to bytes."""
    result = bytearray()
    for i in range(0, len(bits), 8):
        byte = 0
        for b in range(8):
            if i + b < len(bits):
                byte = (byte << 1) | bits[i + b]
            else:
                byte = byte << 1
        result.append(byte)
    return bytes(result)


def build_header(
    data_type: int, encrypted: bool, name_length: int, data_length: int
) -> bytes:
    """Build 10-byte header."""
    return struct.pack(
        ">HBBHI",
        MAGIC,
        data_type,
        1 if encrypted else 0,
        name_length,
        data_length,
    )


def parse_header(header_bytes: bytes):
    """Parse 10-byte header. Returns dict or None if magic doesn't match."""
    magic, data_type, encrypted, name_length, data_length = struct.unpack(
        ">HBBHI", header_bytes
    )
    if magic != MAGIC:
        return None
    return {
        "data_type": data_type,
        "encrypted": encrypted == 1,
        "name_length": name_length,
        "data_length": data_length,
    }


def capacity(width: int, height: int) -> int:
    """Calculate the maximum bytes that can be hidden."""
    total_bits = width * height * 3  # RGB channels, 1 LSB each
    header_bits = HEADER_SIZE * 8
    return (total_bits - header_bits) // 8


def encode(
    carrier_path: str,
    payload: bytes,
    data_type: int,
    name: str,
    encrypted: bool,
    output_path: str,
) -> None:
    """Encode data into the carrier image."""
    img = Image.open(carrier_path).convert("RGB")
    w, h = img.size
    max_bytes = capacity(w, h)

    name_bytes = name.encode("utf-8")
    total = len(name_bytes) + len(payload)

    if total > max_bytes:
        print(
            f"Error: Data too large. Carrier can hold {max_bytes:,} bytes "
            f"but data is {total:,} bytes."
        )
        sys.exit(1)

    header = build_header(data_type, encrypted, len(name_bytes), len(payload))
    all_bytes = header + name_bytes + payload
    bits = to_bits(all_bytes)

    pixels = list(img.getdata())
    flat = []
    for r, g, b in pixels:
        flat.extend([r, g, b])

    for i, bit in enumerate(bits):
        flat[i] = (flat[i] & 0xFE) | bit

    new_pixels = []
    for i in range(0, len(flat), 3):
        new_pixels.append((flat[i], flat[i + 1], flat[i + 2]))

    new_img = Image.new("RGB", (w, h))
    new_img.putdata(new_pixels)
    new_img.save(output_path, "PNG")
    print(f"Encoded successfully: {output_path}")
    print(f"  Type: {['text', 'file', 'image'][data_type]}")
    print(f"  Name: {name}")
    print(f"  Size: {len(payload):,} bytes")
    print(f"  Encrypted: {'yes' if encrypted else 'no'}")
    print(f"  Capacity used: {total:,} / {max_bytes:,} bytes")


def decode(input_path: str, password: str | None = None):
    """Decode hidden data from an image."""
    img = Image.open(input_path).convert("RGB")
    pixels = list(img.getdata())

    flat = []
    for r, g, b in pixels:
        flat.extend([r, g, b])

    # Extract bits
    bits = [v & 1 for v in flat]

    # Parse header
    header_bits = bits[: HEADER_SIZE * 8]
    header_bytes = from_bits(header_bits)
    header = parse_header(header_bytes)

    if header is None:
        print("No hidden data found in this image.")
        return

    if header["data_type"] > 2:
        print("No hidden data found in this image.")
        return

    # Extract name
    name_start = HEADER_SIZE * 8
    name_end = name_start + header["name_length"] * 8
    name_bytes = from_bits(bits[name_start:name_end])
    name = name_bytes.decode("utf-8", errors="replace")

    # Extract data
    data_start = name_end
    data_end = data_start + header["data_length"] * 8
    data = from_bits(bits[data_start:data_end])

    if header["encrypted"]:
        if not password:
            print("Error: This data is encrypted. Please provide --password.")
            sys.exit(1)
        if not HAS_CRYPTO:
            print("Error: cryptography package required. Install: pip install cryptography")
            sys.exit(1)
        try:
            data = decrypt_data(data, password)
        except Exception:
            print("Error: Decryption failed. Wrong password?")
            sys.exit(1)

    type_names = {TYPE_TEXT: "text", TYPE_FILE: "file", TYPE_IMAGE: "image"}
    print(f"Found hidden {type_names.get(header['data_type'], 'unknown')} data:")
    print(f"  Name: {name}")
    print(f"  Size: {len(data):,} bytes")
    print(f"  Encrypted: {'yes' if header['encrypted'] else 'no'}")

    if header["data_type"] == TYPE_TEXT:
        text = data.decode("utf-8", errors="replace")
        print(f"\n--- Message ---\n{text}\n--- End ---")
    else:
        output_path = name
        if os.path.exists(output_path):
            base, ext = os.path.splitext(output_path)
            output_path = f"{base}_extracted{ext}"
        with open(output_path, "wb") as f:
            f.write(data)
        print(f"  Saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="StegaCrypt - Hide data in images using steganography"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command")

    # Encode
    enc = subparsers.add_parser("encode", help="Hide data in an image")
    enc.add_argument("--carrier", required=True, help="Carrier PNG image")
    enc.add_argument("--output", required=True, help="Output PNG image")
    enc.add_argument("--data", help="Text message to hide")
    enc.add_argument("--file", help="File to hide")
    enc.add_argument("--image", help="Image to hide")
    enc.add_argument("--password", help="Optional encryption password")

    # Decode
    dec = subparsers.add_parser("decode", help="Extract hidden data from an image")
    dec.add_argument("--input", required=True, help="Encoded PNG image")
    dec.add_argument("--password", help="Decryption password")

    # Info
    info = subparsers.add_parser("info", help="Show carrier image capacity")
    info.add_argument("image", help="PNG image to check")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "info":
        img = Image.open(args.image)
        w, h = img.size
        cap = capacity(w, h)
        print(f"Image: {args.image}")
        print(f"  Dimensions: {w} x {h}")
        print(f"  Capacity: {cap:,} bytes ({cap / 1024:.1f} KB)")
        return

    if args.command == "encode":
        if args.data:
            payload = args.data.encode("utf-8")
            data_type = TYPE_TEXT
            name = "message.txt"
        elif args.file:
            with open(args.file, "rb") as f:
                payload = f.read()
            data_type = TYPE_FILE
            name = Path(args.file).name
        elif args.image:
            with open(args.image, "rb") as f:
                payload = f.read()
            data_type = TYPE_IMAGE
            name = Path(args.image).name
        else:
            print("Error: Provide --data, --file, or --image")
            sys.exit(1)

        encrypted = False
        if args.password:
            if not HAS_CRYPTO:
                print("Error: cryptography package required for encryption.")
                print("Install: pip install cryptography")
                sys.exit(1)
            payload = encrypt_data(payload, args.password)
            encrypted = True

        encode(args.carrier, payload, data_type, name, encrypted, args.output)

    elif args.command == "decode":
        decode(args.input, args.password)


if __name__ == "__main__":
    main()
