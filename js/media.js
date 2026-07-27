// ==========================================
// SWAG STREE | MEDIA CDN (Cloudinary / ImageKit)
// ==========================================

const IMAGEKIT_DEFAULT_PUBLIC_KEY = 'public_3H/K75xEHd17m+AitdItZIZQuNo=';
const IMAGEKIT_DEFAULT_URL_ENDPOINT = 'https://ik.imagekit.io/fenbexha5';
const IMAGEKIT_DEFAULT_FOLDER = '/swagstree';

const CLOUDINARY_HOST_PATTERN = /res\.cloudinary\.com\//i;
const IMAGEKIT_HOST_PATTERN = /ik\.imagekit\.io\//i;

function getMediaProvider() {
    const p = (window.APP_FEATURES && window.APP_FEATURES.mediaProvider) || 'cloudinary';
    return p === 'imagekit' ? 'imagekit' : 'cloudinary';
}
window.getMediaProvider = getMediaProvider;

function getImageKitConfig() {
    const cfg = (window.APP_FEATURES && window.APP_FEATURES.imagekit) || {};
    return {
        publicKey: (cfg.publicKey || IMAGEKIT_DEFAULT_PUBLIC_KEY).trim(),
        urlEndpoint: (cfg.urlEndpoint || IMAGEKIT_DEFAULT_URL_ENDPOINT).trim().replace(/\/$/, ''),
        folder: (cfg.folder || IMAGEKIT_DEFAULT_FOLDER).trim() || IMAGEKIT_DEFAULT_FOLDER
    };
}
window.getImageKitConfig = getImageKitConfig;

function isCloudinaryUrl(url) {
    return !!(url && typeof url === 'string' && CLOUDINARY_HOST_PATTERN.test(url));
}
window.isCloudinaryUrl = isCloudinaryUrl;

function isImageKitUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (IMAGEKIT_HOST_PATTERN.test(url)) return true;
    const endpoint = getImageKitConfig().urlEndpoint;
    return !!(endpoint && url.trim().startsWith(endpoint));
}
window.isImageKitUrl = isImageKitUrl;

function parseCloudinaryUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!CLOUDINARY_HOST_PATTERN.test(trimmed)) return null;
    const match = trimmed.match(/res\.cloudinary\.com\/[^/]+\/(image|video|raw|auto)\/upload(?:\/v\d+)?\/([^?#]+)/i);
    if (!match) return null;
    let resourceType = match[1].toLowerCase();
    let publicId = decodeURIComponent(match[2]).replace(/\.[a-z0-9]+$/i, '');
    if (resourceType === 'auto') {
        resourceType = /\.(json|pdf|zip|csv|txt|xml)$/i.test(match[2]) ? 'raw' : 'image';
    }
    if (!publicId) return null;
    return { provider: 'cloudinary', resourceType, publicId };
}
window.parseCloudinaryUrl = parseCloudinaryUrl;

function parseImageKitUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!isImageKitUrl(trimmed)) return null;
    try {
        const u = new URL(trimmed);
        let path = decodeURIComponent(u.pathname || '');
        const endpoint = getImageKitConfig().urlEndpoint;
        if (endpoint) {
            try {
                const base = new URL(endpoint);
                if (u.hostname === base.hostname) {
                    const basePath = base.pathname.replace(/\/$/, '');
                    if (basePath && path.startsWith(basePath)) {
                        path = path.slice(basePath.length) || path;
                    }
                }
            } catch (_) { /* ignore */ }
        }
        path = path.replace(/\/tr:[^/]+/gi, '');
        const segments = path.split('/').filter(Boolean);
        if (segments.length >= 2 && !segments[0].includes('.')) {
            segments.shift();
        }
        path = '/' + segments.join('/');
        if (!path || path === '/') return null;
        return { provider: 'imagekit', filePath: path, url: trimmed };
    } catch (_) {
        return null;
    }
}
window.parseImageKitUrl = parseImageKitUrl;

async function getFirebaseIdToken() {
    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) throw new Error('You must be logged in to upload media.');
    return user.getIdToken(true);
}

async function fetchImageKitAuth() {
    const token = await getFirebaseIdToken();
    const urls = [];
    urls.push('/.netlify/functions/imagekit-auth');
    urls.push('/api/imagekit/auth');
    if (typeof workerApiUrl === 'function') {
        const workerUrl = workerApiUrl('/api/imagekit/auth');
        if (urls.indexOf(workerUrl) === -1) urls.push(workerUrl);
    }
    const workerDirect = 'https://swagstree.amazing-deepanshu14.workers.dev/api/imagekit/auth';
    if (urls.indexOf(workerDirect) === -1) urls.push(workerDirect);

    const errors = [];
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
            const resp = await fetch(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'omit'
            });
            const raw = await resp.text();
            let data = {};
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch (_) {
                errors.push(url + ': invalid JSON (HTTP ' + resp.status + ')');
                continue;
            }
            if (resp.ok && data.ok) return data;
            errors.push(url + ': ' + (data.error || ('HTTP ' + resp.status)));
        } catch (e) {
            errors.push(url + ': ' + (e.message || 'network error'));
        }
    }
    throw new Error(
        'ImageKit auth failed after trying ' + urls.length + ' endpoint(s). ' +
        errors.join(' · ') +
        ' — Paste your ImageKit private_… key in Superadmin → ImageKit → Save, then redeploy Netlify.'
    );
}

function cloudinaryUploadDirect(file, onProgress, opts) {
    const options = opts || {};
    const isVideo = file.type && file.type.startsWith('video/');
    let resourceType = options.resourceType;
    if (!resourceType) resourceType = isVideo ? 'video' : 'image';
    const cloudName = typeof CLOUD_NAME !== 'undefined' ? CLOUD_NAME : 'mysharecloud';
    const preset = typeof PRESET !== 'undefined' ? PRESET : 'swagstree_upload';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    const endpointType = resourceType === 'auto' ? 'auto' : resourceType;
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${endpointType}/upload`);
        if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(e.loaded / e.total);
            };
        }
        xhr.onload = () => {
            try {
                const d = JSON.parse(xhr.responseText || '{}');
                if (d.secure_url) resolve(d.secure_url);
                else reject(new Error(d.error ? d.error.message : 'Cloudinary upload failed'));
            } catch (e) {
                reject(new Error('Cloudinary upload failed'));
            }
        };
        xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'));
        xhr.send(fd);
    });
}

function imagekitUploadDirect(file, onProgress) {
    const config = getImageKitConfig();
    return fetchImageKitAuth().then((auth) => new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('fileName', file.name || `upload-${Date.now()}`);
        fd.append('publicKey', auth.publicKey || config.publicKey);
        fd.append('signature', auth.signature);
        fd.append('token', auth.token);
        fd.append('expire', String(auth.expire));
        const folder = auth.folder || config.folder || IMAGEKIT_DEFAULT_FOLDER;
        if (folder) fd.append('folder', folder);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');
        if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(e.loaded / e.total);
            };
        }
        xhr.onload = () => {
            try {
                const d = JSON.parse(xhr.responseText || '{}');
                if (d.url) resolve(d.url);
                const errMsg = d.message || d.error || (d.help && String(d.help)) || (xhr.status ? `HTTP ${xhr.status}` : '');
                reject(new Error(errMsg || 'ImageKit upload failed'));
            } catch (e) {
                reject(new Error(xhr.responseText || 'ImageKit upload failed'));
            }
        };
        xhr.onerror = () => reject(new Error('Network error during ImageKit upload'));
        xhr.send(fd);
    }));
}

function uploadMediaFile(file, onProgress, opts) {
    if (getMediaProvider() === 'imagekit') {
        return imagekitUploadDirect(file, onProgress);
    }
    return cloudinaryUploadDirect(file, onProgress, opts);
}
window.uploadMediaFile = uploadMediaFile;

// Backward-compatible direct Cloudinary upload (must not call uploadMediaFile — avoids recursion)
window.uploadToCloudinary = function uploadToCloudinary(file, onProgress, opts) {
    return cloudinaryUploadDirect(file, onProgress, opts);
};
window.uploadToImageKit = function uploadToImageKit(file, onProgress) {
    return imagekitUploadDirect(file, onProgress);
};

function getMediaProviderFromUI() {
    const el = document.getElementById('superadmin-media-provider');
    if (el) return el.value === 'imagekit' ? 'imagekit' : 'cloudinary';
    return getMediaProvider();
}

function markMediaProviderUiDirty() {
    window._mediaProviderUiDirty = true;
}
window.markMediaProviderUiDirty = markMediaProviderUiDirty;

function syncMediaProviderFieldsFromConfig(config) {
    const data = config || window.APP_FEATURES || {};
    const mediaProviderEl = document.getElementById('superadmin-media-provider');
    if (mediaProviderEl) {
        mediaProviderEl.value = data.mediaProvider === 'imagekit' ? 'imagekit' : 'cloudinary';
    }
    const ik = data.imagekit || {};
    const ikPublicEl = document.getElementById('superadmin-imagekit-public-key');
    if (ikPublicEl) ikPublicEl.value = ik.publicKey || IMAGEKIT_DEFAULT_PUBLIC_KEY;
    const ikPrivateEl = document.getElementById('superadmin-imagekit-private-key');
    if (ikPrivateEl) {
        ikPrivateEl.value = '';
        ikPrivateEl.placeholder = ik.privateKey ? '••••••••  (saved — leave blank to keep)' : 'private_… (paste from ImageKit dashboard)';
    }
    const ikEndpointEl = document.getElementById('superadmin-imagekit-url-endpoint');
    if (ikEndpointEl) ikEndpointEl.value = ik.urlEndpoint || IMAGEKIT_DEFAULT_URL_ENDPOINT;
    const ikFolderEl = document.getElementById('superadmin-imagekit-folder');
    if (ikFolderEl) ikFolderEl.value = ik.folder || IMAGEKIT_DEFAULT_FOLDER;
}
window.syncMediaProviderFieldsFromConfig = syncMediaProviderFieldsFromConfig;

function updateMediaProviderUI() {
    const saved = getMediaProvider();
    const provider = getMediaProviderFromUI();
    const badge = document.getElementById('super-media-provider-active');
    if (badge) {
        badge.textContent = provider === 'imagekit' ? 'ImageKit' : 'Cloudinary';
        badge.className = 'super-media-provider-badge super-media-provider-badge--' + provider;
    }
    const ikSettings = document.getElementById('super-imagekit-settings');
    if (ikSettings) ikSettings.style.display = provider === 'imagekit' ? 'flex' : 'none';
    const cloudRow = document.getElementById('super-delete-cloudinary-row');
    const ikRow = document.getElementById('super-delete-imagekit-row');
    if (cloudRow) cloudRow.style.opacity = provider === 'cloudinary' ? '1' : '0.72';
    if (ikRow) ikRow.style.opacity = provider === 'imagekit' ? '1' : '0.72';
    const unsavedHint = document.getElementById('super-media-provider-unsaved-hint');
    if (unsavedHint) unsavedHint.style.display = saved !== provider ? 'block' : 'none';
}
window.updateMediaProviderUI = updateMediaProviderUI;
window.getMediaProviderFromUI = getMediaProviderFromUI;
