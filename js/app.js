/**
 * StegaCrypt - Application Logic
 */

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────
  let currentMode = 'encode';
  let currentType = 'text';
  let carrierFile = null;
  let secretFile = null;
  let secretImageFile = null;
  let decodeFile = null;
  let carrierCapacity = 0;

  // ─── DOM Elements ─────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Tabs
  const tabBtns = $$('.tabs__btn');

  // Panels
  const encodePanel = $('#encode-panel');
  const decodePanel = $('#decode-panel');

  // Type selector
  const typeBtns = $$('.type-selector__btn');
  const textInput = $('#text-input');
  const fileInput = $('#file-input');
  const imageInput = $('#image-input');

  // Carrier
  const carrierDropzone = $('#carrier-dropzone');
  const carrierInputEl = $('#carrier-input');
  const carrierPreview = $('#carrier-preview');
  const carrierImg = $('#carrier-img');
  const carrierName = $('#carrier-name');
  const carrierSize = $('#carrier-size');
  const carrierRemove = $('#carrier-remove');

  // Secret text
  const secretText = $('#secret-text');
  const charCount = $('#char-count');

  // Secret file
  const fileDropzone = $('#file-dropzone');
  const secretFileInput = $('#secret-file-input');
  const filePreview = $('#file-preview');
  const fileName = $('#file-name');
  const fileSize = $('#file-size');
  const fileRemove = $('#file-remove');

  // Secret image
  const imageDropzone = $('#image-dropzone');
  const secretImageInput = $('#secret-image-input');
  const secretImagePreview = $('#secret-image-preview');
  const secretImg = $('#secret-img');
  const secretImageName = $('#secret-image-name');
  const secretImageSize = $('#secret-image-size');
  const secretImageRemove = $('#secret-image-remove');

  // Password
  const encodePassword = $('#encode-password');
  const encodePwToggle = $('#encode-pw-toggle');

  // Capacity
  const capacityBar = $('#capacity-bar');
  const capacityText = $('#capacity-text');
  const capacityFill = $('#capacity-fill');

  // Encode button
  const encodeBtn = $('#encode-btn');

  // Decode
  const decodeDropzone = $('#decode-dropzone');
  const decodeInputEl = $('#decode-input');
  const decodePreview = $('#decode-preview');
  const decodeImg = $('#decode-img');
  const decodeName = $('#decode-name');
  const decodeSize = $('#decode-size');
  const decodeRemove = $('#decode-remove');
  const decodePassword = $('#decode-password');
  const decodePwToggle = $('#decode-pw-toggle');
  const decodeBtn = $('#decode-btn');
  const resultArea = $('#result-area');
  const resultContent = $('#result-content');

  // Progress
  const progressOverlay = $('#progress-overlay');
  const progressText = $('#progress-text');

  // Toast
  const toastContainer = $('#toast-container');

  // ─── Toast System ─────────────────────────────────────────
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ─── Progress ─────────────────────────────────────────────
  function showProgress(text) {
    progressText.textContent = text;
    progressOverlay.hidden = false;
  }

  function hideProgress() {
    progressOverlay.hidden = true;
  }

  // ─── Tab Switching ────────────────────────────────────────
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      tabBtns.forEach((b) => b.classList.remove('tabs__btn--active'));
      btn.classList.add('tabs__btn--active');
      encodePanel.hidden = currentMode !== 'encode';
      decodePanel.hidden = currentMode !== 'decode';
    });
  });

  // ─── Type Switching ───────────────────────────────────────
  typeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      typeBtns.forEach((b) => b.classList.remove('type-selector__btn--active'));
      btn.classList.add('type-selector__btn--active');
      textInput.hidden = currentType !== 'text';
      fileInput.hidden = currentType !== 'file';
      imageInput.hidden = currentType !== 'image';
      updateEncodeButton();
      updateCapacity();
    });
  });

  // ─── Dropzone Helpers ─────────────────────────────────────
  function setupDropzone(dropzone, input, onFile) {
    dropzone.addEventListener('click', () => input.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dropzone--active');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dropzone--active');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dropzone--active');
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    });

    input.addEventListener('change', () => {
      if (input.files[0]) onFile(input.files[0]);
      input.value = '';
    });
  }

  // ─── Carrier Image ───────────────────────────────────────
  function setCarrier(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    carrierFile = file;
    carrierImg.src = URL.createObjectURL(file);
    carrierName.textContent = file.name;
    carrierSize.textContent = Stego.formatBytes(file.size);
    carrierDropzone.hidden = true;
    carrierPreview.hidden = false;

    // Calculate capacity
    const img = new Image();
    img.onload = () => {
      carrierCapacity = Stego.capacity(img.width, img.height);
      updateCapacity();
      updateEncodeButton();
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  function removeCarrier() {
    carrierFile = null;
    carrierCapacity = 0;
    carrierDropzone.hidden = false;
    carrierPreview.hidden = true;
    capacityBar.hidden = true;
    updateEncodeButton();
  }

  setupDropzone(carrierDropzone, carrierInputEl, setCarrier);
  carrierRemove.addEventListener('click', removeCarrier);

  // ─── Secret Text ──────────────────────────────────────────
  secretText.addEventListener('input', () => {
    charCount.textContent = secretText.value.length;
    updateCapacity();
    updateEncodeButton();
  });

  // ─── Secret File ──────────────────────────────────────────
  function setSecretFile(file) {
    secretFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = Stego.formatBytes(file.size);
    fileDropzone.hidden = true;
    filePreview.hidden = false;
    updateCapacity();
    updateEncodeButton();
  }

  function removeSecretFile() {
    secretFile = null;
    fileDropzone.hidden = false;
    filePreview.hidden = true;
    updateCapacity();
    updateEncodeButton();
  }

  setupDropzone(fileDropzone, secretFileInput, setSecretFile);
  fileRemove.addEventListener('click', removeSecretFile);

  // ─── Secret Image ─────────────────────────────────────────
  function setSecretImage(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    secretImageFile = file;
    secretImg.src = URL.createObjectURL(file);
    secretImageName.textContent = file.name;
    secretImageSize.textContent = Stego.formatBytes(file.size);
    imageDropzone.hidden = true;
    secretImagePreview.hidden = false;
    updateCapacity();
    updateEncodeButton();
  }

  function removeSecretImage() {
    secretImageFile = null;
    imageDropzone.hidden = false;
    secretImagePreview.hidden = true;
    updateCapacity();
    updateEncodeButton();
  }

  setupDropzone(imageDropzone, secretImageInput, setSecretImage);
  secretImageRemove.addEventListener('click', removeSecretImage);

  // ─── Password Toggle ─────────────────────────────────────
  function togglePassword(input, btn) {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  encodePwToggle.addEventListener('click', () => togglePassword(encodePassword, encodePwToggle));
  decodePwToggle.addEventListener('click', () => togglePassword(decodePassword, decodePwToggle));

  // ─── Capacity Indicator ───────────────────────────────────
  function getDataSize() {
    if (currentType === 'text') {
      return new TextEncoder().encode(secretText.value).length;
    } else if (currentType === 'file' && secretFile) {
      return secretFile.size;
    } else if (currentType === 'image' && secretImageFile) {
      return secretImageFile.size;
    }
    return 0;
  }

  function updateCapacity() {
    if (!carrierFile || carrierCapacity === 0) {
      capacityBar.hidden = true;
      return;
    }

    const dataSize = getDataSize();
    // Add estimated name overhead (filename + encryption overhead)
    const nameOverhead = 64; // rough estimate
    const encOverhead = encodePassword.value ? 28 : 0;
    const totalEstimate = dataSize + nameOverhead + encOverhead;

    capacityBar.hidden = false;
    capacityText.textContent = `${Stego.formatBytes(totalEstimate)} / ${Stego.formatBytes(carrierCapacity)}`;

    const pct = Math.min((totalEstimate / carrierCapacity) * 100, 100);
    capacityFill.style.width = pct + '%';

    capacityFill.classList.remove('capacity__fill--warning', 'capacity__fill--danger');
    if (pct > 90) {
      capacityFill.classList.add('capacity__fill--danger');
    } else if (pct > 70) {
      capacityFill.classList.add('capacity__fill--warning');
    }
  }

  // ─── Encode Button State ──────────────────────────────────
  function updateEncodeButton() {
    let hasData = false;
    if (currentType === 'text') hasData = secretText.value.length > 0;
    else if (currentType === 'file') hasData = secretFile !== null;
    else if (currentType === 'image') hasData = secretImageFile !== null;

    encodeBtn.disabled = !carrierFile || !hasData;
  }

  // ─── Encode Action ────────────────────────────────────────
  encodeBtn.addEventListener('click', async () => {
    if (!carrierFile) return;

    try {
      showProgress('Preparing data...');

      let payload;
      let dataType;
      let name;

      if (currentType === 'text') {
        dataType = Stego.TYPE_TEXT;
        payload = new TextEncoder().encode(secretText.value);
        name = 'message.txt';
      } else if (currentType === 'file') {
        dataType = Stego.TYPE_FILE;
        payload = await Stego.readFileAsBytes(secretFile);
        name = secretFile.name;
      } else {
        dataType = Stego.TYPE_IMAGE;
        payload = await Stego.readFileAsBytes(secretImageFile);
        name = secretImageFile.name;
      }

      const password = encodePassword.value.trim();
      let encrypted = false;

      if (password) {
        showProgress('Encrypting data...');
        payload = await StegoCrypto.encrypt(payload, password);
        encrypted = true;
      }

      showProgress('Encoding into image...');
      const blob = await Stego.encode(carrierFile, payload, dataType, name, encrypted);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stegacrypt_' + carrierFile.name.replace(/\.[^.]+$/, '') + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      hideProgress();
      showToast('Image encoded and downloaded successfully!', 'success');
    } catch (err) {
      hideProgress();
      showToast(err.message, 'error');
    }
  });

  // ─── Decode Panel ─────────────────────────────────────────
  function setDecodeFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a PNG image', 'error');
      return;
    }
    decodeFile = file;
    decodeImg.src = URL.createObjectURL(file);
    decodeName.textContent = file.name;
    decodeSize.textContent = Stego.formatBytes(file.size);
    decodeDropzone.hidden = true;
    decodePreview.hidden = false;
    decodeBtn.disabled = false;
  }

  function removeDecodeFile() {
    decodeFile = null;
    decodeDropzone.hidden = false;
    decodePreview.hidden = true;
    decodeBtn.disabled = true;
    resultArea.hidden = true;
    resultContent.innerHTML = '';
  }

  setupDropzone(decodeDropzone, decodeInputEl, setDecodeFile);
  decodeRemove.addEventListener('click', removeDecodeFile);

  // ─── Decode Action ────────────────────────────────────────
  decodeBtn.addEventListener('click', async () => {
    if (!decodeFile) return;

    try {
      showProgress('Extracting hidden data...');
      const result = await Stego.decode(decodeFile);

      if (!result) {
        hideProgress();
        showToast('No hidden data found in this image', 'error');
        return;
      }

      let data = result.data;
      const password = decodePassword.value.trim();

      if (result.encrypted) {
        if (!password) {
          hideProgress();
          showToast('This data is encrypted. Please enter the password.', 'error');
          return;
        }
        showProgress('Decrypting data...');
        data = await StegoCrypto.decrypt(data, password);
      }

      hideProgress();
      displayResult(result.dataType, result.name, data);
      showToast('Hidden data extracted successfully!', 'success');
    } catch (err) {
      hideProgress();
      showToast(err.message, 'error');
    }
  });

  // ─── Display Result ───────────────────────────────────────
  function displayResult(dataType, name, data) {
    resultArea.hidden = false;
    resultContent.innerHTML = '';

    if (dataType === Stego.TYPE_TEXT) {
      const text = new TextDecoder().decode(data);
      const textDiv = document.createElement('div');
      textDiv.className = 'result__text';
      textDiv.textContent = text;
      resultContent.appendChild(textDiv);

      const actions = document.createElement('div');
      actions.className = 'result__actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn--secondary';
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copy Text
      `;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          showToast('Copied to clipboard', 'success');
        });
      });
      actions.appendChild(copyBtn);
      resultContent.appendChild(actions);
    } else if (dataType === Stego.TYPE_IMAGE) {
      const blob = new Blob([data], { type: guessImageMime(name) });
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.className = 'result__image';
      img.src = url;
      img.alt = 'Hidden image';
      resultContent.appendChild(img);

      const actions = createDownloadActions(blob, name);
      resultContent.appendChild(actions);
    } else {
      // File
      const blob = new Blob([data]);
      const info = document.createElement('div');
      info.className = 'result__text';
      info.textContent = `Hidden file: ${name} (${Stego.formatBytes(data.length)})`;
      resultContent.appendChild(info);

      const actions = createDownloadActions(blob, name);
      resultContent.appendChild(actions);
    }
  }

  function createDownloadActions(blob, name) {
    const actions = document.createElement('div');
    actions.className = 'result__actions';

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn btn--secondary';
    dlBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download
    `;
    dlBtn.addEventListener('click', () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    actions.appendChild(dlBtn);
    return actions;
  }

  function guessImageMime(name) {
    const ext = name.split('.').pop().toLowerCase();
    const mimes = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
    };
    return mimes[ext] || 'image/png';
  }

  // ─── Listen for password changes to update capacity ───────
  encodePassword.addEventListener('input', updateCapacity);
})();
