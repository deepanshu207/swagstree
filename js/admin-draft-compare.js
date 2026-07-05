// ==========================================
// SWAG STREE | ADMIN DRAFT COMPARE & SWITCH
// ==========================================

(function() {
    window._adminProductViewMode = window._adminProductViewMode || 'live';
    window._adminCategoryViewMode = window._adminCategoryViewMode || 'live';

    function adminFmtVal(v) {
        if (v === null || v === undefined || v === '') return '(empty)';
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        return String(v);
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

    function adminBuildProductCompareRows(live, draft) {
        if (!live || !draft) return [];
        const rows = [];
        const add = (field, label, liveVal, draftVal) => {
            const l = adminFmtVal(liveVal);
            const d = adminFmtVal(draftVal);
            if (l !== d) rows.push({ field, label, live: l, draft: d });
        };
        add('name', 'Name', live.name, draft.name);
        add('price', 'Price', live.price, draft.price);
        add('desc', 'Description', live.desc, (draft.desc || '').slice(0, 80));
        const draftCatIds = Array.isArray(draft.categoryIds)
            ? [...draft.categoryIds].sort().join(', ')
            : String(draft.categoryIds || '').split(',').filter(Boolean).sort().join(', ');
        add('categories', 'Categories', live.categoryIds, draftCatIds);
        add('hideMain', 'Hide main carousel', live.hideMain, draft.hideMain);
        add('hideMainDet', 'Hide details carousel', live.hideMainDet, draft.hideMainDet);
        add('mainPos', 'Main image position', live.mainPos, draft.mainPos);
        add('hidePlaceholder', 'Hide placeholder', live.hidePlaceholder, draft.hidePlaceholder);
        add('is360', 'Rotate 360°', live.is360, draft.is360);
        add('is360Pano', 'Look around panorama', live.is360Pano, draft.is360Pano);
        add('trackGlobal', 'Track global stock', live.trackGlobal, draft.trackGlobal);
        add('globalQty', 'Global stock qty', live.globalQty, draft.globalQty);
        const draftImg = (draft.images || []).length;
        const draftSpin = (draft.spins || []).length;
        const draftPano = (draft.panos || []).length;
        const draftVid = (draft.videos || []).length;
        const draftVar = (draft.variants || []).length;
        add('images', 'Gallery images', live.imageCount, draftImg);
        add('spins', 'Rotation frames', live.spinCount, draftSpin);
        add('panos', 'Panorama images', live.panoCount, draftPano);
        add('videos', 'Videos', live.videoCount, draftVid);
        add('variants', 'Variants', live.variantCount, draftVar);
        if (draft.hasPendingFiles) {
            rows.push({ field: 'media', label: 'Uploaded files', live: 'Published URLs only', draft: 'Pending uploads in draft' });
        }
        return rows;
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
        add('sortOrder', 'Display order', live.sortOrder, draft.sortOrder);
        add('isActive', 'Active on storefront', live.isActive, draft.isActive);
        return rows;
    }

    function adminRenderCompareModal(title, rows, viewingMode) {
        const modal = document.getElementById('admin-draft-compare-modal');
        const body = document.getElementById('admin-draft-compare-body');
        const titleEl = document.getElementById('admin-draft-compare-title');
        if (!modal || !body) return;
        if (titleEl) titleEl.textContent = title;
        if (!rows.length) {
            body.innerHTML = '<p class="admin-draft-compare-empty">No differences — draft matches the published version.</p>';
        } else {
            const modeNote = viewingMode === 'draft'
                ? 'You are viewing the <strong>draft</strong>. Amber rows differ from what is live on the storefront.'
                : 'You are viewing the <strong>published</strong> version. Amber rows differ from your saved draft.';
            body.innerHTML = `
                <p class="admin-draft-compare-intro">${modeNote}</p>
                <div class="admin-draft-compare-table">
                    <div class="admin-draft-compare-row admin-draft-compare-row--head">
                        <span>Field</span><span>Published</span><span>Draft</span>
                    </div>
                    ${rows.map(r => `
                    <div class="admin-draft-compare-row">
                        <span class="admin-draft-compare-field">${r.label}</span>
                        <span class="admin-draft-compare-live">${r.live}</span>
                        <span class="admin-draft-compare-draft">${r.draft}</span>
                    </div>`).join('')}
                </div>`;
        }
        modal.style.display = 'flex';
    }

    function adminGetSavedProductDraftForm() {
        const entry = adminProductDraftEntry(editingId);
        if (entry?.entry?.form) return entry.entry.form;
        if (window._adminProductViewMode === 'draft' && typeof adminBuildProductDraftPayload === 'function') {
            return adminBuildProductDraftPayload();
        }
        return null;
    }

    function adminGetSavedCategoryDraftForm() {
        const entry = adminCategoryDraftEntry(window.editingCategoryId);
        if (entry?.entry?.form) return entry.entry.form;
        if (window._adminCategoryViewMode === 'draft' && typeof serializeCategoryFormState === 'function') {
            return serializeCategoryFormState();
        }
        return null;
    }

    window.adminOpenProductDraftCompare = async function() {
        if (!editingId || typeof adminBuildLiveProductSnapshot !== 'function') return;
        if (typeof adminAutoSaveProductDraft === 'function') {
            await adminAutoSaveProductDraft({ silent: true, force: true });
        } else if (typeof flushProductDraft === 'function') {
            flushProductDraft();
        }
        const p = (products || []).find(x => x.id === editingId);
        const live = adminBuildLiveProductSnapshot(p);
        const draft = adminGetSavedProductDraftForm();
        if (!draft) return showToast('No draft to compare.');
        const rows = adminBuildProductCompareRows(live, draft);
        adminRenderCompareModal('Product — published vs draft', rows, window._adminProductViewMode);
        if (typeof adminRenderProductDraftSwitcher === 'function') adminRenderProductDraftSwitcher();
    };

    window.adminOpenCategoryDraftCompare = async function() {
        if (!window.editingCategoryId || typeof getCategoryById !== 'function') return;
        if (typeof adminAutoSaveCategoryDraft === 'function') {
            await adminAutoSaveCategoryDraft({ silent: true, force: true });
        } else if (typeof flushCategoryDraft === 'function') {
            flushCategoryDraft({ force: true });
        }
        const cat = getCategoryById(window.editingCategoryId);
        const live = typeof adminBuildLiveCategorySnapshot === 'function' ? adminBuildLiveCategorySnapshot(cat) : null;
        const draft = adminGetSavedCategoryDraftForm();
        if (!draft) return showToast('No draft to compare.');
        const rows = adminBuildCategoryCompareRows(live, draft);
        adminRenderCompareModal('Category — published vs draft', rows, window._adminCategoryViewMode);
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
        if (typeof flushProductDraft === 'function') flushProductDraft();
        if (mode === 'draft') {
            const entry = adminProductDraftEntry(editingId);
            if (!entry?.entry?.form) return showToast('No draft saved for this product.');
            let form = entry.entry.form;
            if (typeof adminDraftHydrateProductForm === 'function' && typeof adminCrudDraftsMediaEnabled === 'function' && adminCrudDraftsMediaEnabled()) {
                try { form = await adminDraftHydrateProductForm(form); } catch (e) { console.warn(e); }
            }
            if (typeof applyProductDraftForm === 'function') applyProductDraftForm(form);
            window._adminProductViewMode = 'draft';
            window._adminProductDraftLoaded = true;
            if (typeof adminActivateProductDraftUi === 'function') adminActivateProductDraftUi('edit');
            if (typeof adminDraftSetActive === 'function') adminDraftSetActive('product', `edit:${editingId}`);
            showToast('Showing draft — switch to Published anytime.');
        } else {
            const p = (products || []).find(x => x.id === editingId);
            if (!p) return showToast('Product not found.');
            if (typeof adminApplyLiveProductToForm === 'function') adminApplyLiveProductToForm(p);
            window._adminProductViewMode = 'live';
            window._adminProductDraftLoaded = false;
            if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
            window._adminProductLiveBaseline = typeof adminBuildLiveProductSnapshot === 'function' ? adminBuildLiveProductSnapshot(p) : null;
            if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
            showToast('Showing published version.');
        }
        if (typeof renderProductModalDraftBanner === 'function') renderProductModalDraftBanner();
        if (typeof adminResetProductSnapshot === 'function') adminResetProductSnapshot();
        adminUpdateProductSwitcherUi();
    }

    async function adminSwitchCategoryView(mode) {
        if (!window.editingCategoryId) return;
        if (mode === window._adminCategoryViewMode) return;
        if (typeof flushCategoryDraft === 'function') flushCategoryDraft({ force: true });
        if (mode === 'draft') {
            const entry = adminCategoryDraftEntry(window.editingCategoryId);
            if (!entry?.entry?.form) return showToast('No draft saved for this category.');
            if (typeof applyCategoryFormState === 'function') applyCategoryFormState(entry.entry.form, true);
            if (typeof adminDraftSetActive === 'function') adminDraftSetActive('category', `edit:${window.editingCategoryId}`);
            window._adminCategoryViewMode = 'draft';
            showToast('Showing draft — switch to Published anytime.');
        } else {
            const cat = typeof getCategoryById === 'function' ? getCategoryById(window.editingCategoryId) : null;
            if (!cat) return showToast('Category not found.');
            if (typeof adminApplyLiveCategoryToForm === 'function') adminApplyLiveCategoryToForm(cat);
            window._adminCategoryViewMode = 'live';
            window._adminCategoryDraftLoaded = false;
            if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
            window._adminCategoryLiveBaseline = typeof adminBuildLiveCategorySnapshot === 'function' ? adminBuildLiveCategorySnapshot(cat) : null;
            if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
            showToast('Showing published version.');
        }
        if (typeof renderCategoryModalDraftBanner === 'function') renderCategoryModalDraftBanner();
        if (typeof adminResetCategorySnapshot === 'function') adminResetCategorySnapshot();
        adminUpdateCategorySwitcherUi();
    }

    window.adminSwitchProductView = adminSwitchProductView;
    window.adminSwitchCategoryView = adminSwitchCategoryView;
    window.adminLoadOriginalProduct = function() { adminSwitchProductView('live'); };
    window.adminLoadOriginalCategory = function() { adminSwitchCategoryView('live'); };
})();
