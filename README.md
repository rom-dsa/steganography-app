# StegaCrypt - Steganography Tool

Hide messages, files, and images inside PNG images using LSB (Least Significant Bit) steganography. All processing happens locally in your browser — no data is sent to any server.

## Live Demo

Visit the [GitHub Pages deployment](https://rom-dsa.github.io/steganography-app/) to use the web app.

## Features

- **Hide Text Messages** — Embed secret text within a carrier PNG image
- **Hide Files** — Conceal any file (PDF, ZIP, documents, etc.) inside an image
- **Hide Images** — Embed one image within another
- **Extract Hidden Data** — Recover hidden messages, files, or images from encoded images
- **AES-256-GCM Encryption** — Optional password protection using the Web Crypto API
- **Capacity Indicator** — See how much data your carrier image can hold
- **Drag & Drop UI** — Modern, responsive interface with drag-and-drop support
- **100% Client-Side** — Everything runs in your browser, no server needed

## How It Works

The app uses **LSB (Least Significant Bit) steganography** to hide data within images:

1. Each pixel in a PNG image has RGB channels (red, green, blue), each stored as 8 bits
2. The least significant bit of each channel is modified to store hidden data
3. This change is imperceptible to the human eye since it only alters each color value by ±1
4. A header is embedded first (magic number, data type, encryption flag, payload size) followed by the payload

### Capacity

A carrier image can hide approximately `(width × height × 3) / 8` bytes of data. For example:
- 1920×1080 image → ~777 KB
- 4000×3000 image → ~4.5 MB

## Web App

The web interface is built with **vanilla HTML, CSS, and JavaScript** — no frameworks or build tools required. Simply open `index.html` in a browser or visit the GitHub Pages deployment.

## Python CLI

A Python command-line tool is also included for offline use:

```bash
cd python
pip install -r requirements.txt

# Hide a text message
python stegacrypt.py encode --carrier photo.png --data "Top secret message" --output encoded.png

# Hide a file
python stegacrypt.py encode --carrier photo.png --file secret.pdf --output encoded.png

# Hide an image
python stegacrypt.py encode --carrier photo.png --image hidden.jpg --output encoded.png

# With encryption
python stegacrypt.py encode --carrier photo.png --data "Secret" --password mypass --output encoded.png

# Extract hidden data
python stegacrypt.py decode --input encoded.png
python stegacrypt.py decode --input encoded.png --password mypass

# Check carrier capacity
python stegacrypt.py info photo.png
```

## Deployment

The app is automatically deployed to GitHub Pages via the included GitHub Actions workflow on push to `main`.

To deploy manually:
1. Go to **Settings → Pages** in your GitHub repository
2. Set source to **GitHub Actions**
3. Push to the `main` branch

## Security Notes

- **Encryption is optional** — without a password, anyone who knows the technique can extract the data
- Uses **AES-256-GCM** encryption with **PBKDF2** key derivation (100,000 iterations)
- The Web Crypto API is used for all cryptographic operations
- **PNG format only** — JPEG and other lossy formats will destroy the hidden data
- No data leaves your browser — all processing is 100% client-side

## License

MIT
