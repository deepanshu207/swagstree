// ==========================================
// SWAG STREE | ADMIN CRUD DRAFTS (seller-style)
// ==========================================

(function() {
    const ADMIN_DRAFTS_KEY = 'swagstree_admin_drafts_v2';
    const ADMIN_DRAFTS_LEGACY_KEY = 'swagstree_admin_draft_v1';
    const ADMIN_DRAFTS_LEGACY_ARCHIVE_KEY = 'swagstree_admin_draft_archive_v1';
    const ADMIN_DRAFTS_MAX_BYTES = 500000;
    const ADMIN_DRAFTS_MAX_PER_TYPE = 25;
    const DRAFT_MEDIA_DB = 'swagstree_admin_draft_media';
    const DRAFT_MEDIA_STORE = 'blobs';
    const DRAFT_MEDIA_MAX_FILE = 8 * 1024 * 1024;
    const DRAFT_MEDIA_MAX_DRAFT = 24 * 1024 * 1024;
    const PRODUCT_AUTO_SAVE_MS = 900;
    const CATEGORY_AUTO_SAVE_MS = 600;

    let unsavedResolver = null;
    let categoryDraftTimer = null;
    let productDraftTimer = null;
    let _draftStoreCache = null;
    let _legacyMigrated = false;
    let _adminUiRefreshTimer = null;
    let _draftMediaDbPromise = null;
    let _productAutoSaveInFlight = null;

    function adminCancelProductDraftAutosave() {
        clearTimeout(productDraftTimer);
        productDraftTimer = null;
    }

    function adminCancelCategoryDraftAutosave() {
        clearTimeout(categoryDraftTimer);
        categoryDraftTimer = null;
    }

    window._activeAdminDraftKey = window._activeAdminDraftKey || null;
    if (window._adminDraftAccordionStateInited !== true) {
        window._adminDraftsAccordionOpen = false;
        window._adminDraftSubOpen = { product: false, category: false };
        window._adminDraftAccordionStateInited = true;
    }

    function adminDraftInvalidateCache() {
        _draftStoreCache = null;
    }

    function adminDraftCloneStore(store) {
        return {
            v: 2,
            categories: { ...(store.categories || {}) },
            products: { ...(store.products || {}) }
        };
    }

    function scheduleAdminDraftUiRefresh() {
        clearTimeout(_adminUiRefreshTimer);
        _adminUiRefreshTimer = setTimeout(() => {
            renderAdminDraftRecoveryPanel();
            const prodOpen = document.getElementById('prod-modal')?.style.display === 'flex';
            const catOpen = typeof isCategoryModalOpen === 'function' && isCategoryModalOpen();
            if (prodOpen) {
                if (typeof renderProductModalDraftBanner === 'function') renderProductModalDraftBanner();
                if (typeof adminRenderProductDraftSwitcher === 'function') adminRenderProductDraftSwitcher();
            }
            if (catOpen) {
                if (typeof renderCategoryModalDraftBanner === 'function') renderCategoryModalDraftBanner();
                if (typeof adminRenderCategoryDraftSwitcher === 'function') adminRenderCategoryDraftSwitcher();
            }
            if (!prodOpen && typeof renderAdmin === 'function') renderAdmin();
        }, 300);
    }

    function adminCrudDraftsEnabled() {
        return !!(window.APP_FEATURES && window.APP_FEATURES.adminCrudDrafts !== false);
    }

    function adminCrudDraftsMediaEnabled() {
        return adminCrudDraftsEnabled() && !!(window.APP_FEATURES && window.APP_FEATURES.adminCrudDraftsMedia);
    }

    function adminCrudDraftsClearAllEnabled() {
        return adminCrudDraftsEnabled() && window.APP_FEATURES?.adminCrudDraftsClearAll !== false;
    }

    function adminDraftMediaOpenDb() {
        if (_draftMediaDbPromise) return _draftMediaDbPromise;
        _draftMediaDbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB unavailable'));
                return;
            }
            const req = indexedDB.open(DRAFT_MEDIA_DB, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(DRAFT_MEDIA_STORE)) {
                    db.createObjectStore(DRAFT_MEDIA_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
        });
        return _draftMediaDbPromise;
    }

    async function adminDraftMediaPut(refId, blob, meta) {
        const db = await adminDraftMediaOpenDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DRAFT_MEDIA_STORE, 'readwrite');
            tx.objectStore(DRAFT_MEDIA_STORE).put({ blob, meta: meta || {}, updatedAt: Date.now() }, refId);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function adminDraftMediaGet(refId) {
        const db = await adminDraftMediaOpenDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DRAFT_MEDIA_STORE, 'readonly');
            const req = tx.objectStore(DRAFT_MEDIA_STORE).get(refId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function adminDraftMediaDeletePrefix(prefix) {
        try {
            const db = await adminDraftMediaOpenDb();
            const keys = await new Promise((resolve, reject) => {
                const tx = db.transaction(DRAFT_MEDIA_STORE, 'readonly');
                const req = tx.objectStore(DRAFT_MEDIA_STORE).getAllKeys();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
            const toDelete = keys.filter(k => String(k).startsWith(prefix));
            if (!toDelete.length) return;
            await new Promise((resolve, reject) => {
                const tx = db.transaction(DRAFT_MEDIA_STORE, 'readwrite');
                const store = tx.objectStore(DRAFT_MEDIA_STORE);
                toDelete.forEach(k => store.delete(k));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('adminDraftMediaDeletePrefix failed:', e);
        }
    }

    async function adminDraftMediaClearAll() {
        try {
            const db = await adminDraftMediaOpenDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(DRAFT_MEDIA_STORE, 'readwrite');
                tx.objectStore(DRAFT_MEDIA_STORE).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('adminDraftMediaClearAll failed:', e);
        }
    }

    function adminDraftExtractFile(item) {
        if (item instanceof File) return item;
        if (item && typeof item === 'object') {
            if (item.file instanceof File) return item.file;
            if (item.blob instanceof Blob && !(item.url)) return item.file || null;
        }
        return null;
    }

    async function adminDraftPersistMediaArray(arr, type, draftKey, prefix, totalRef) {
        if (!Array.isArray(arr)) return arr;
        const out = [];
        const isVideo = prefix.includes('video');
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (typeof item === 'string' && item.trim()) {
                out.push(item.trim());
                continue;
            }
            if (item?.draftMediaRef && !item.pendingFile) {
                out.push(item);
                continue;
            }
            if (item?.url && !item.pendingFile && !adminDraftExtractFile(item)) {
                out.push({ url: item.url, is360: !!item.is360 });
                continue;
            }
            const file = adminDraftExtractFile(item);
            if (!file) {
                if (item?.pendingFile) out.push(item);
                continue;
            }
            if (file.size > DRAFT_MEDIA_MAX_FILE || totalRef.bytes + file.size > DRAFT_MEDIA_MAX_DRAFT) {
                out.push({ pendingFile: true, name: file.name, tooLarge: true });
                totalRef.skipped = true;
                continue;
            }
            const refId = `${type}:${draftKey}:${prefix}:${i}`;
            try {
                await adminDraftMediaPut(refId, file, { name: file.name, mime: file.type, size: file.size });
                totalRef.bytes += file.size;
                if (isVideo) {
                    out.push({
                        draftMediaRef: refId,
                        name: file.name,
                        mime: file.type,
                        is360: !!(item.is360 || item._is360),
                        restoredMedia: true
                    });
                } else {
                    out.push({ draftMediaRef: refId, name: file.name, mime: file.type, restoredMedia: true });
                }
            } catch (e) {
                console.warn('adminDraftPersistMediaArray failed:', e);
                out.push({ pendingFile: true, name: file.name });
                totalRef.skipped = true;
            }
        }
        return out;
    }

    async function adminDraftHydrateMediaArray(arr, isVideo) {
        if (!Array.isArray(arr)) return arr;
        const out = [];
        for (const item of arr) {
            if (typeof item === 'string') {
                out.push(item);
                continue;
            }
            if (item?.draftMediaRef) {
                try {
                    const stored = await adminDraftMediaGet(item.draftMediaRef);
                    const blob = stored?.blob;
                    if (blob) {
                        const file = new File([blob], item.name || 'media', { type: item.mime || blob.type || 'application/octet-stream' });
                        if (isVideo) out.push({ file, url: '', is360: !!item.is360 });
                        else out.push(file);
                        continue;
                    }
                } catch (e) {
                    console.warn('adminDraftHydrateMediaArray failed:', e);
                }
                out.push({ pendingFile: true, name: item.name || 'file', missingMedia: true });
                continue;
            }
            if (item?.url) {
                out.push(isVideo ? { url: item.url, is360: !!item.is360 } : item.url);
                continue;
            }
            out.push(item);
        }
        return out;
    }

    async function adminDraftPrepareProductFormForSave(form, draftKey) {
        if (!form || !adminCrudDraftsMediaEnabled()) return form;
        const totalRef = { bytes: 0, skipped: false };
        await adminDraftMediaDeletePrefix(`product:${draftKey}:`);
        const out = { ...form, variants: (form.variants || []).map(v => ({ ...v })) };
        out.images = await adminDraftPersistMediaArray(form.images, 'product', draftKey, 'img', totalRef);
        out.spins = await adminDraftPersistMediaArray(form.spins, 'product', draftKey, 'spin', totalRef);
        out.panos = await adminDraftPersistMediaArray(form.panos, 'product', draftKey, 'pano', totalRef);
        out.videos = await adminDraftPersistMediaArray(form.videos, 'product', draftKey, 'video', totalRef);
        for (let vi = 0; vi < (form.variants || []).length; vi++) {
            const v = form.variants[vi];
            const vp = `v${vi}`;
            out.variants[vi].images = await adminDraftPersistMediaArray(v.images, 'product', draftKey, `${vp}-img`, totalRef);
            out.variants[vi].spinImages = await adminDraftPersistMediaArray(v.spinImages, 'product', draftKey, `${vp}-spin`, totalRef);
            out.variants[vi].panoramaImages = await adminDraftPersistMediaArray(v.panoramaImages, 'product', draftKey, `${vp}-pano`, totalRef);
            out.variants[vi].videos = await adminDraftPersistMediaArray(v.videos, 'product', draftKey, `${vp}-video`, totalRef);
            out.variants[vi].previewImages = await adminDraftPersistMediaArray(v.previewImages, 'product', draftKey, `${vp}-prev`, totalRef);
        }
        out.hasPendingFiles = !!totalRef.skipped;
        out.hasSavedMedia = !totalRef.skipped && totalRef.bytes > 0;
        return out;
    }

    async function adminDraftHydrateProductForm(form) {
        if (!form) return form;
        if (!adminCrudDraftsMediaEnabled()) return form;
        const out = { ...form, variants: (form.variants || []).map(v => ({ ...v })) };
        out.images = await adminDraftHydrateMediaArray(form.images, false);
        out.spins = await adminDraftHydrateMediaArray(form.spins, false);
        out.panos = await adminDraftHydrateMediaArray(form.panos, false);
        out.videos = await adminDraftHydrateMediaArray(form.videos, true);
        for (let vi = 0; vi < (form.variants || []).length; vi++) {
            const v = form.variants[vi];
            out.variants[vi].images = await adminDraftHydrateMediaArray(v.images, false);
            out.variants[vi].spinImages = await adminDraftHydrateMediaArray(v.spinImages, false);
            out.variants[vi].panoramaImages = await adminDraftHydrateMediaArray(v.panoramaImages, false);
            out.variants[vi].videos = await adminDraftHydrateMediaArray(v.videos, true);
            out.variants[vi].previewImages = await adminDraftHydrateMediaArray(v.previewImages, false);
        }
        out.hasPendingFiles = [out.images, out.spins, out.panos, out.videos, ...(out.variants || []).flatMap(v => [v.images, v.spinImages, v.panoramaImages, v.videos])]
            .some(arr => (arr || []).some(item => item && (item.pendingFile || item.missingMedia || item.tooLarge)));
        return out;
    }

    async function adminAutoSaveProductDraft(opts) {
        if (!adminCrudDraftsEnabled()) return false;
        if (window._adminProductPublishLock) return false;
        const modal = document.getElementById('prod-modal');
        if (!modal || modal.style.display !== 'flex') return false;
        if (typeof adminBuildProductDraftPayload !== 'function') return false;
        if (typeof adminProductDraftPayloadHasContent !== 'function') return false;
        let form = adminBuildProductDraftPayload();
        if (!adminProductDraftPayloadHasContent(form)) return false;
        const isNew = !form.editingId;
        if (!isNew && !(opts && opts.force) && typeof adminIsProductDirty === 'function' && !adminIsProductDirty()) {
            return false;
        }
        const key = form.editingId ? `edit:${form.editingId}` : 'new';
        if (adminCrudDraftsMediaEnabled()) {
            form = await adminDraftPrepareProductFormForSave(form, key);
        }
        if (typeof adminDraftUpsert !== 'function') return false;
        return adminDraftUpsert('product', key, {
            entityId: form.editingId || null,
            label: (form.name || '').trim() || (form.editingId ? 'Product edit' : 'New product'),
            form
        }, { skipUi: !!(opts && opts.silent) });
    }

    async function adminAutoSaveCategoryDraft(opts) {
        if (!adminCrudDraftsEnabled()) return false;
        if (window._adminCategoryPublishLock) return false;
        if (typeof isCategoryModalOpen !== 'function' || !isCategoryModalOpen()) return false;
        if (typeof serializeCategoryFormState !== 'function') return false;
        const state = serializeCategoryFormState();
        if (typeof categoryFormHasDraftableContent !== 'function' || !categoryFormHasDraftableContent(state)) {
            return false;
        }
        const isNew = !state.editingCategoryId;
        if (!isNew && !(opts && opts.force) && typeof adminIsCategoryDirty === 'function' && !adminIsCategoryDirty()) {
            return false;
        }
        const key = state.editingCategoryId ? `edit:${state.editingCategoryId}` : 'new';
        return adminDraftUpsert('category', key, {
            entityId: state.editingCategoryId || null,
            label: state.name,
            form: state
        }, { skipUi: !!(opts && opts.silent) });
    }

    function adminDraftEscapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function adminDraftFormatAge(ts) {
        const ms = Date.now() - (Number(ts) || 0);
        if (ms < 60000) return 'just now';
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
        if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
        return `${Math.floor(ms / 86400000)}d ago`;
    }

    function adminDraftEmptyStore() {
        return { v: 2, categories: {}, products: {} };
    }

    function adminDraftComposeActiveKey(type, key) {
        return `${type}:${key}`;
    }

    function adminDraftSetActive(type, key) {
        window._activeAdminDraftKey = type && key ? adminDraftComposeActiveKey(type, key) : null;
    }

    function adminDraftClearActive() {
        window._activeAdminDraftKey = null;
    }

    function adminDraftIsActive(type, key) {
        return window._activeAdminDraftKey === adminDraftComposeActiveKey(type, key);
    }

    function adminDraftMigrateLegacy() {
        if (_legacyMigrated) return;
        _legacyMigrated = true;
        try {
            const legacyRaw = localStorage.getItem(ADMIN_DRAFTS_LEGACY_KEY);
            const archiveRaw = localStorage.getItem(ADMIN_DRAFTS_LEGACY_ARCHIVE_KEY);
            const store = adminDraftsReadAll();
            let changed = false;

            [legacyRaw, archiveRaw].forEach(raw => {
                if (!raw) return;
                try {
                    const draft = JSON.parse(raw);
                    if (!draft || !draft.type || !draft.form) return;
                    const bucket = draft.type === 'category' ? 'categories' : draft.type === 'product' ? 'products' : null;
                    if (!bucket) return;
                    const entityId = draft.entityId || draft.form.editingCategoryId || draft.form.editingId || null;
                    const key = entityId ? `edit:${entityId}` : 'new';
                    if (!store[bucket][key]) {
                        store[bucket][key] = {
                            form: draft.form,
                            label: draft.label || draft.form.name || (bucket === 'products' ? 'Product' : 'Category'),
                            entityId,
                            updatedAt: draft.updatedAt || draft.archivedAt || Date.now()
                        };
                        changed = true;
                    }
                } catch (e) { /* ignore */ }
            });

            if (legacyRaw) {
                localStorage.removeItem(ADMIN_DRAFTS_LEGACY_KEY);
                changed = true;
            }
            if (archiveRaw) {
                localStorage.removeItem(ADMIN_DRAFTS_LEGACY_ARCHIVE_KEY);
                changed = true;
            }
            if (changed) {
                adminDraftInvalidateCache();
                adminDraftsWriteAll(store);
            }
        } catch (e) {
            console.warn('adminDraftMigrateLegacy failed:', e);
        }
    }

    function adminDraftsReadAll() {
        if (_draftStoreCache) return adminDraftCloneStore(_draftStoreCache);
        adminDraftMigrateLegacy();
        try {
            const raw = localStorage.getItem(ADMIN_DRAFTS_KEY);
            if (!raw) {
                _draftStoreCache = adminDraftEmptyStore();
                return adminDraftCloneStore(_draftStoreCache);
            }
            const store = JSON.parse(raw);
            if (!store || typeof store !== 'object') {
                _draftStoreCache = adminDraftEmptyStore();
                return adminDraftCloneStore(_draftStoreCache);
            }
            store.categories = store.categories && typeof store.categories === 'object' ? store.categories : {};
            store.products = store.products && typeof store.products === 'object' ? store.products : {};
            store.v = 2;
            _draftStoreCache = store;
            return adminDraftCloneStore(store);
        } catch (e) {
            console.warn('adminDraftsReadAll failed:', e);
            _draftStoreCache = adminDraftEmptyStore();
            return adminDraftCloneStore(_draftStoreCache);
        }
    }

    function adminDraftsWriteAll(store) {
        if (!store) return false;
        try {
            const json = JSON.stringify(store);
            if (json.length > ADMIN_DRAFTS_MAX_BYTES) {
                console.warn('Admin drafts exceed storage cap; oldest entries trimmed.');
                adminDraftsEvictOldest(store);
                const trimmed = JSON.stringify(store);
                if (trimmed.length > ADMIN_DRAFTS_MAX_BYTES) return false;
                localStorage.setItem(ADMIN_DRAFTS_KEY, trimmed);
                _draftStoreCache = adminDraftCloneStore(store);
                return true;
            }
            localStorage.setItem(ADMIN_DRAFTS_KEY, json);
            _draftStoreCache = adminDraftCloneStore(store);
            return true;
        } catch (e) {
            console.warn('adminDraftsWriteAll failed:', e);
            return false;
        }
    }

    function adminDraftsEvictOldest(store) {
        ['categories', 'products'].forEach(bucket => {
            const entries = Object.entries(store[bucket] || {});
            if (entries.length <= ADMIN_DRAFTS_MAX_PER_TYPE) return;
            entries.sort((a, b) => (Number(a[1]?.updatedAt) || 0) - (Number(b[1]?.updatedAt) || 0));
            const removeCount = entries.length - ADMIN_DRAFTS_MAX_PER_TYPE;
            entries.slice(0, removeCount).forEach(([key]) => {
                delete store[bucket][key];
            });
        });
    }

    function adminDraftGetEntry(type, key) {
        if (!type || !key) return null;
        const store = adminDraftsReadAll();
        const bucket = type === 'category' ? 'categories' : type === 'product' ? 'products' : null;
        if (!bucket) return null;
        const entry = store[bucket][key];
        if (!entry?.form) return null;
        return { type, key, entry };
    }

    function adminDraftIsVisible(type, key) {
        if (!adminCrudDraftsEnabled()) return false;
        if (adminDraftIsActive(type, key)) return false;
        return !!adminDraftGetEntry(type, key);
    }

    function adminDraftUpsert(type, key, payload, opts) {
        if (!adminCrudDraftsEnabled() || !type || !key || !payload) return false;
        const store = adminDraftsReadAll();
        const bucket = type === 'category' ? 'categories' : type === 'product' ? 'products' : null;
        if (!bucket) return false;
        store[bucket][key] = {
            form: payload.form,
            label: payload.label || 'Untitled',
            entityId: payload.entityId || null,
            updatedAt: Date.now()
        };
        adminDraftsEvictOldest(store);
        const ok = adminDraftsWriteAll(store);
        if (ok && !(opts && opts.skipUi)) scheduleAdminDraftUiRefresh();
        if (type === 'product' && key.startsWith('edit:') && document.getElementById('prod-modal')?.style.display === 'flex') {
            if (typeof adminRenderProductDraftSwitcher === 'function') adminRenderProductDraftSwitcher();
        }
        if (type === 'category' && key.startsWith('edit:') && typeof isCategoryModalOpen === 'function' && isCategoryModalOpen()) {
            if (typeof adminRenderCategoryDraftSwitcher === 'function') adminRenderCategoryDraftSwitcher();
        }
        return ok;
    }

    function adminDraftRemove(type, key) {
        if (!type || !key) return;
        const store = adminDraftsReadAll();
        const bucket = type === 'category' ? 'categories' : type === 'product' ? 'products' : null;
        if (!bucket) return;
        if (store[bucket][key]) delete store[bucket][key];
        adminDraftsWriteAll(store);
        if (adminDraftIsActive(type, key)) adminDraftClearActive();
        adminDraftMediaDeletePrefix(`${type}:${key}:`);
        scheduleAdminDraftUiRefresh();
    }

    function adminDraftRemoveAll() {
        try { localStorage.removeItem(ADMIN_DRAFTS_KEY); } catch (e) { /* ignore */ }
        adminDraftInvalidateCache();
        adminDraftClearActive();
        adminDraftMediaClearAll();
        scheduleAdminDraftUiRefresh();
    }

    function adminGetProductEditDraftIdSet() {
        if (!adminCrudDraftsEnabled()) return new Set();
        const active = window._activeAdminDraftKey;
        const store = adminDraftsReadAll();
        const ids = new Set();
        Object.keys(store.products || {}).forEach(key => {
            if (!key.startsWith('edit:')) return;
            if (adminDraftComposeActiveKey('product', key) === active) return;
            if (store.products[key]?.form) ids.add(key.slice(5));
        });
        return ids;
    }

    function adminGetCategoryEditDraftIdSet() {
        if (!adminCrudDraftsEnabled()) return new Set();
        const active = window._activeAdminDraftKey;
        const store = adminDraftsReadAll();
        const ids = new Set();
        Object.keys(store.categories || {}).forEach(key => {
            if (!key.startsWith('edit:')) return;
            if (adminDraftComposeActiveKey('category', key) === active) return;
            if (store.categories[key]?.form) ids.add(key.slice(5));
        });
        return ids;
    }

    function adminDraftListEntries() {
        const store = adminDraftsReadAll();
        const items = [];
        Object.entries(store.categories || {}).forEach(([key, entry]) => {
            items.push({ type: 'category', key, entry });
        });
        Object.entries(store.products || {}).forEach(([key, entry]) => {
            items.push({ type: 'product', key, entry });
        });
        items.sort((a, b) => (Number(b.entry?.updatedAt) || 0) - (Number(a.entry?.updatedAt) || 0));
        return items;
    }

    function adminGetVisibleProductDraft(key) {
        if (!adminDraftIsVisible('product', key)) return null;
        return adminDraftGetEntry('product', key);
    }

    function adminGetVisibleCategoryDraft(key) {
        if (!adminDraftIsVisible('category', key)) return null;
        return adminDraftGetEntry('category', key);
    }

    function adminGetOrphanedNewProductDraft() {
        return adminGetVisibleProductDraft('new');
    }

    function adminGetOrphanedNewCategoryDraft() {
        return adminGetVisibleCategoryDraft('new');
    }

    function adminDraftsStorageInfo() {
        try {
            const raw = localStorage.getItem(ADMIN_DRAFTS_KEY) || '';
            const store = adminDraftsReadAll();
            return {
                bytes: raw.length,
                total: Object.keys(store.categories || {}).length + Object.keys(store.products || {}).length,
                categories: Object.keys(store.categories || {}).length,
                products: Object.keys(store.products || {}).length
            };
        } catch (e) {
            return { bytes: 0, total: 0, categories: 0, products: 0 };
        }
    }

    function adminDraftFormatBytes(bytes) {
        const n = Number(bytes) || 0;
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    }

    function updateSuperadminDraftStorageInfo() {
        const el = document.getElementById('admin-drafts-storage-info');
        if (!el) return;
        const info = adminDraftsStorageInfo();
        const mediaNote = adminCrudDraftsMediaEnabled() ? ' · images/videos in browser storage' : ' · text fields only';
        const clearNote = adminCrudDraftsClearAllEnabled() ? '' : ' · Clear all disabled';
        el.innerHTML = info.total
            ? `${info.total} draft${info.total === 1 ? '' : 's'} (${info.products} product, ${info.categories} category) · ${adminDraftFormatBytes(info.bytes)} in local storage${mediaNote}${clearNote}. Auto-saves while you edit.`
            : `No drafts stored in this browser${mediaNote}. Auto-saves while you edit.`;
    }

    function updateAdminNewProductDraftBadge() {
        const btn = document.getElementById('admin-new-product-btn');
        if (!btn) return;
        const hasDraft = !!adminGetOrphanedNewProductDraft();
        btn.classList.toggle('has-new-draft', hasDraft);
        let badge = btn.querySelector('.admin-new-draft-btn-badge');
        if (hasDraft) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'admin-new-draft-btn-badge';
                badge.textContent = 'Draft';
                btn.appendChild(badge);
            }
        } else if (badge) {
            badge.remove();
        }
    }

    window.adminMarkDraftFieldEl = function(el, isDraft, hint) {
        if (!el) return;
        el.classList.toggle('admin-field--draft', !!isDraft);
        if (isDraft && hint) {
            el.setAttribute('title', hint);
            el.setAttribute('aria-description', hint);
        } else {
            el.removeAttribute('title');
            el.removeAttribute('aria-description');
        }
    };

    window.adminMarkDraftSectionEl = function(el, isDraft, hint) {
        if (!el) return;
        el.classList.toggle('admin-section--draft', !!isDraft);
        if (isDraft && hint) el.setAttribute('title', hint);
        else el.removeAttribute('title');
    };

    function adminDraftRowMediaNote(form) {
        if (!form) return '';
        if (form.hasSavedMedia) return ' · <span class="admin-draft-recovery-row__media">photos/videos saved</span>';
        if (form.hasPendingFiles) return ' · <span class="admin-draft-recovery-row__media admin-draft-recovery-row__media--warn">re-upload media</span>';
        const imgCount = (form.images?.length || 0) + (form.spins?.length || 0) + (form.panos?.length || 0) + (form.videos?.length || 0);
        if (imgCount) return ' · <span class="admin-draft-recovery-row__media">includes media links</span>';
        return '';
    }

    function adminDraftRecoveryRowHtml(item) {
        const label = adminDraftEscapeHtml(item.entry?.label || 'Untitled');
        const age = adminDraftFormatAge(item.entry?.updatedAt);
        const isNew = item.key === 'new';
        const meta = isNew ? 'New — not published yet' : 'Unpublished edits';
        const mediaNote = item.type === 'product' ? adminDraftRowMediaNote(item.entry?.form) : '';
        const action = `adminRestoreDraft('${item.type}', '${item.key}')`;
        return `
        <div class="admin-draft-recovery-row admin-draft-recovery-row--${item.type}">
            <div class="admin-draft-recovery-row__text">
                <strong>${label}</strong>
                <span class="admin-draft-recovery-row__meta">${meta} · ${age}${mediaNote}</span>
            </div>
            <div class="admin-draft-recovery-row__actions">
                <button type="button" class="btn-gold admin-draft-btn-continue" onclick="${action}">Continue</button>
                <button type="button" class="admin-btn-secondary admin-draft-btn-delete" onclick="adminDeleteDraft('${item.type}', '${item.key}')">Delete</button>
            </div>
        </div>`;
    }

    function adminDraftRecoverySectionHtml(type, items) {
        if (!items.length) return '';
        const isProduct = type === 'product';
        const icon = isProduct ? 'fa-box-open' : 'fa-folder-open-o';
        const title = isProduct ? 'Product drafts' : 'Category drafts';
        const hint = isProduct
            ? 'Tap <strong>Continue</strong> → finish → <strong>Save Product</strong> to publish.'
            : 'Tap <strong>Continue</strong> → finish → <strong>Save Category</strong> to publish.';
        const countLabel = `${items.length}`;
        const sorted = [...items].sort((a, b) => (Number(b.entry?.updatedAt) || 0) - (Number(a.entry?.updatedAt) || 0));
        const open = !!window._adminDraftSubOpen[type];
        return `
        <div class="admin-draft-sub-accordion admin-draft-sub-accordion--${type}">
            <button type="button" class="admin-draft-sub-accordion__trigger" onclick="toggleAdminDraftSubsection('${type}')" aria-expanded="${open}">
                <span class="admin-draft-sub-accordion__title">
                    <i class="fa ${icon}" aria-hidden="true"></i>
                    ${title}
                    <span class="admin-draft-recovery-section__count">${countLabel}</span>
                </span>
                <i class="fa fa-chevron-down admin-draft-sub-accordion__icon${open ? ' is-open' : ''}" aria-hidden="true"></i>
            </button>
            <div id="admin-draft-sub-${type}" class="admin-draft-sub-accordion__body${open ? ' is-expanded' : ''}">
                <p class="admin-draft-recovery-section__hint">${hint}</p>
                <div class="admin-draft-recovery-list">
                    ${sorted.map(adminDraftRecoveryRowHtml).join('')}
                </div>
            </div>
        </div>`;
    }

    function adminSyncDraftAccordionDom() {
        const mainOpen = !!window._adminDraftsAccordionOpen;
        const body = document.getElementById('admin-draft-accordion-body');
        const mainIcon = document.querySelector('.admin-draft-accordion__icon');
        const mainTrigger = document.querySelector('.admin-draft-accordion__trigger');
        if (body) body.classList.toggle('is-expanded', mainOpen);
        if (mainIcon) mainIcon.classList.toggle('is-open', mainOpen);
        if (mainTrigger) mainTrigger.setAttribute('aria-expanded', mainOpen ? 'true' : 'false');

        ['product', 'category'].forEach(type => {
            const open = !!(window._adminDraftSubOpen && window._adminDraftSubOpen[type]);
            const subBody = document.getElementById(`admin-draft-sub-${type}`);
            const subIcon = document.querySelector(`.admin-draft-sub-accordion--${type} .admin-draft-sub-accordion__icon`);
            const subTrigger = document.querySelector(`.admin-draft-sub-accordion--${type} .admin-draft-sub-accordion__trigger`);
            if (subBody) subBody.classList.toggle('is-expanded', open);
            if (subIcon) subIcon.classList.toggle('is-open', open);
            if (subTrigger) subTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    window.toggleAdminDraftsAccordion = function() {
        window._adminDraftsAccordionOpen = !window._adminDraftsAccordionOpen;
        if (!window._adminDraftsAccordionOpen) {
            window._adminDraftSubOpen = { product: false, category: false };
        }
        adminSyncDraftAccordionDom();
    };

    window.toggleAdminDraftSubsection = function(type) {
        if (!type) return;
        if (!window._adminDraftSubOpen) window._adminDraftSubOpen = { product: false, category: false };
        window._adminDraftSubOpen[type] = !window._adminDraftSubOpen[type];
        if (window._adminDraftSubOpen[type]) {
            window._adminDraftsAccordionOpen = true;
        }
        adminSyncDraftAccordionDom();
    };

    function adminDraftPanelListSignature(items) {
        return items.map(i => `${i.type}:${i.key}`).sort().join('|');
    }

    function adminUpdateDraftPanelCounts(total, productCount, categoryCount) {
        const mainBadge = document.querySelector('.admin-draft-accordion__trigger .admin-draft-recovery-section__count');
        if (mainBadge) mainBadge.textContent = String(total);
        const productBadge = document.querySelector('.admin-draft-sub-accordion--product .admin-draft-recovery-section__count');
        if (productBadge) productBadge.textContent = String(productCount);
        const categoryBadge = document.querySelector('.admin-draft-sub-accordion--category .admin-draft-recovery-section__count');
        if (categoryBadge) categoryBadge.textContent = String(categoryCount);
    }

    let _lastDraftPanelListSig = '';

    function renderAdminDraftRecoveryPanel() {
        updateAdminNewProductDraftBadge();
        updateSuperadminDraftStorageInfo();

        const panel = document.getElementById('admin-draft-recovery-panel');
        if (!panel) return;

        if (typeof adminIsLayoutSectionEnabled === 'function' && !adminIsLayoutSectionEnabled('drafts')) {
            panel.hidden = true;
            panel.innerHTML = '';
            panel.style.display = 'none';
            return;
        }

        if (!adminCrudDraftsEnabled()) {
            panel.hidden = true;
            panel.innerHTML = '';
            panel.style.display = 'none';
            return;
        }

        const items = adminDraftListEntries().filter(item => adminDraftIsVisible(item.type, item.key));
        if (!items.length) {
            panel.hidden = true;
            panel.innerHTML = '';
            panel.style.display = 'none';
            _lastDraftPanelListSig = '';
            return;
        }

        const productDrafts = items.filter(item => item.type === 'product');
        const categoryDrafts = items.filter(item => item.type === 'category');
        const totalCount = items.length;
        const listSig = adminDraftPanelListSignature(items);
        if (panel.querySelector('.admin-draft-accordion') && listSig === _lastDraftPanelListSig) {
            adminUpdateDraftPanelCounts(totalCount, productDrafts.length, categoryDrafts.length);
            adminSyncDraftAccordionDom();
            return;
        }
        _lastDraftPanelListSig = listSig;

        const mainOpen = !!window._adminDraftsAccordionOpen;
        const clearBtn = adminCrudDraftsClearAllEnabled()
            ? '<button type="button" class="admin-btn-draft-clear" onclick="event.stopPropagation(); adminDeleteAllDrafts()">Clear all</button>'
            : '';

        panel.hidden = false;
        panel.style.display = '';
        panel.innerHTML = `
            <div class="admin-draft-recovery-panel admin-draft-accordion">
                <div class="admin-draft-accordion__head">
                    <button type="button" class="admin-draft-accordion__trigger" onclick="toggleAdminDraftsAccordion()" aria-expanded="${mainOpen}">
                        <span class="admin-draft-recovery-panel__title">
                            <i class="fa fa-file-text-o" aria-hidden="true"></i>
                            Saved drafts
                            <span class="admin-draft-recovery-section__count">${totalCount}</span>
                        </span>
                        <i class="fa fa-chevron-down admin-draft-accordion__icon${mainOpen ? ' is-open' : ''}" aria-hidden="true"></i>
                    </button>
                    ${clearBtn}
                </div>
                <div id="admin-draft-accordion-body" class="admin-draft-accordion__body${mainOpen ? ' is-expanded' : ''}">
                    <p class="admin-draft-recovery-intro">Work is <strong>auto-saved</strong> on this device while you edit. Tap the sections below to view drafts, then <strong>Continue</strong> to reopen.</p>
                    <div class="admin-draft-recovery-sections">
                        ${adminDraftRecoverySectionHtml('product', productDrafts)}
                        ${adminDraftRecoverySectionHtml('category', categoryDrafts)}
                    </div>
                </div>
            </div>`;
        adminSyncDraftAccordionDom();
    }

    window.adminRestoreDraft = async function(type, key) {
        if (!adminCrudDraftsEnabled()) return;
        const item = adminDraftGetEntry(type, key);
        if (!item?.entry?.form) return;

        if (type === 'category') {
            if (typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) {
                showToast('Save or discard your current category edits first.');
                return;
            }
            if (typeof openAdminCategoryAccordion === 'function') openAdminCategoryAccordion();
            if (typeof applyCategoryFormState === 'function') applyCategoryFormState(item.entry.form, true);
            adminDraftSetActive('category', key);
            window._adminCategoryViewMode = 'draft';
            if (typeof renderCategoryModalDraftBanner === 'function') renderCategoryModalDraftBanner();
            if (typeof adminRenderCategoryDraftSwitcher === 'function') adminRenderCategoryDraftSwitcher();
            showToast('Category draft opened — publish with Save Category.');
        } else if (type === 'product') {
            const modal = document.getElementById('prod-modal');
            if (modal?.style.display === 'flex' && typeof adminIsProductDirty === 'function' && adminIsProductDirty()) {
                showToast('Save or discard your current product edits first.');
                return;
            }
            if (modal) modal.style.display = 'flex';
            let form = item.entry.form;
            if (adminCrudDraftsMediaEnabled()) {
                try {
                    form = await adminDraftHydrateProductForm(form);
                } catch (e) {
                    console.warn('adminDraftHydrateProductForm failed:', e);
                }
            }
            if (typeof applyProductDraftForm === 'function') applyProductDraftForm(form);
            adminDraftSetActive('product', key);
            window._adminProductViewMode = 'draft';
            if (typeof adminBindProductDraftListeners === 'function') adminBindProductDraftListeners();
            if (typeof adminResetProductSnapshot === 'function') adminResetProductSnapshot();
            if (typeof renderProductModalDraftBanner === 'function') renderProductModalDraftBanner();
            if (typeof adminRenderProductDraftSwitcher === 'function') adminRenderProductDraftSwitcher();
            if (form.hasPendingFiles) {
                showToast('Draft opened — some media could not be restored; re-upload if needed.');
            } else if (form.hasSavedMedia) {
                showToast('Draft opened with saved photos/videos — publish with Save Product.');
            } else {
                showToast('Draft opened — publish with Save Product.');
            }
        }

        renderAdminDraftRecoveryPanel();
        scheduleAdminDraftUiRefresh();
    };

    window.adminDeleteDraft = function(type, key, opts) {
        if (!type || !key) return;
        if (!(opts && opts.skipConfirm)) {
            const item = adminDraftGetEntry(type, key);
            const label = (item?.entry?.label || 'Untitled').trim();
            const noun = type === 'category' ? 'category' : 'product';
            const detail = key === 'new' ? 'unsaved new ' + noun : `unpublished ${noun} edits`;
            if (!window.confirm(`Delete draft for "${label}" (${detail})?\n\nThis only removes the saved draft on this device.`)) return;
        }
        adminDraftRemove(type, key);
        showToast('Draft deleted.');
        scheduleAdminDraftUiRefresh();
    };

    window.adminDeleteAllDrafts = function() {
        if (!adminCrudDraftsClearAllEnabled()) {
            showToast('Clear all drafts is disabled in Superadmin settings.');
            return;
        }
        if (!adminDraftListEntries().length) return;
        if (!window.confirm('Delete all product and category drafts on this device?')) return;
        adminDraftRemoveAll();
        showToast('All drafts cleared.');
    };

    function adminPromptUnsaved(message, withDraft) {
        return new Promise(resolve => {
            const modal = document.getElementById('admin-unsaved-modal');
            const msgEl = document.getElementById('admin-unsaved-message');
            const draftBtn = document.getElementById('admin-unsaved-btn-draft');
            if (!modal || !msgEl) {
                resolve(window.confirm(message + '\n\nOK = Save, Cancel = Keep editing') ? 'save' : 'cancel');
                return;
            }
            unsavedResolver = resolve;
            msgEl.textContent = message;
            if (draftBtn) draftBtn.style.display = (withDraft && adminCrudDraftsEnabled()) ? 'block' : 'none';
            modal.style.display = 'flex';
        });
    }

    window.adminUnsavedResolve = function(choice) {
        const modal = document.getElementById('admin-unsaved-modal');
        if (modal) modal.style.display = 'none';
        if (unsavedResolver) unsavedResolver(choice || 'cancel');
        unsavedResolver = null;
    };

    async function adminHandleDirtyLeave(message, handlers) {
        const withDraft = !!(handlers && handlers.onSaveDraft);
        const choice = await adminPromptUnsaved(message, withDraft);
        if (choice === 'cancel') return false;
        if (choice === 'save') {
            const ok = handlers.onSave ? await handlers.onSave() : false;
            if (!ok) return false;
        } else if (choice === 'draft') {
            if (handlers.onSaveDraft) {
                const ok = await handlers.onSaveDraft();
                if (ok === false) return false;
            }
        } else if (choice === 'discard') {
            if (handlers.onDiscard) handlers.onDiscard();
        }
        return true;
    }

    function adminAnyUnsavedDirty() {
        const prodOpen = document.getElementById('prod-modal')?.style.display === 'flex';
        if (prodOpen && typeof adminIsProductDirty === 'function' && adminIsProductDirty()) return true;
        if (typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) return true;
        if (typeof isCategoryFormDirty === 'function' && isCategoryFormDirty()) return true;
        return false;
    }

    function adminDraftRead() {
        const items = adminDraftListEntries().filter(item => adminDraftIsVisible(item.type, item.key));
        if (!items.length) return null;
        const item = items[0];
        return {
            type: item.type,
            form: item.entry.form,
            label: item.entry.label,
            entityId: item.entry.entityId,
            updatedAt: item.entry.updatedAt
        };
    }

    function adminDraftWrite(draft) {
        if (!draft || !draft.type || !draft.form) return false;
        const entityId = draft.entityId || draft.form.editingCategoryId || draft.form.editingId || null;
        const key = entityId ? `edit:${entityId}` : 'new';
        return adminDraftUpsert(draft.type, key, {
            form: draft.form,
            label: draft.label,
            entityId
        });
    }

    function adminDraftClear() {
        adminDraftRemoveAll();
    }

    window.adminCancelProductDraftAutosave = adminCancelProductDraftAutosave;
    window.adminCancelCategoryDraftAutosave = adminCancelCategoryDraftAutosave;
    window.adminCrudDraftsMediaEnabled = adminCrudDraftsMediaEnabled;
    window.adminCrudDraftsClearAllEnabled = adminCrudDraftsClearAllEnabled;
    window.adminAutoSaveProductDraft = adminAutoSaveProductDraft;
    window.adminAutoSaveCategoryDraft = adminAutoSaveCategoryDraft;
    window.adminDraftPrepareProductFormForSave = adminDraftPrepareProductFormForSave;
    window.adminDraftHydrateProductForm = adminDraftHydrateProductForm;
    window.adminPromptUnsavedChoice = (msg, withDraft) => adminPromptUnsaved(msg, withDraft);
    window.adminDraftUpsert = adminDraftUpsert;
    window.adminDraftRemove = adminDraftRemove;
    window.adminDraftRemoveAll = adminDraftRemoveAll;
    window.adminDraftGetEntry = adminDraftGetEntry;
    window.adminDraftIsVisible = adminDraftIsVisible;
    window.adminDraftSetActive = adminDraftSetActive;
    window.adminDraftClearActive = adminDraftClearActive;
    window.adminGetVisibleProductDraft = adminGetVisibleProductDraft;
    window.adminGetVisibleCategoryDraft = adminGetVisibleCategoryDraft;
    window.adminGetOrphanedNewProductDraft = adminGetOrphanedNewProductDraft;
    window.adminGetOrphanedNewCategoryDraft = adminGetOrphanedNewCategoryDraft;
    window.adminGetProductEditDraftIdSet = adminGetProductEditDraftIdSet;
    window.adminGetCategoryEditDraftIdSet = adminGetCategoryEditDraftIdSet;
    window.scheduleAdminDraftUiRefresh = scheduleAdminDraftUiRefresh;
    window.updateAdminNewProductDraftBadge = updateAdminNewProductDraftBadge;
    window.adminDraftsStorageInfo = adminDraftsStorageInfo;
    window.adminDraftFormatAge = adminDraftFormatAge;
    window.adminDraftFormatBytes = adminDraftFormatBytes;
    window.adminDraftClear = adminDraftClear;
    window.adminDraftRead = adminDraftRead;
    window.adminDraftWrite = adminDraftWrite;
    window.renderAdminDraftRecoveryPanel = renderAdminDraftRecoveryPanel;
    window.updateSuperadminDraftStorageInfo = updateSuperadminDraftStorageInfo;
    window.adminAnyUnsavedDirty = adminAnyUnsavedDirty;

    window.adminGuardCategoryLeave = async function(message, next) {
        const modal = document.getElementById('category-modal');
        const open = modal && modal.style.display === 'flex';
        if (!open) {
            if (typeof next === 'function') await next();
            return true;
        }

        const dirty = typeof adminIsCategoryDirty === 'function' && adminIsCategoryDirty();
        if (!dirty) {
            if (typeof next === 'function') await next();
            return true;
        }

        const proceed = await adminHandleDirtyLeave(
            message || 'You have unsaved category changes.',
            {
                onSave: async () => {
                    if (typeof saveCategory !== 'function') return false;
                    await saveCategory();
                    return !(typeof adminIsCategoryDirty === 'function' && adminIsCategoryDirty());
                },
                onSaveDraft: async () => {
                    if (typeof saveCategoryAsDraft !== 'function') return false;
                    return await saveCategoryAsDraft(true);
                },
                onDiscard: () => { if (typeof discardCategoryDraft === 'function') discardCategoryDraft(true); }
            }
        );
        if (!proceed) return false;

        const stillOpen = document.getElementById('category-modal')?.style.display === 'flex';
        if (stillOpen && typeof next === 'function') await next();
        else if (typeof scheduleAdminDraftUiRefresh === 'function') scheduleAdminDraftUiRefresh();
        return true;
    };

    window.adminGuardProductLeave = async function(message, next) {
        const modal = document.getElementById('prod-modal');
        const open = modal && modal.style.display === 'flex';
        if (!open) {
            if (typeof next === 'function') await next();
            return true;
        }

        const dirty = typeof adminIsProductDirty === 'function' && adminIsProductDirty();
        if (!dirty) {
            if (typeof next === 'function') await next();
            return true;
        }

        const proceed = await adminHandleDirtyLeave(
            message || 'You have unsaved product changes.',
            {
                onSave: async () => {
                    if (typeof saveProduct !== 'function') return false;
                    await saveProduct();
                    return !(typeof adminIsProductDirty === 'function' && adminIsProductDirty());
                },
                onSaveDraft: async () => {
                    if (typeof saveProductAsDraft !== 'function') return false;
                    return await saveProductAsDraft(true);
                },
                onDiscard: () => { if (typeof discardProductDraft === 'function') discardProductDraft(true); }
            }
        );
        if (!proceed) return false;

        const stillOpen = document.getElementById('prod-modal')?.style.display === 'flex';
        if (stillOpen && typeof next === 'function') await next();
        else if (typeof scheduleAdminDraftUiRefresh === 'function') scheduleAdminDraftUiRefresh();
        return true;
    };

    window.adminTryNavigateAway = async function(targetView, navigateFn) {
        const prodOpen = document.getElementById('prod-modal')?.style.display === 'flex';
        if (prodOpen) {
            const ok = await adminGuardProductLeave('Save product changes before leaving?', () => {
                adminProductSnapshot = null;
                closeModal('prod-modal');
            });
            if (!ok) return false;
        }
        const catOpen = document.getElementById('category-modal')?.style.display === 'flex';
        if (catOpen) {
            const ok = await adminGuardCategoryLeave('Save category changes before leaving Admin?', () => {
                adminCategorySnapshot = null;
                window.editingCategoryId = null;
                if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
                if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
                closeModal('category-modal');
            });
            if (!ok) return false;
        }
        if (typeof navigateFn === 'function') navigateFn();
        return true;
    };

    window.adminScheduleCategoryDraftSave = function() {
        if (!adminCrudDraftsEnabled()) return;
        clearTimeout(categoryDraftTimer);
        categoryDraftTimer = setTimeout(() => {
            adminAutoSaveCategoryDraft({ silent: true });
        }, CATEGORY_AUTO_SAVE_MS);
    };

    window.adminScheduleProductDraftSave = function() {
        if (!adminCrudDraftsEnabled()) return;
        clearTimeout(productDraftTimer);
        productDraftTimer = setTimeout(() => {
            if (_productAutoSaveInFlight) return;
            _productAutoSaveInFlight = adminAutoSaveProductDraft({ silent: true })
                .catch(e => console.warn('adminAutoSaveProductDraft failed:', e))
                .finally(() => { _productAutoSaveInFlight = null; });
        }, PRODUCT_AUTO_SAVE_MS);
    };

    window.addEventListener('beforeunload', () => {
        if (typeof adminAutoSaveProductDraft === 'function') {
            adminAutoSaveProductDraft({ silent: true });
        } else if (typeof flushProductDraft === 'function') {
            flushProductDraft();
        }
        if (typeof adminAutoSaveCategoryDraft === 'function') {
            adminAutoSaveCategoryDraft({ silent: true });
        } else if (typeof flushCategoryDraft === 'function') {
            flushCategoryDraft();
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (adminAnyUnsavedDirty()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        adminDraftMigrateLegacy();
        renderAdminDraftRecoveryPanel();
        updateSuperadminDraftStorageInfo();
    });
})();
