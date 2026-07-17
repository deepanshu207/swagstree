// ==========================================
// SWAG STREE | IMAGEKIT ADMIN (SUPERADMIN)
// Server-side purge via /api/imagekit/purge worker route.
// ==========================================

function isImageKitAssetUrl(url) {
    if (typeof isImageKitUrl === 'function') return isImageKitUrl(url);
    return /ik\.imagekit\.io\//i.test(String(url || ''));
}

function collectUrlsFromValueForImageKit(value, bucket) {
    if (!value) return;
    if (typeof value === 'string') {
        const meta = typeof parseImageKitUrl === 'function'
            ? parseImageKitUrl(value)
            : (isImageKitAssetUrl(value) ? { filePath: value, url: value } : null);
        if (meta && meta.filePath) bucket.paths.add(meta.filePath);
        else if (isImageKitAssetUrl(value)) bucket.urls.add(value.trim());
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => collectUrlsFromValueForImageKit(item, bucket));
        return;
    }
    if (typeof value === 'object') {
        Object.values(value).forEach((item) => collectUrlsFromValueForImageKit(item, bucket));
    }
}

async function collectImageKitAssetsFromFirestore() {
    const bucket = { paths: new Set(), urls: new Set() };

    const scanCollection = async (collectionName) => {
        const snap = await db.collection(collectionName).get();
        snap.forEach((doc) => collectUrlsFromValueForImageKit(doc.data(), bucket));
    };

    await scanCollection('products');
    await scanCollection('feedbacks');
    await scanCollection('announcements');
    await scanCollection('product_comments');

    const settingsDocs = ['features_content', 'footer', 'diaries', 'promos'];
    for (const docId of settingsDocs) {
        try {
            const snap = await db.collection('settings').doc(docId).get();
            if (snap.exists) collectUrlsFromValueForImageKit(snap.data(), bucket);
        } catch (_) {}
    }

    return {
        filePaths: [...bucket.paths],
        rawUrls: [...bucket.urls]
    };
}

async function purgeImageKitViaWorker(payload) {
    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) throw new Error('You must be logged in as superadmin.');
    const token = await user.getIdToken(true);
    const resp = await fetch(typeof workerApiUrl === 'function' ? workerApiUrl('/api/imagekit/purge') : '/api/imagekit/purge', {
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
        throw new Error(data.error || `ImageKit purge failed (${resp.status}).`);
    }
    return data;
}

window.deleteAllImageKitDataPrompt = async function deleteAllImageKitDataPrompt() {
    if (!isSuperAdmin) return showToast('Only superadmin can perform this action.');

    if (!confirm(
        '⚠️ DANGER: Delete ALL ImageKit media for this store?\n\n' +
        'This permanently removes product images, announcement images, feedback uploads, and backup files stored on ImageKit.\n\n' +
        'Firestore documents are NOT deleted — only the remote media files.\n\n' +
        'Continue?'
    )) return;

    if (!confirm('Are you absolutely sure? Broken image links may appear until you re-upload media.')) return;

    const confirmText = prompt("To verify, type 'DELETE ALL IMAGEKIT':");
    if (confirmText !== 'DELETE ALL IMAGEKIT') {
        return showToast('Verification failed. ImageKit purge aborted.');
    }

    try {
        showToast('Scanning database for ImageKit assets...');
        const assets = await collectImageKitAssetsFromFirestore();
        const refCount = assets.filePaths.length + assets.rawUrls.length;

        showToast(`Purging ImageKit media (${refCount} referenced asset${refCount === 1 ? '' : 's'})...`);

        const result = await purgeImageKitViaWorker({
            filePaths: assets.filePaths,
            rawUrls: assets.rawUrls,
            includeFolderOrphans: true
        });

        const d = result.deleted || {};
        const total = d.total || 0;
        let msg = `🗑️ ImageKit purge complete. ${total} file${total === 1 ? '' : 's'} removed`;
        if (d.referenced || d.folderOrphans) {
            msg += ` (${d.referenced || 0} referenced, ${d.folderOrphans || 0} folder orphans)`;
        }
        if (result.warnings && result.warnings.length) {
            console.warn('ImageKit purge warnings:', result.warnings);
            msg += '. Some warnings — check console.';
        }
        showToast(msg);
    } catch (e) {
        console.error('deleteAllImageKitDataPrompt failed:', e);
        showToast(e.message || 'Failed to purge ImageKit media.');
    }
};

window.collectImageKitAssetsFromFirestore = collectImageKitAssetsFromFirestore;
