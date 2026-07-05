// ==========================================
// SWAG STREE | ADMIN DRAFT COMPARE & SWITCH
// ==========================================

(function() {
    window._adminProductViewMode = window._adminProductViewMode || 'live';
    window._adminCategoryViewMode = window._adminCategoryViewMode || 'live';
    const _compareObjectUrls = [];

    function adminEscapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function adminFmtVal(v) {
        if (v === null || v === undefined || v === '') return '(empty)';
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        return String(v);
    }

    function adminFmtQty(v) {
        if (v === null || v === undefined || v === '') return '0';
        const n = Number(v);
        return Number.isFinite(n) ? String(n) : String(v);
    }

    function adminNormalizeCategoryIds(val) {
        if (Array.isArray(val)) return [...val].map(id => String(id || '').trim()).filter(Boolean).sort();
        return String(val || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean).sort();
    }

    function adminCategoryIdsEqual(a, b) {
        const na = adminNormalizeCategoryIds(a);
        const nb = adminNormalizeCategoryIds(b);
        if (na.length !== nb.length) return false;
        return na.every((id, i) => id === nb[i]);
    }

    function adminFormatCategoryLabels(val) {
        const ids = adminNormalizeCategoryIds(val);
        if (!ids.length) return '(none)';
        const names = ids.map(id => {
            const cat = typeof getCategoryById === 'function' ? getCategoryById(id) : null;
            return cat?.name || id;
        });
        return names.join(', ');
    }

    function adminProductDraftEntry(id) {
        const pid = id ?? (typeof editingId !== 'undefined' ? editingId : null);
        if (!pid || typeof adminDraftGetEntry !== 'function') return null;
        return adminDraftGetEntry('product', `edit:${pid}`);
    }

    function adminCategoryDraftEntry(id) {
        const cid = id ?? window.editingCategoryId;
        if (!cid || typeof adminDraftGetEntry !== 'function') return null;
        return adminDraftGetEntry('category', `edit:${cid}`);
    }

    function adminRevokeCompareObjectUrls() {
        _compareObjectUrls.forEach(url => {
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        });
        _compareObjectUrls.length = 0;
    }

    function adminTrackCompareObjectUrl(url) {
        if (url && String(url).startsWith('blob:')) _compareObjectUrls.push(url);
        return url;
    }

    function adminMediaItemPreviewUrl(item, isVideo) {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (item.url) return item.url;
        if (item.file instanceof File || item.file instanceof Blob) {
            return adminTrackCompareObjectUrl(URL.createObjectURL(item.file));
        }
        if (item.pendingFile || item.missingMedia || item.tooLarge) return '';
        if (item.draftMediaRef && typeof adminCrudDraftsMediaEnabled === 'function' && adminCrudDraftsMediaEnabled()) {
            return '';
        }
        return '';
    }

    function adminMediaPreviewList(arr, isVideo) {
        const urls = (arr || []).map(item => adminMediaItemPreviewUrl(item, isVideo)).filter(Boolean);
        return urls;
    }

    function adminRenderCompareMediaThumbs(urls, isVideo) {
        if (!urls.length) return '<span class="admin-draft-compare-media__empty">(none)</span>';
        return urls.map(url => {
            if (isVideo) {
                return `<span class="admin-draft-compare-media__thumb admin-draft-compare-media__thumb--video" title="Video"><i class="fa fa-play-circle"></i></span>`;
            }
            return `<img class="admin-draft-compare-media__thumb" src="${adminEscapeHtml(url)}" alt="" loading="lazy">`;
        }).join('');
    }

    function adminMediaCountLabel(count, noun) {
        const n = Number(count) || 0;
        return `${n} ${noun}${n === 1 ? '' : 's'}`;
    }

    function adminNormCompareText(val) {
        return String(val ?? '').replace(/\s+/g, ' ').trim();
    }

    function adminFmtLongCompareText(val, maxLen) {
        const n = adminNormCompareText(val);
        if (!n) return '(empty)';
        const max = maxLen || 320;
        return n.length > max ? `${n.slice(0, max)}…` : n;
    }

    function adminDraftDescription(draft) {
        return draft?.desc ?? draft?.description ?? '';
    }

    function adminBuildProductCompareRows(live, draft, liveProduct, draftHydrated) {
        if (!live || !draft) return [];
        const rows = [];
        const showMediaPreview = typeof adminCrudDraftsMediaEnabled === 'function' && adminCrudDraftsMediaEnabled();
        const add = (field, label, liveVal, draftVal, extra) => {
            const l = adminFmtVal(liveVal);
            const d = adminFmtVal(draftVal);
            if (l !== d) rows.push({ field, label, live: l, draft: d, ...extra });
        };
        add('name', 'Name', live.name, draft.name);
        add('price', 'Price', live.price, draft.price);
        const liveDesc = adminNormCompareText(live.desc);
        const draftDesc = adminNormCompareText(adminDraftDescription(draft));
        if (liveDesc !== draftDesc) {
            rows.push({
                field: 'desc',
                label: 'Description',
                live: adminFmtLongCompareText(live.desc),
                draft: adminFmtLongCompareText(adminDraftDescription(draft))
            });
        }
        if (!adminCategoryIdsEqual(live.categoryIds, draft.categoryIds)) {
            rows.push({
                field: 'categories',
                label: 'Categories',
                live: adminFormatCategoryLabels(live.categoryIds),
                draft: adminFormatCategoryLabels(draft.categoryIds)
            });
        }
        add('hideMain', 'Hide main carousel', live.hideMain, draft.hideMain);
        add('hideMainDet', 'Hide details carousel', live.hideMainDet, draft.hideMainDet);
        add('mainPos', 'Main image position', live.mainPos, draft.mainPos);
        add('hidePlaceholder', 'Hide placeholder', live.hidePlaceholder, draft.hidePlaceholder);
        add('is360', 'Rotate 360°', live.is360, draft.is360);
        add('is360Pano', 'Look around panorama', live.is360Pano, draft.is360Pano);
        add('trackGlobal', 'Track global stock', live.trackGlobal, draft.trackGlobal);
        const liveQty = adminFmtQty(live.globalQty);
        const draftQty = adminFmtQty(draft.globalQty);
        if (liveQty !== draftQty) {
            rows.push({ field: 'globalQty', label: 'Global stock qty', live: liveQty, draft: draftQty });
        }

        const draftForm = draftHydrated || draft;
        const draftImg = (draftForm.images || []).length;
        const draftSpin = (draftForm.spins || []).length;
        const draftPano = (draftForm.panos || []).length;
        const draftVid = (draftForm.videos || []).length;
        const draftVar = (draftForm.variants || []).length;

        const mediaDefs = [
            { field: 'images', label: 'Gallery images', liveCount: live.imageCount, draftCount: draftImg, liveArr: liveProduct?.images, draftArr: draftForm.images, isVideo: false },
            { field: 'spins', label: 'Rotation frames', liveCount: live.spinCount, draftCount: draftSpin, liveArr: liveProduct?.spinImages, draftArr: draftForm.spins, isVideo: false },
            { field: 'panos', label: 'Panorama images', liveCount: live.panoCount, draftCount: draftPano, liveArr: liveProduct?.panoramaImages, draftArr: draftForm.panos, isVideo: false },
            { field: 'videos', label: 'Videos', liveCount: live.videoCount, draftCount: draftVid, liveArr: liveProduct?.videos, draftArr: draftForm.videos, isVideo: true }
        ];

        mediaDefs.forEach(def => {
            const liveCount = Number(def.liveCount) || 0;
            const draftCount = Number(def.draftCount) || 0;
            const rowExtra = {};
            if (showMediaPreview) {
                rowExtra.liveThumbs = adminMediaPreviewList(def.liveArr, def.isVideo);
                rowExtra.draftThumbs = adminMediaPreviewList(def.draftArr, def.isVideo);
                rowExtra.isVideo = def.isVideo;
            }
            const thumbsDiffer = showMediaPreview && rowExtra.liveThumbs?.join('|') !== rowExtra.draftThumbs?.join('|');
            if (liveCount === draftCount && !thumbsDiffer && !draft.hasPendingFiles && !draftForm.hasPendingFiles) return;
            rows.push({
                field: def.field,
                label: def.label,
                live: adminMediaCountLabel(liveCount, def.isVideo ? 'video' : 'image'),
                draft: adminMediaCountLabel(draftCount, def.isVideo ? 'video' : 'image'),
                ...rowExtra
            });
        });

        add('variants', 'Variants', live.variantCount, draftVar);
        if (draft.hasPendingFiles || draftForm.hasPendingFiles) {
            rows.push({ field: 'media', label: 'Uploaded files', live: 'Actual (live) URLs only', draft: 'Pending uploads in draft' });
        }
        return rows;
    }

    function adminNormSortOrder(v) {
        const n = parseInt(v, 10);
        return String(Number.isFinite(n) ? n : 0);
    }

    function adminBuildCategoryCompareRows(live, draft) {
        if (!live || !draft) return [];
        const rows = [];
        const add = (field, label, liveVal, draftVal) => {
            const l = adminFmtVal(liveVal);
            const d = adminFmtVal(draftVal);
            if (l !== d) rows.push({ field, label, live: l, draft: d });
        };
        add('name', 'Name', live.name, draft.name);
        add('sortOrder', 'Display order', adminNormSortOrder(live.sortOrder), adminNormSortOrder(draft.sortOrder));
        add('isActive', 'Active on storefront', live.isActive, draft.isActive);
        return rows;
    }

    function adminProductEditDraftHasUnpublishedChanges(productId, opts) {
        if (!productId || typeof adminCrudDraftsEnabled !== 'function' || !adminCrudDraftsEnabled()) return false;
        const key = `edit:${productId}`;
        if (typeof adminDraftIsVisible !== 'function' || !adminDraftIsVisible('product', key)) return false;
        const item = typeof adminDraftGetEntry === 'function' ? adminDraftGetEntry('product', key) : null;
        if (!item?.entry?.form) return false;
        const draft = item.entry.form;
        if (draft.hasPendingFiles) return true;
        if (typeof adminBuildLiveProductSnapshot !== 'function') return true;
        const p = (typeof products !== 'undefined' ? products : []).find(x => x.id === productId);
        if (!p) return true;
        const live = adminBuildLiveProductSnapshot(p);
        const rows = adminBuildProductCompareRows(live, draft, p, draft);
        if (!rows.length) {
            if (!(opts && opts.skipPrune) && typeof adminDraftRemove === 'function') {
                adminDraftRemove('product', key);
            }
            return false;
        }
        return true;
    }

    function adminCategoryEditDraftHasUnpublishedChanges(categoryId, opts) {
        if (!categoryId || typeof adminCrudDraftsEnabled !== 'function' || !adminCrudDraftsEnabled()) return false;
        const key = `edit:${categoryId}`;
        if (typeof adminDraftIsVisible !== 'function' || !adminDraftIsVisible('category', key)) return false;
        const item = typeof adminDraftGetEntry === 'function' ? adminDraftGetEntry('category', key) : null;
        if (!item?.entry?.form) return false;
        if (typeof adminBuildLiveCategorySnapshot !== 'function' || typeof getCategoryById !== 'function') return true;
        const cat = getCategoryById(categoryId);
        if (!cat) return true;
        const live = adminBuildLiveCategorySnapshot(cat);
        const rows = adminBuildCategoryCompareRows(live, item.entry.form);
        if (!rows.length) {
            if (!(opts && opts.skipPrune) && typeof adminDraftRemove === 'function') {
                adminDraftRemove('category', key);
            }
            return false;
        }
        return true;
    }

    window.adminProductEditDraftHasUnpublishedChanges = adminProductEditDraftHasUnpublishedChanges;
    window.adminCategoryEditDraftHasUnpublishedChanges = adminCategoryEditDraftHasUnpublishedChanges;

    function adminRenderCompareModal(title, rows, viewingMode) {
        const modal = document.getElementById('admin-draft-compare-modal');
        const body = document.getElementById('admin-draft-compare-body');
        const titleEl = document.getElementById('admin-draft-compare-title');
        if (!modal || !body) return;
        adminRevokeCompareObjectUrls();
        if (titleEl) titleEl.textContent = title;
        if (!rows.length) {
            body.innerHTML = '<p class="admin-draft-compare-empty">No differences — draft matches what is live on the storefront.</p>';
        } else {
            const modeNote = viewingMode === 'draft'
                ? 'You are viewing the <strong>draft</strong>. Below: what is <strong>live now</strong> vs your <strong>saved draft</strong>.'
                : 'You are viewing the <strong>actual (live)</strong> version. Below: what is <strong>live now</strong> vs your <strong>saved draft</strong>.';
            body.innerHTML = `
                <p class="admin-draft-compare-intro">${modeNote}</p>
                <div class="admin-draft-compare-list">
                    ${rows.map(r => `
                    <div class="admin-draft-compare-card">
                        <div class="admin-draft-compare-card__field">${adminEscapeHtml(r.label)}</div>
                        <div class="admin-draft-compare-card__cols">
                            <div class="admin-draft-compare-col admin-draft-compare-col--actual">
                                <span class="admin-draft-compare-col__label">Actual (live)</span>
                                <span class="admin-draft-compare-col__value">${adminEscapeHtml(r.live)}</span>
                                ${r.liveThumbs ? `<div class="admin-draft-compare-media">${adminRenderCompareMediaThumbs(r.liveThumbs, r.isVideo)}</div>` : ''}
                            </div>
                            <div class="admin-draft-compare-col admin-draft-compare-col--draft">
                                <span class="admin-draft-compare-col__label">Draft (saved)</span>
                                <span class="admin-draft-compare-col__value">${adminEscapeHtml(r.draft)}</span>
                                ${r.draftThumbs ? `<div class="admin-draft-compare-media">${adminRenderCompareMediaThumbs(r.draftThumbs, r.isVideo)}</div>` : ''}
                            </div>
                        </div>
                    </div>`).join('')}
                </div>`;
        }
        modal.style.display = 'flex';
    }

    function adminGetSavedProductDraftForm() {
        const entry = adminProductDraftEntry(editingId);
        if (entry?.entry?.form) return { ...entry.entry.form };
        return null;
    }

    function adminGetSavedCategoryDraftForm() {
        const entry = adminCategoryDraftEntry(window.editingCategoryId);
        if (entry?.entry?.form) return { ...entry.entry.form };
        return null;
    }

    async function adminMaybeSaveDirtyDraftBeforeCompare(entity) {
        const inDraftView = entity === 'product'
            ? window._adminProductViewMode === 'draft'
            : window._adminCategoryViewMode === 'draft';
        if (!inDraftView) return;
        if (entity === 'product') {
            if (typeof adminIsProductDirty === 'function' && adminIsProductDirty() && typeof adminAutoSaveProductDraft === 'function') {
                await adminAutoSaveProductDraft({ silent: true, force: true });
            }
            return;
        }
        if (typeof adminIsCategoryDirty === 'function' && adminIsCategoryDirty() && typeof adminAutoSaveCategoryDraft === 'function') {
            await adminAutoSaveCategoryDraft({ silent: true, force: true });
        }
    }

    window.adminOpenProductDraftCompare = async function() {
        if (!editingId || typeof adminBuildLiveProductSnapshot !== 'function') return;
        await adminMaybeSaveDirtyDraftBeforeCompare('product');
        const p = (products || []).find(x => x.id === editingId);
        const live = adminBuildLiveProductSnapshot(p);
        let draft = adminGetSavedProductDraftForm();
        if (!draft) return showToast('No saved draft to compare.');
        let draftHydrated = draft;
        if (typeof adminDraftHydrateProductForm === 'function' &&
            typeof adminCrudDraftsMediaEnabled === 'function' && adminCrudDraftsMediaEnabled()) {
            try {
                draftHydrated = await adminDraftHydrateProductForm(draft);
            } catch (e) {
                console.warn('adminDraftHydrateProductForm compare failed:', e);
            }
        }
        const rows = adminBuildProductCompareRows(live, draft, p, draftHydrated);
        adminRenderCompareModal('Product — actual vs draft', rows, window._adminProductViewMode);
        if (typeof adminRenderProductDraftSwitcher === 'function') adminRenderProductDraftSwitcher();
    };

    window.adminOpenCategoryDraftCompare = async function() {
        if (!window.editingCategoryId || typeof getCategoryById !== 'function') return;
        await adminMaybeSaveDirtyDraftBeforeCompare('category');
        const cat = getCategoryById(window.editingCategoryId);
        const live = typeof adminBuildLiveCategorySnapshot === 'function' ? adminBuildLiveCategorySnapshot(cat) : null;
        const draft = adminGetSavedCategoryDraftForm();
        if (!draft) return showToast('No saved draft to compare.');
        const rows = adminBuildCategoryCompareRows(live, draft);
        adminRenderCompareModal('Category — actual vs draft', rows, window._adminCategoryViewMode);
        if (typeof adminRenderCategoryDraftSwitcher === 'function') adminRenderCategoryDraftSwitcher();
    };

    function adminUpdateProductSwitcherUi() {
        const wrap = document.getElementById('admin-product-draft-switcher');
        if (!wrap) return;
        const hasDraft = !!adminProductDraftEntry(editingId);
        const show = !!editingId && hasDraft;
        wrap.hidden = !show;
        if (!show) return;
        const liveBtn = document.getElementById('admin-product-view-live');
        const draftBtn = document.getElementById('admin-product-view-draft');
        const mode = window._adminProductViewMode || 'live';
        if (liveBtn) liveBtn.classList.toggle('is-active', mode === 'live');
        if (draftBtn) draftBtn.classList.toggle('is-active', mode === 'draft');
        const compareBtn = document.getElementById('admin-product-compare-btn');
        if (compareBtn) compareBtn.disabled = !hasDraft;
    }

    function adminUpdateCategorySwitcherUi() {
        const wrap = document.getElementById('admin-category-draft-switcher');
        if (!wrap) return;
        const hasDraft = !!adminCategoryDraftEntry(window.editingCategoryId);
        const show = !!window.editingCategoryId && hasDraft;
        wrap.hidden = !show;
        if (!show) return;
        const liveBtn = document.getElementById('admin-category-view-live');
        const draftBtn = document.getElementById('admin-category-view-draft');
        const mode = window._adminCategoryViewMode || 'live';
        if (liveBtn) liveBtn.classList.toggle('is-active', mode === 'live');
        if (draftBtn) draftBtn.classList.toggle('is-active', mode === 'draft');
        const compareBtn = document.getElementById('admin-category-compare-btn');
        if (compareBtn) compareBtn.disabled = !hasDraft;
    }

    window.adminRenderProductDraftSwitcher = adminUpdateProductSwitcherUi;
    window.adminRenderCategoryDraftSwitcher = adminUpdateCategorySwitcherUi;

    async function adminSwitchProductView(mode) {
        if (!editingId) return;
        if (mode === window._adminProductViewMode) return;

        if (window._adminProductViewMode === 'draft' && mode === 'live') {
            if (typeof adminIsProductDirty === 'function' && adminIsProductDirty() && typeof adminAutoSaveProductDraft === 'function') {
                await adminAutoSaveProductDraft({ silent: true, force: true });
            }
        }

        if (mode === 'draft') {
            const entry = adminProductDraftEntry(editingId);
            if (!entry?.entry?.form) return showToast('No draft saved for this product.');
            const p = (products || []).find(x => x.id === editingId);
            window._adminProductLiveBaseline = typeof adminBuildLiveProductSnapshot === 'function' ? adminBuildLiveProductSnapshot(p) : null;
            let form = entry.entry.form;
            if (typeof adminDraftHydrateProductForm === 'function' && typeof adminCrudDraftsMediaEnabled === 'function' && adminCrudDraftsMediaEnabled()) {
                try { form = await adminDraftHydrateProductForm(form); } catch (e) { console.warn(e); }
            }
            if (typeof applyProductDraftForm === 'function') applyProductDraftForm(form);
            window._adminProductViewMode = 'draft';
            window._adminProductDraftLoaded = true;
            if (typeof adminActivateProductDraftUi === 'function') adminActivateProductDraftUi('edit');
            if (typeof adminDraftSetActive === 'function') adminDraftSetActive('product', `edit:${editingId}`);
            if (typeof adminSyncProductDraftFieldUi === 'function') adminSyncProductDraftFieldUi();
            showToast('Showing saved draft — switch to Actual anytime.');
        } else {
            const p = (products || []).find(x => x.id === editingId);
            if (!p) return showToast('Product not found.');
            if (typeof adminApplyLiveProductToForm === 'function') adminApplyLiveProductToForm(p);
            window._adminProductViewMode = 'live';
            window._adminProductDraftLoaded = false;
            if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
            window._adminProductLiveBaseline = typeof adminBuildLiveProductSnapshot === 'function' ? adminBuildLiveProductSnapshot(p) : null;
            if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
            if (typeof adminSyncProductEditDraftUi === 'function') adminSyncProductEditDraftUi();
            showToast('Showing actual (live) version.');
        }
        if (typeof renderProductModalDraftBanner === 'function') renderProductModalDraftBanner();
        if (typeof adminResetProductSnapshot === 'function') adminResetProductSnapshot();
        adminUpdateProductSwitcherUi();
    }

    async function adminSwitchCategoryView(mode) {
        if (!window.editingCategoryId) return;
        if (mode === window._adminCategoryViewMode) return;

        if (window._adminCategoryViewMode === 'draft' && mode === 'live') {
            if (typeof adminIsCategoryDirty === 'function' && adminIsCategoryDirty() && typeof adminAutoSaveCategoryDraft === 'function') {
                await adminAutoSaveCategoryDraft({ silent: true, force: true });
            }
        }

        if (mode === 'draft') {
            const entry = adminCategoryDraftEntry(window.editingCategoryId);
            if (!entry?.entry?.form) return showToast('No draft saved for this category.');
            const cat = typeof getCategoryById === 'function' ? getCategoryById(window.editingCategoryId) : null;
            window._adminCategoryLiveBaseline = typeof adminBuildLiveCategorySnapshot === 'function' ? adminBuildLiveCategorySnapshot(cat) : null;
            if (typeof applyCategoryFormState === 'function') applyCategoryFormState(entry.entry.form, true);
            if (typeof adminDraftSetActive === 'function') adminDraftSetActive('category', `edit:${window.editingCategoryId}`);
            window._adminCategoryViewMode = 'draft';
            window._adminCategoryDraftLoaded = true;
            if (typeof adminSyncCategoryDraftFieldUi === 'function') adminSyncCategoryDraftFieldUi();
            showToast('Showing saved draft — switch to Actual anytime.');
        } else {
            const cat = typeof getCategoryById === 'function' ? getCategoryById(window.editingCategoryId) : null;
            if (!cat) return showToast('Category not found.');
            if (typeof adminApplyLiveCategoryToForm === 'function') adminApplyLiveCategoryToForm(cat);
            window._adminCategoryViewMode = 'live';
            window._adminCategoryDraftLoaded = false;
            if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
            window._adminCategoryLiveBaseline = typeof adminBuildLiveCategorySnapshot === 'function' ? adminBuildLiveCategorySnapshot(cat) : null;
            if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
            if (typeof adminSyncCategoryEditDraftUi === 'function') adminSyncCategoryEditDraftUi();
            showToast('Showing actual (live) version.');
        }
        if (typeof renderCategoryModalDraftBanner === 'function') renderCategoryModalDraftBanner();
        if (typeof adminResetCategorySnapshot === 'function') adminResetCategorySnapshot();
        adminUpdateCategorySwitcherUi();
    }

    window.adminSwitchProductView = adminSwitchProductView;
    window.adminSwitchCategoryView = adminSwitchCategoryView;
    window.adminLoadOriginalProduct = function() { adminSwitchProductView('live'); };
    window.adminLoadOriginalCategory = function() { adminSwitchCategoryView('live'); };

    document.addEventListener('DOMContentLoaded', () => {
        const origCloseModal = window.closeModal;
        if (typeof origCloseModal !== 'function') return;
        window.closeModal = function(id) {
            if (id === 'admin-draft-compare-modal') adminRevokeCompareObjectUrls();
            return origCloseModal(id);
        };
    });
})();
