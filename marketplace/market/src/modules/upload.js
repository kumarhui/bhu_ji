import { firebaseConfig, cloudinaryConfig } from '../api/config.js';
import { getDeviceId } from './auth.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById('sell-form');
const submitBtn = document.getElementById('submitBtn');
const imageInput = document.getElementById('imageInput');
const imagePreviewWrap = document.getElementById('image-preview-wrap');
const imagePreviewGrid = document.getElementById('image-preview-grid');
const formMessage = document.getElementById('form-message');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const successDialog = document.getElementById('success-dialog');
const successCodeEl = document.getElementById('success-code');
const successCloseBtn = document.getElementById('success-close');

const MAX_FILES = 3;
const COMPRESS_DIMENSION = 1400;
const COMPRESS_QUALITY = 0.82;
let compressedFiles = [];

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(1)} ${units[index]}`;
};

const showFormMessage = (message) => {
    formMessage.textContent = message;
};

const renderPreviews = (files) => {
    if (!files.length) {
        imagePreviewGrid.innerHTML = '';
        imagePreviewWrap.hidden = true;
        return;
    }

    imagePreviewGrid.innerHTML = '';
    imagePreviewWrap.hidden = false;

    files.slice(0, MAX_FILES).forEach((file) => {
        const objectUrl = URL.createObjectURL(file);
        const thumb = document.createElement('div');
        thumb.className = 'image-thumb';

        const img = document.createElement('img');
        img.src = objectUrl;
        img.alt = file.name;
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
        };

        const meta = document.createElement('p');
        meta.className = 'thumb-meta';
        meta.textContent = formatBytes(file.size);

        thumb.appendChild(img);
        thumb.appendChild(meta);
        imagePreviewGrid.appendChild(thumb);
    });
};

const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                const scale = Math.min(1, COMPRESS_DIMENSION / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(image.width * scale);
                canvas.height = Math.round(image.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Compression failed'));
                            return;
                        }
                        resolve(new File([blob], file.name, { type: blob.type || 'image/jpeg' }));
                    },
                    'image/jpeg',
                    COMPRESS_QUALITY
                );
            };
            image.onerror = () => reject(new Error('Invalid image'));
            image.src = reader.result;
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
};

const compressFiles = async (files) => {
    const compressed = [];
    for (const file of files) {
        const blob = await compressImage(file);
        compressed.push(blob);
    }
    return compressed;
};

const uploadSingleImage = (file, index, uploadProgress) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);

        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                uploadProgress[index] = event.loaded;
                const totalUploaded = uploadProgress.reduce((sum, current) => sum + current, 0);
                const totalSize = uploadProgress.totalSize || 1;
                const percent = Math.min(100, Math.round((totalUploaded / totalSize) * 100));
                progressBar.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                resolve(response.secure_url);
            } else {
                reject(new Error('Image upload failed'));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Image upload failed'));
        };

        xhr.send(formData);
    });
};

const resetFormState = () => {
    progressContainer.style.display = 'none';
    submitBtn.disabled = false;
};

successDialog.hidden = true;
successCloseBtn.addEventListener('click', () => {
    window.location.href = 'index1.html';
});

imageInput.addEventListener('change', async () => {
    const files = Array.from(imageInput.files);
    showFormMessage('');

    if (!files.length) {
        compressedFiles = [];
        renderPreviews([]);
        return;
    }

    if (files.length > MAX_FILES) {
        showFormMessage(`Pick up to ${MAX_FILES} images for a listing.`);
        imageInput.value = '';
        compressedFiles = [];
        renderPreviews([]);
        return;
    }

    showFormMessage('Preparing images...');
    try {
        compressedFiles = await compressFiles(files);
        renderPreviews(compressedFiles);
        showFormMessage('');
    } catch (err) {
        showFormMessage('Could not prepare these photos. Try different files.');
        compressedFiles = [];
        renderPreviews([]);
        imageInput.value = '';
    }
});

form.onsubmit = async (e) => {
    e.preventDefault();

    showFormMessage('');

    if (!compressedFiles.length) {
        showFormMessage('Add at least one image to continue.');
        return;
    }

    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    progressContainer.style.display = 'block';
    submitBtn.disabled = true;

    const totalSize = compressedFiles.reduce((sum, file) => sum + file.size, 0);
    const uploadProgress = new Array(compressedFiles.length).fill(0);
    uploadProgress.totalSize = totalSize;

    try {
        const imageUrls = await Promise.all(
            compressedFiles.map((file, index) => uploadSingleImage(file, index, uploadProgress))
        );

        const deletionCode = String(Math.floor(100000 + Math.random() * 900000));

        await addDoc(collection(db, "listings"), {
            title: document.getElementById('title').value,
            category: document.getElementById('category').value,
            price: Number(document.getElementById('price').value),
            phone: document.getElementById('phone').value,
            description: document.getElementById('desc').value,
            imageUrls,
            deviceId: getDeviceId(),
            createdAt: new Date(),
            deletionCode,
            sold: false
        });

        resetFormState();
        successCodeEl.textContent = deletionCode;
        successDialog.hidden = false;
        compressedFiles = [];
        imageInput.value = '';
        renderPreviews([]);
        showFormMessage(`Remember ${deletionCode} to edit or delete this listing later.`);
    } catch (err) {
        showFormMessage('Upload failed. Please try again.');
        resetFormState();
    }
};
