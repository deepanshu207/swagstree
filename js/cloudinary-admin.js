// ==========================================
// SWAG STREE | CLOUDINARY ADMIN (SUPERADMIN)
// Server-side purge via /api/cloudinary/purge worker route.
// ==========================================

const CLOUDINARY_HOST_PATTERN = /res\.cloudinary\.com\//i;

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
    return { resourceType, publicId };
}

function collectUrlsFromValue(value, bucket) {
    if (!value) return;
    if (typeof value === 'string') {
        const meta = parseCloudinaryUrl(value);
        if (meta) bucket[meta.resourceType === 'raw' ? 'raw' : 'image'].add(meta.publicId);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => collectUrlsFromValue(item, bucket));
        return;
    }
    if (typeof value === 'object') {
        Object.values(value).forEach((item) => collectUrlsFromValue(item, bucket));
    }
}

async function collectCloudinaryAssetsFromFirestore() {
    const bucket = { image: new Set(), raw: new Set() };

    const scanCollection = async (collectionName) => {
        const snap = await db.collection(collectionName).get();
        snap.forEach((doc) => collectUrlsFromValue(doc.data(), bucket));
    };

    await scanCollection('products');
    await scanCollection('feedbacks');
    await scanCollection('announcements');
    await scanCollection('product_comments');

    const settingsDocs = ['features_content', 'footer', 'diaries', 'promos'];
    for (const docId of settingsDocs) {
        try {
            const snap = await db.collection('settings').doc(docId).get();
            if (snap.exists) collectUrlsFromValue(snap.data(), bucket);
        } catch (_) {}
    }

    return {
        imagePublicIds: [...bucket.image],
        rawPublicIds: [...bucket.raw]
    };
}

async function getSuperAdminIdToken() {
    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) throw new Error('You must be logged in as superadmin.');
    return user.getIdToken(true);
}

async function purgeCloudinaryViaWorker(payload) {
    const token = await getSuperAdminIdToken();
    const resp = await fetch('/api/cloudinary/purge', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    let data = {};
    try {
        data = await resp.json();
    } catch (_) {
        throw new Error('Server returned an invalid response.');
    }

    if (!resp.ok || !data.ok) {
        throw new Error(data.error || `Cloudinary purge failed (${resp.status}).`);
    }
    return data;
}

window.deleteAllCloudinaryDataPrompt = async function deleteAllCloudinaryDataPrompt() {
    if (!isSuperAdmin) return showToast('Only superadmin can perform this action.');

    if (!confirm(
        '⚠️ DANGER: Delete ALL Cloudinary media for this store?\n\n' +
        'This permanently removes product images, announcement images, feedback uploads, and backup files stored on Cloudinary.\n\n' +
        'Firestore documents are NOT deleted — only the remote media files.\n\n' +
        'Continue?'
    )) return;

    if (!confirm('Are you absolutely sure? Broken image links may appear until you re-upload media.')) return;

    const confirmText = prompt("To verify, type 'DELETE ALL CLOUDINARY':");
    if (confirmText !== 'DELETE ALL CLOUDINARY') {
        return showToast('Verification failed. Cloudinary purge aborted.');
    }

    try {
        showToast('Scanning database for Cloudinary assets...');
        const assets = await collectCloudinaryAssetsFromFirestore();
        const refCount = assets.imagePublicIds.length + assets.rawPublicIds.length;

        showToast(`Purging Cloudinary media (${refCount} referenced asset${refCount === 1 ? '' : 's'})...`);

        const result = await purgeCloudinaryViaWorker({
            imagePublicIds: assets.imagePublicIds,
            rawPublicIds: assets.rawPublicIds,
            includePrefixOrphans: true
        });

        const d = result.deleted || {};
        const total = d.total || 0;
        let msg = `🗑️ Cloudinary purge complete. ${total} file${total === 1 ? '' : 's'} removed`;
        if (d.referencedImages || d.referencedRaw) {
            msg += ` (${d.referencedImages || 0} referenced images, ${d.referencedRaw || 0} raw)`;
        }
        if (result.warnings && result.warnings.length) {
            console.warn('Cloudinary purge warnings:', result.warnings);
            msg += '. Some warnings — check console.';
        }
        showToast(msg);
    } catch (e) {
        console.error('deleteAllCloudinaryDataPrompt failed:', e);
        showToast(e.message || 'Failed to purge Cloudinary media.');
    }
};

window.collectCloudinaryAssetsFromFirestore = collectCloudinaryAssetsFromFirestore;
window.parseCloudinaryUrl = parseCloudinaryUrl;
