// ==========================================
// SWAG STREE | ADMIN DRAFT COMPARE & SWITCH
// ==========================================

(function() {
    window._adminProductViewMode = window._adminProductViewMode || 'live';
    window._adminCategoryViewMode = window._adminCategoryViewMode || 'live';

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
        add('desc', 'Description', live.desc, (draft.desc || '').slice(0, 120));
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
            rows.push({ field: 'media', label: 'Uploaded files', live: 'Actual (live) URLs only', draft: 'Pending uploads in draft' });
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
                            </div>
                            <div class="admin-draft-compare-col admin-draft-compare-col--draft">
                                <span class="admin-draft-compare-col__label">Draft (saved)</span>
                                <span class="admin-draft-compare-col__value">${adminEscapeHtml(r.draft)}</span>
                            </div>
                        </div>
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
        adminRenderCompareModal('Product — actual vs draft', rows, window._adminProductViewMode);
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
            showToast('Showing draft — switch to Actual anytime.');
        } else {
            const p = (products || []).find(x => x.id === editingId);
            if (!p) return showToast('Product not found.');
            if (typeof adminApplyLiveProductToForm === 'function') adminApplyLiveProductToForm(p);
            window._adminProductViewMode = 'live';
            window._adminProductDraftLoaded = false;
            if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
            window._adminProductLiveBaseline = typeof adminBuildLiveProductSnapshot === 'function' ? adminBuildLiveProductSnapshot(p) : null;
            if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
            showToast('Showing actual (live) version.');
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
            showToast('Showing draft — switch to Actual anytime.');
        } else {
            const cat = typeof getCategoryById === 'function' ? getCategoryById(window.editingCategoryId) : null;
            if (!cat) return showToast('Category not found.');
            if (typeof adminApplyLiveCategoryToForm === 'function') adminApplyLiveCategoryToForm(cat);
            window._adminCategoryViewMode = 'live';
            window._adminCategoryDraftLoaded = false;
            if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
            window._adminCategoryLiveBaseline = typeof adminBuildLiveCategorySnapshot === 'function' ? adminBuildLiveCategorySnapshot(cat) : null;
            if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
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
})();
