// ==========================================
// SWAG STREE | PRODUCT CATEGORIES
// ==========================================

window.productCategories = window.productCategories || [];
window.filterActiveCategory = window.filterActiveCategory || '';
window.homeFilterActiveCategories = window.homeFilterActiveCategories || [];
window.wishFilterActiveCategories = window.wishFilterActiveCategories || [];
window.categoriesLoaded = false;

if (window.filterActiveCategory && !window.homeFilterActiveCategories.length) {
    window.homeFilterActiveCategories = [window.filterActiveCategory];
}

function normalizeCategoryFilterIds(ids) {
    return [...new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean))];
}

function getCategoryFiltersForView(view) {
    return view === 'wishlist' ? window.wishFilterActiveCategories : window.homeFilterActiveCategories;
}

function setCategoryFiltersForView(view, ids) {
    const normalized = normalizeCategoryFilterIds(ids);
    if (view === 'wishlist') {
        window.wishFilterActiveCategories = normalized;
    } else {
        window.homeFilterActiveCategories = normalized;
        window.filterActiveCategory = normalized[0] || '';
        if (typeof filterActiveCategory !== 'undefined') filterActiveCategory = window.filterActiveCategory;
    }
}

function isCategoryBarEnabledForView(view) {
    if (!isProductCategoriesEnabled()) return false;
    return typeof isCatalogControlEnabled === 'function' && isCatalogControlEnabled(view, 'categories');
}

function productMatchesCategoryFilters(product, categoryIds) {
    const ids = normalizeCategoryFilterIds(categoryIds);
    if (!ids.length) return true;
    return ids.some(id => productHasCategory(product, id));
}
window.productMatchesCategoryFilters = productMatchesCategoryFilters;

function toggleCategoryFilterForView(view, categoryId) {
    const current = [...getCategoryFiltersForView(view)];
    if (!categoryId) {
        setCategoryFiltersForView(view, []);
        return;
    }
    const idx = current.indexOf(categoryId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(categoryId);
    setCategoryFiltersForView(view, current);
}

function renderCategoryBarForView(view, barId) {
    const bar = document.getElementById(barId);
    if (!bar) return;

    if (!isCategoryBarEnabledForView(view)) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
    }

    const categories = getActiveCategories();
    if (!categories.length) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
    }

    const counts = getProductCountsByCategory();
    const uncategorizedCount = counts[''] || 0;
    const activeIds = getCategoryFiltersForView(view);
    const toggleFn = view === 'wishlist' ? 'toggleWishCategoryFilter' : 'toggleHomeCategoryFilter';

    let html = `<button type="button" class="category-pill${activeIds.length === 0 ? ' active' : ''}" onclick="${toggleFn}('')">All</button>`;
    categories.forEach(cat => {
        const count = counts[cat.id] || 0;
        html += `<button type="button" class="category-pill${activeIds.includes(cat.id) ? ' active' : ''}" onclick="${toggleFn}('${cat.id}')">${escapeCategoryHtml(cat.name)}${count ? `<span class="category-pill-count">${count}</span>` : ''}</button>`;
    });
    const showUncategorizedHint = typeof isAdmin !== 'undefined' && isAdmin && view === 'home';
    if (showUncategorizedHint && uncategorizedCount > 0 && activeIds.length === 0) {
        html += `<span class="category-pill-hint">${uncategorizedCount} uncategorized</span>`;
    }

    bar.innerHTML = html;
    bar.style.display = 'flex';
}

function isProductCategoriesEnabled() {
    return !!(window.APP_FEATURES && window.APP_FEATURES.productCategories !== false);
}
window.isProductCategoriesEnabled = isProductCategoriesEnabled;

function slugifyCategoryName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'category';
}

function parseCategorySortOrder(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function getCategorySortOrder(cat) {
    return parseCategorySortOrder(cat?.sortOrder, 0);
}

function compareCategoriesByOrder(a, b) {
    const orderDiff = getCategorySortOrder(a) - getCategorySortOrder(b);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function getNextCategorySortOrder() {
    const orders = (window.productCategories || []).map(getCategorySortOrder);
    return orders.length ? Math.max(...orders) + 1 : 0;
}

function isAdminCategoryInlineEditing() {
    const active = document.activeElement;
    return !!(active && active.classList && active.classList.contains('admin-category-inline-input'));
}

window.inlineEditingCategoryId = window.inlineEditingCategoryId || null;
window._inlineCategoryBaseline = window._inlineCategoryBaseline || null;
window._adminCategoryLiveBaseline = window._adminCategoryLiveBaseline || null;
window._adminCategoryDraftUiActive = window._adminCategoryDraftUiActive || false;

let _categoryDraftUiTimer = null;

function adminBuildLiveCategorySnapshot(cat) {
    if (!cat) return null;
    return {
        name: cat.name || '',
        sortOrder: String(getCategorySortOrder(cat)),
        isActive: cat.isActive !== false
    };
}

function adminClearCategoryDraftUi() {
    window._adminCategoryDraftUiActive = false;
    window._adminCategoryLiveBaseline = null;
    const bar = document.getElementById('admin-category-draft-mode-bar');
    if (bar) bar.hidden = true;
    document.querySelectorAll('.admin-field--draft, .admin-category-inline-field--draft').forEach(el => {
        el.classList.remove('admin-field--draft', 'admin-category-inline-field--draft');
        el.removeAttribute('title');
        el.removeAttribute('aria-description');
    });
    const wrap = document.getElementById('admin-category-form-wrap');
    if (wrap) wrap.classList.remove('admin-category-form-wrap--draft-view');
}
window.adminClearCategoryDraftUi = adminClearCategoryDraftUi;

function adminActivateCategoryDraftUi(mode, liveBaseline) {
    window._adminCategoryDraftUiActive = true;
    window._adminCategoryLiveBaseline = liveBaseline || null;
    const bar = document.getElementById('admin-category-draft-mode-bar');
    const textEl = bar?.querySelector('.admin-draft-mode-bar__text');
    const wrap = document.getElementById('admin-category-form-wrap');
    if (bar) bar.hidden = false;
    if (wrap && !window.inlineEditingCategoryId) wrap.classList.add('admin-category-form-wrap--draft-view');
    if (textEl) {
        textEl.innerHTML = mode === 'edit'
            ? '<strong>Draft loaded</strong> — amber fields differ from the published category. Hover for the live value.'
            : '<strong>New category draft</strong> — not on the storefront until you publish with Add.';
    }
    adminSyncCategoryDraftFieldUi();
}
window.adminActivateCategoryDraftUi = adminActivateCategoryDraftUi;

function adminMarkCategoryInlineField(row, selector, isDraft, hint) {
    if (!row) return;
    const input = row.querySelector(selector);
    const field = input?.closest('.admin-category-inline-field') ||
        input?.closest('.admin-category-inline-active-wrap');
    if (field) {
        field.classList.toggle('admin-category-inline-field--draft', !!isDraft);
        if (isDraft && hint) field.setAttribute('title', hint);
        else field.removeAttribute('title');
    }
}

function adminSyncCategoryDraftFieldUi() {
    if (!window._adminCategoryDraftUiActive) return;
    const live = window._adminCategoryLiveBaseline;
    const isNew = !live;

    const catHint = (label, liveVal, curVal) => {
        if (isNew) return `Draft — ${label} is not published yet`;
        return `Draft ${label} — published: ${liveVal || '(empty)'}`;
    };

    if (window.inlineEditingCategoryId) {
        const row = getInlineCategoryRow(window.inlineEditingCategoryId);
        const cur = serializeInlineCategoryState(window.inlineEditingCategoryId);
        if (!row || !cur) return;
        adminMarkCategoryInlineField(row, '.admin-category-inline-name',
            isNew ? !!cur.name : cur.name !== live.name,
            catHint('name', live?.name, cur.name));
        adminMarkCategoryInlineField(row, '.admin-category-inline-order',
            isNew ? !!String(cur.sortOrder).trim() : normalizeCategorySortOrderValue(cur.sortOrder) !== normalizeCategorySortOrderValue(live.sortOrder),
            catHint('order', live?.sortOrder, cur.sortOrder));
        adminMarkCategoryInlineField(row, '.admin-category-inline-active',
            isNew ? cur.isActive !== true : !!cur.isActive !== !!live.isActive,
            catHint('visibility', live?.isActive ? 'active' : 'hidden', cur.isActive ? 'active' : 'hidden'));
        return;
    }

    const cur = serializeCategoryFormState();
    const nameEl = document.getElementById('admin-category-name');
    const orderEl = document.getElementById('admin-category-order');
    const activeWrap = document.querySelector('#admin-category-form-wrap .admin-category-form-active');

    if (typeof adminMarkDraftFieldEl === 'function') {
        adminMarkDraftFieldEl(nameEl, isNew ? !!cur.name : cur.name !== live.name, catHint('name', live?.name, cur.name));
        adminMarkDraftFieldEl(orderEl,
            isNew ? !!String(cur.sortOrder).trim() : normalizeCategorySortOrderValue(cur.sortOrder) !== normalizeCategorySortOrderValue(live.sortOrder),
            catHint('order', live?.sortOrder, cur.sortOrder));
    }
    if (activeWrap) {
        const activeDiff = isNew ? cur.isActive !== true : !!cur.isActive !== !!live.isActive;
        activeWrap.classList.toggle('admin-category-inline-field--draft', activeDiff);
        if (activeDiff) activeWrap.setAttribute('title', catHint('visibility', live?.isActive ? 'active' : 'hidden', cur.isActive ? 'active' : 'hidden'));
        else activeWrap.removeAttribute('title');
    }
}
window.adminSyncCategoryDraftFieldUi = adminSyncCategoryDraftFieldUi;

function getInlineCategoryRow(id) {
    return document.querySelector(`#admin-category-list .admin-category-row[data-category-id="${id}"]`);
}

function normalizeCategorySortOrderValue(val, fallback = 0) {
    return String(parseCategorySortOrder(val, fallback));
}

function categoryFormStatesEqual(a, b) {
    if (!a || !b) return false;
    return a.name === b.name &&
        normalizeCategorySortOrderValue(a.sortOrder) === normalizeCategorySortOrderValue(b.sortOrder) &&
        !!a.isActive === !!b.isActive &&
        (a.editingCategoryId || null) === (b.editingCategoryId || null);
}

function inlineCategoryStatesEqual(a, b) {
    if (!a || !b) return false;
    return a.name === b.name &&
        normalizeCategorySortOrderValue(a.sortOrder) === normalizeCategorySortOrderValue(b.sortOrder) &&
        !!a.isActive === !!b.isActive;
}

function serializeInlineCategoryState(id) {
    const row = getInlineCategoryRow(id);
    if (!row) return null;
    return {
        name: (row.querySelector('.admin-category-inline-name')?.value || '').trim(),
        sortOrder: row.querySelector('.admin-category-inline-order')?.value ?? '0',
        isActive: !!row.querySelector('.admin-category-inline-active')?.checked
    };
}

function isInlineCategoryDirty(id) {
    id = id || window.inlineEditingCategoryId;
    if (!id || !window._inlineCategoryBaseline) return false;
    const current = serializeInlineCategoryState(id);
    if (!current) return false;
    return !inlineCategoryStatesEqual(current, window._inlineCategoryBaseline);
}
window.isInlineCategoryDirty = isInlineCategoryDirty;

function isAnyCategoryCrudDirty() {
    if (isCategoryFormDirty()) return true;
    if (window.inlineEditingCategoryId && isInlineCategoryDirty(window.inlineEditingCategoryId)) return true;
    return false;
}
window.isAnyCategoryCrudDirty = isAnyCategoryCrudDirty;

function getAdminCategorySearchQuery() {
    return String(window.adminCategorySearchQuery || '').trim().toLowerCase();
}

function categoryMatchesSearch(cat, query) {
    if (!query) return true;
    const name = String(cat?.name || '').toLowerCase();
    const slug = String(cat?.slug || slugifyCategoryName(cat?.name)).toLowerCase();
    return name.includes(query) || slug.includes(query);
}

window.clearAdminCategorySearch = function() {
    window.adminCategorySearchQuery = '';
    const input = document.getElementById('admin-category-search');
    const clearBtn = document.getElementById('admin-category-search-clear');
    if (input) input.value = '';
    if (clearBtn) clearBtn.hidden = true;
    renderAdminCategoryList();
};

function syncAdminCategoryListTools(totalCount, visibleCount) {
    const tools = document.getElementById('admin-category-list-tools');
    const meta = document.getElementById('admin-category-list-meta');
    const scroll = document.getElementById('admin-category-list-scroll');
    const showTools = totalCount >= 3;
    if (tools) tools.hidden = !showTools;
    if (meta) {
        const query = getAdminCategorySearchQuery();
        if (!totalCount) meta.textContent = '';
        else if (query && visibleCount !== totalCount) {
            meta.textContent = `${visibleCount} of ${totalCount}`;
        } else {
            meta.textContent = `${totalCount} categor${totalCount === 1 ? 'y' : 'ies'}`;
        }
    }
    if (scroll) {
        scroll.classList.toggle('admin-category-list-scroll--empty', totalCount === 0);
        scroll.classList.toggle('admin-category-list-scroll--many', totalCount >= 12);
    }
}

function highlightAdminCategoryRow(id) {
    document.querySelectorAll('#admin-category-list .admin-category-row').forEach(row => {
        row.classList.toggle('is-editing', !!id && row.dataset.categoryId === id);
    });
}

function focusAdminCategoryForm() {
    const nameEl = document.getElementById('admin-category-name');
    if (nameEl) {
        try {
            nameEl.focus({ preventScroll: true });
        } catch (e) {
            nameEl.focus();
        }
    }
}

function serializeCategoryFormState() {
    const nameEl = document.getElementById('admin-category-name');
    const orderEl = document.getElementById('admin-category-order');
    const activeEl = document.getElementById('admin-category-active');
    return {
        editingCategoryId: null,
        name: (nameEl?.value || '').trim(),
        sortOrder: orderEl?.value ?? '0',
        isActive: activeEl ? !!activeEl.checked : true
    };
}

function getCategoryFormBaseline() {
    const orderEl = document.getElementById('admin-category-order');
    const baselineOrder = orderEl?.dataset?.baselineOrder || String(getNextCategorySortOrder());
    return { editingCategoryId: null, name: '', sortOrder: baselineOrder, isActive: true };
}

function isCategoryFormDirty() {
    return !categoryFormStatesEqual(serializeCategoryFormState(), getCategoryFormBaseline());
}
window.isCategoryFormDirty = isCategoryFormDirty;

function applyCategoryFormState(state, fromDraft) {
    if (!state) return;
    if (state.editingCategoryId) {
        startInlineCategoryEditInternal(state.editingCategoryId, fromDraft ? state : null);
        return;
    }
    const name = document.getElementById('admin-category-name');
    const order = document.getElementById('admin-category-order');
    const active = document.getElementById('admin-category-active');
    if (name) name.value = state.name || '';
    if (order) {
        order.value = String(state.sortOrder ?? '0');
        order.dataset.baselineOrder = String(state.sortOrder ?? getNextCategorySortOrder());
    }
    if (active) active.checked = state.isActive !== false;
    updateCategoryFormMode();
    if (fromDraft && typeof adminActivateCategoryDraftUi === 'function') {
        adminActivateCategoryDraftUi('new', null);
    }
}
window.applyCategoryFormState = applyCategoryFormState;

function getCategoryDraftKey(id) {
    const catId = id ?? window.inlineEditingCategoryId;
    return catId ? `edit:${catId}` : 'new';
}

function categoryFormHasDraftableContent(state) {
    if (!state) return false;
    return !!(state.name || '').trim();
}

function flushCategoryDraft() {
    if (!canManageProductCategories()) return false;
    if (typeof adminCrudDraftsEnabled === 'function' && !adminCrudDraftsEnabled()) return false;

    if (window.inlineEditingCategoryId && isInlineCategoryDirty(window.inlineEditingCategoryId)) {
        const id = window.inlineEditingCategoryId;
        const state = serializeInlineCategoryState(id);
        if (!categoryFormHasDraftableContent(state)) return false;
        const key = getCategoryDraftKey(id);
        if (typeof adminDraftUpsert === 'function') {
            return adminDraftUpsert('category', key, {
                entityId: id,
                label: state.name,
                form: {
                    editingCategoryId: id,
                    name: state.name,
                    sortOrder: state.sortOrder,
                    isActive: state.isActive
                }
            }, { skipUi: true });
        }
        return false;
    }

    if (!isCategoryFormDirty()) return false;
    const state = serializeCategoryFormState();
    if (!categoryFormHasDraftableContent(state)) return false;
    if (typeof adminDraftUpsert === 'function') {
        return adminDraftUpsert('category', 'new', {
            entityId: null,
            label: state.name,
            form: state
        }, { skipUi: true });
    }
    return false;
}
window.flushCategoryDraft = flushCategoryDraft;

function persistCategoryDraft() {
    flushCategoryDraft();
}
window.persistCategoryDraft = persistCategoryDraft;

function clearCategoryDraftForCurrent() {
    const key = getCategoryDraftKey();
    if (typeof adminDraftRemove === 'function') adminDraftRemove('category', key);
}

async function saveCategoryAsDraft(silent) {
    if (typeof adminCrudDraftsEnabled === 'function' && !adminCrudDraftsEnabled()) {
        if (!silent) showToast('Drafts are disabled in Superadmin settings.');
        return false;
    }
    if (window.inlineEditingCategoryId && isInlineCategoryDirty(window.inlineEditingCategoryId)) {
        const id = window.inlineEditingCategoryId;
        const state = serializeInlineCategoryState(id);
        if (!categoryFormHasDraftableContent(state)) {
            if (!silent) showToast('Category name required for draft.');
            return false;
        }
        if (typeof adminDraftUpsert === 'function') {
            adminDraftUpsert('category', getCategoryDraftKey(id), {
                entityId: id,
                label: state.name,
                form: {
                    editingCategoryId: id,
                    name: state.name,
                    sortOrder: state.sortOrder,
                    isActive: state.isActive
                }
            });
        }
        finishCancelInlineCategoryEdit();
        if (!silent) showToast('Category saved as draft.');
        return true;
    }

    if (!isCategoryFormDirty()) {
        if (!silent) showToast('No changes to save as draft.');
        return false;
    }
    const state = serializeCategoryFormState();
    if (!categoryFormHasDraftableContent(state)) {
        if (!silent) showToast('Add a category name before saving as draft.');
        return false;
    }
    if (typeof adminDraftUpsert === 'function') {
        adminDraftUpsert('category', 'new', {
            entityId: null,
            label: state.name,
            form: state
        });
    }
    resetCategoryFormInternal();
    renderAdminCategoryList();
    if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
    if (!silent) showToast('Category saved as draft.');
    return true;
}
window.saveCategoryAsDraft = saveCategoryAsDraft;

function discardCategoryDraft(silent) {
    if (window.inlineEditingCategoryId) {
        clearCategoryDraftForCurrent();
        finishCancelInlineCategoryEdit();
    } else {
        clearCategoryDraftForCurrent();
        resetCategoryFormInternal();
        renderAdminCategoryList();
    }
    if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
    if (!silent) showToast('Draft discarded.');
}
window.discardCategoryDraft = discardCategoryDraft;

function adminCategoryHasEditDraft(id) {
    return typeof adminDraftIsVisible === 'function' && adminDraftIsVisible('category', `edit:${id}`);
}

function adminCategoryNewDraftRowHtml() {
    const item = typeof adminGetOrphanedNewCategoryDraft === 'function' ? adminGetOrphanedNewCategoryDraft() : null;
    if (!item?.entry?.form) return '';
    const form = item.entry.form;
    const label = (form.name || '').trim() || 'Untitled category';
    const age = typeof adminDraftFormatAge === 'function' ? adminDraftFormatAge(item.entry.updatedAt) : '';
    const order = form.sortOrder ?? '0';
    return `
    <div class="admin-category-row admin-category-row--draft" role="button" tabindex="0" onclick="adminOpenNewCategoryDraft()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();adminOpenNewCategoryDraft();}">
        <div class="admin-category-row-main">
            <span class="admin-category-order-badge admin-category-order-badge--draft" title="Draft">∗</span>
            <div class="admin-category-main">
                <strong>${escapeCategoryHtml(label)} <span class="admin-draft-indicator admin-draft-indicator--inline">Draft</span></strong>
                <span class="admin-category-meta">Order ${escapeCategoryHtml(String(order))} · saved ${escapeCategoryHtml(age)}</span>
            </div>
        </div>
        <div class="admin-category-actions">
            <button type="button" class="admin-category-icon-btn admin-category-icon-btn--gold" onclick="event.stopPropagation();adminOpenNewCategoryDraft()" title="Continue draft"><i class="fa fa-play"></i></button>
            <button type="button" class="admin-category-icon-btn admin-category-icon-btn--danger" onclick="event.stopPropagation();adminDeleteNewCategoryDraft()" title="Delete draft"><i class="fa fa-trash"></i></button>
        </div>
    </div>`;
}

window.adminOpenNewCategoryDraft = function() {
    if (typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) {
        showToast('Save or discard your current category edits first.');
        return;
    }
    if (typeof adminRestoreDraft === 'function') adminRestoreDraft('category', 'new');
};

window.adminDeleteNewCategoryDraft = function() {
    if (typeof adminDeleteDraft === 'function') adminDeleteDraft('category', 'new');
};

function startInlineCategoryEditInternal(id, preset) {
    const cat = getCategoryById(id);
    if (!cat) return;
    openAdminCategoryAccordion();
    window.inlineEditingCategoryId = id;
    if (typeof adminDraftSetActive === 'function') adminDraftSetActive('category', getCategoryDraftKey(id));
    const liveSnapshot = adminBuildLiveCategorySnapshot(cat);
    const base = preset || {
        name: cat.name || '',
        sortOrder: String(getCategorySortOrder(cat)),
        isActive: cat.isActive !== false
    };
    if (preset) {
        if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
        window._adminCategoryLiveBaseline = liveSnapshot;
        window._inlineCategoryBaseline = {
            name: cat.name || '',
            sortOrder: String(getCategorySortOrder(cat)),
            isActive: cat.isActive !== false
        };
    } else {
        if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
        window._adminCategoryLiveBaseline = null;
        window._inlineCategoryBaseline = {
            name: base.name || '',
            sortOrder: String(base.sortOrder ?? getCategorySortOrder(cat)),
            isActive: base.isActive !== false
        };
    }
    renderAdminCategoryList();
    setTimeout(() => {
        const row = getInlineCategoryRow(id);
        const nameInput = row?.querySelector('.admin-category-inline-name');
        if (preset) {
            const orderInput = row?.querySelector('.admin-category-inline-order');
            const activeInput = row?.querySelector('.admin-category-inline-active');
            if (nameInput) nameInput.value = base.name || '';
            if (orderInput) orderInput.value = String(base.sortOrder ?? '0');
            if (activeInput) activeInput.checked = base.isActive !== false;
            if (typeof adminActivateCategoryDraftUi === 'function') {
                adminActivateCategoryDraftUi('edit', window._adminCategoryLiveBaseline);
            }
        }
        if (nameInput) {
            try { nameInput.focus({ preventScroll: true }); } catch (e) { nameInput.focus(); }
        }
    }, 40);
}

async function guardInlineCategorySwitch(next) {
    const currentId = window.inlineEditingCategoryId;
    if (!currentId || !isInlineCategoryDirty(currentId)) {
        await next();
        return;
    }
    if (typeof adminPromptUnsavedChoice === 'function') {
        const choice = await adminPromptUnsavedChoice('Save changes to this category?', true);
        if (choice === 'cancel') return;
        if (choice === 'save') {
            await saveInlineCategory(currentId);
            if (isInlineCategoryDirty(currentId)) return;
        } else if (choice === 'draft') {
            await saveCategoryAsDraft(true);
            return;
        } else {
            clearCategoryDraftForCurrent();
            finishCancelInlineCategoryEdit();
        }
    } else {
        finishCancelInlineCategoryEdit();
    }
    await next();
}

function finishCancelInlineCategoryEdit() {
    if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
    if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
    window.inlineEditingCategoryId = null;
    window._inlineCategoryBaseline = null;
    renderAdminCategoryList();
}

window.startInlineCategoryEdit = async function(id) {
    if (!id) return;
    if (window.inlineEditingCategoryId === id) return;
    await guardInlineCategorySwitch(() => startInlineCategoryEditInternal(id));
};

window.cancelInlineCategoryEdit = async function() {
    const id = window.inlineEditingCategoryId;
    if (id && isInlineCategoryDirty(id)) {
        await guardInlineCategorySwitch(() => finishCancelInlineCategoryEdit());
        return;
    }
    finishCancelInlineCategoryEdit();
};

window.saveInlineCategory = async function(id) {
    if (!isAdmin) return showToast('Admin only.');
    const catId = id || window.inlineEditingCategoryId;
    if (!catId) return;
    const state = serializeInlineCategoryState(catId);
    if (!state) return;
    const name = state.name;
    if (!name) return showToast('Category name required.');

    const sortOrder = parseCategorySortOrder(state.sortOrder, getCategorySortOrder(getCategoryById(catId)));
    const payload = {
        name,
        slug: slugifyCategoryName(name),
        sortOrder,
        isActive: state.isActive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const duplicate = (window.productCategories || []).find(c =>
        c.id !== catId &&
        String(c.slug || slugifyCategoryName(c.name)) === payload.slug
    );
    if (duplicate) return showToast('A category with this name already exists.');

    try {
        await db.collection('categories').doc(catId).set(payload, { merge: true });
        const linkedProducts = getProductsWithCategory(catId);
        if (linkedProducts.length) {
            const batch = db.batch();
            linkedProducts.forEach(p => {
                batch.update(db.collection('products').doc(p.id), buildCategoryFieldsFromIds(getProductCategoryIds(p)));
            });
            await batch.commit();
        }
        window.inlineEditingCategoryId = null;
        window._inlineCategoryBaseline = null;
        if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
        clearCategoryDraftForCurrent();
        renderAdminCategoryList();
        showToast(linkedProducts.length ? `Saved (${linkedProducts.length} product${linkedProducts.length === 1 ? '' : 's'} synced).` : 'Category saved.');
    } catch (e) {
        console.error('saveInlineCategory failed:', e);
        showToast('Could not save category.');
    }
};

function adminCategoryInlineRowHtml(cat, counts) {
    const count = counts[cat.id] || 0;
    const active = cat.isActive !== false;
    const sortOrder = getCategorySortOrder(cat);
    const base = window._inlineCategoryBaseline || {
        name: cat.name || '',
        sortOrder: String(sortOrder),
        isActive: active
    };
    return `
    <div class="admin-category-row is-editing is-inline-edit${!active ? ' is-hidden-cat' : ''}" data-category-id="${cat.id}">
        <div class="admin-category-inline-edit">
            <div class="admin-category-inline-edit-head">
                <span class="admin-category-inline-edit-label"><i class="fa fa-pencil"></i> Edit category</span>
                <span class="admin-category-meta">${escapeCategoryHtml(cat.slug || slugifyCategoryName(cat.name))}${count ? ` · ${count} product${count === 1 ? '' : 's'}` : ''}</span>
            </div>
            <div class="admin-category-inline-edit-grid">
                <div class="admin-category-inline-field">
                    <label class="admin-category-form-label">Name</label>
                    <input type="text" class="admin-category-inline-input admin-category-inline-name" value="${escapeCategoryHtml(base.name)}" aria-label="Category name">
                </div>
                <div class="admin-category-inline-field admin-category-inline-field--order">
                    <label class="admin-category-form-label">Order</label>
                    <input type="number" class="admin-category-inline-input admin-category-inline-order" value="${escapeCategoryHtml(String(base.sortOrder))}" min="0" step="1" inputmode="numeric" aria-label="Display order">
                </div>
            </div>
            <label class="admin-category-form-active admin-category-inline-active-wrap">
                <input type="checkbox" class="admin-category-inline-input admin-category-inline-active" ${base.isActive ? 'checked' : ''}>
                <span>Active on storefront</span>
            </label>
            <div class="admin-category-inline-edit-actions">
                <button type="button" class="btn-gold admin-category-btn admin-category-inline-save" onclick="saveInlineCategory('${cat.id}')">Save</button>
                <button type="button" class="btn-gold admin-category-btn admin-category-btn-muted" onclick="saveCategoryAsDraft()">Save draft</button>
                <button type="button" class="btn-gold admin-category-btn admin-category-btn-muted" onclick="cancelInlineCategoryEdit()">Cancel</button>
                <button type="button" class="admin-category-icon-btn admin-category-icon-btn--danger admin-category-inline-delete" onclick="deleteCategory('${cat.id}')" title="Delete"><i class="fa fa-trash"></i></button>
            </div>
        </div>
    </div>`;
}

function adminCategoryViewRowHtml(cat, counts, categories, editDraftIds) {
    const count = counts[cat.id] || 0;
    const active = cat.isActive !== false;
    const sortOrder = getCategorySortOrder(cat);
    const globalIndex = categories.findIndex(c => c.id === cat.id);
    const canMoveUp = globalIndex > 0;
    const canMoveDown = globalIndex >= 0 && globalIndex < categories.length - 1;
    const inlineBusy = !!window.inlineEditingCategoryId;
    const hasEditDraft = editDraftIds ? editDraftIds.has(cat.id) : adminCategoryHasEditDraft(cat.id);
    const editDraftBadge = hasEditDraft
        ? ' <span class="admin-draft-indicator admin-draft-indicator--inline">Draft</span>'
        : '';
    return `
    <div class="admin-category-row${!active ? ' is-hidden-cat' : ''}${hasEditDraft ? ' admin-category-row--has-edit-draft' : ''}" data-category-id="${cat.id}">
        <div class="admin-category-row-main" onclick="startInlineCategoryEdit('${cat.id}')" role="button" tabindex="0" aria-label="Edit ${escapeCategoryHtml(cat.name)}">
            <span class="admin-category-order-badge" title="Display order">${sortOrder}</span>
            <div class="admin-category-main">
                <strong>${escapeCategoryHtml(cat.name)}${editDraftBadge}</strong>
                <span class="admin-category-meta">${escapeCategoryHtml(cat.slug || slugifyCategoryName(cat.name))}${count ? ` · ${count} product${count === 1 ? '' : 's'}` : ''}</span>
            </div>
        </div>
        <div class="admin-category-actions">
            <span class="admin-category-status ${active ? 'is-active' : 'is-hidden'}">${active ? 'Active' : 'Hidden'}</span>
            <div class="admin-category-icon-actions">
                <button type="button" class="admin-category-icon-btn" onclick="event.stopPropagation(); moveCategoryOrder('${cat.id}', -1)" title="Move up" ${canMoveUp && !inlineBusy ? '' : 'disabled'}><i class="fa fa-chevron-up"></i></button>
                <button type="button" class="admin-category-icon-btn" onclick="event.stopPropagation(); moveCategoryOrder('${cat.id}', 1)" title="Move down" ${canMoveDown && !inlineBusy ? '' : 'disabled'}><i class="fa fa-chevron-down"></i></button>
                <button type="button" class="admin-category-icon-btn admin-category-icon-btn--gold" onclick="event.stopPropagation(); startInlineCategoryEdit('${cat.id}')" title="Edit inline"><i class="fa fa-pencil"></i></button>
                <button type="button" class="admin-category-icon-btn" onclick="event.stopPropagation(); toggleCategoryActive('${cat.id}')" title="${active ? 'Hide' : 'Show'}" ${inlineBusy ? 'disabled' : ''}><i class="fa fa-${active ? 'eye-slash' : 'eye'}"></i></button>
                <button type="button" class="admin-category-icon-btn admin-category-icon-btn--danger" onclick="event.stopPropagation(); deleteCategory('${cat.id}')" title="Delete" ${inlineBusy ? 'disabled' : ''}><i class="fa fa-trash"></i></button>
            </div>
        </div>
    </div>`;
}

function setCategoryFormDefaultOrder() {
    const order = document.getElementById('admin-category-order');
    if (!order) return;
    const next = getNextCategorySortOrder();
    order.value = String(next);
    order.dataset.baselineOrder = String(next);
}

function getActiveCategories() {
    return (window.productCategories || [])
        .filter(c => c.isActive !== false)
        .sort(compareCategoriesByOrder);
}
window.getActiveCategories = getActiveCategories;

function getAllCategoriesSorted() {
    return [...(window.productCategories || [])].sort(compareCategoriesByOrder);
}

function canManageProductCategories() {
    return typeof isAdmin !== 'undefined' && isAdmin;
}

function getCategoryById(id) {
    if (!id) return null;
    return (window.productCategories || []).find(c => c.id === id) || null;
}
window.getCategoryById = getCategoryById;

function normalizeProductCategories(product) {
    if (!product) return { categoryIds: [], categoryNames: [], categorySlugs: [] };

    const ids = [];
    const seen = new Set();
    const addId = (id) => {
        const clean = String(id || '').trim();
        if (!clean || seen.has(clean)) return;
        seen.add(clean);
        ids.push(clean);
    };

    if (Array.isArray(product.categoryIds)) {
        product.categoryIds.forEach(addId);
    }
    addId(product.categoryId);

    if (!ids.length) {
        const legacyNames = [];
        if (Array.isArray(product.categoryNames)) {
            product.categoryNames.forEach(name => {
                const clean = String(name || '').trim();
                if (clean) legacyNames.push(clean);
            });
        } else if (product.categoryName) {
            String(product.categoryName).split(/[,|;]/).map(s => s.trim()).filter(Boolean).forEach(name => legacyNames.push(name));
        }

        legacyNames.forEach(name => {
            const lower = name.toLowerCase();
            const match = (window.productCategories || []).find(c =>
                String(c.name || '').trim().toLowerCase() === lower ||
                String(c.slug || '').trim().toLowerCase() === lower
            );
            if (match) addId(match.id);
        });

        if (!ids.length && product.categorySlug) {
            const slug = String(product.categorySlug).trim().toLowerCase();
            const match = (window.productCategories || []).find(c =>
                String(c.slug || slugifyCategoryName(c.name)).trim().toLowerCase() === slug
            );
            if (match) addId(match.id);
        }
    }

    const categories = ids.map(id => getCategoryById(id)).filter(Boolean);
    return {
        categoryIds: ids,
        categoryNames: categories.map(c => c.name),
        categorySlugs: categories.map(c => c.slug || slugifyCategoryName(c.name))
    };
}

function buildCategoryFieldsFromIds(categoryIds) {
    const ids = [...new Set((categoryIds || []).map(id => String(id || '').trim()).filter(Boolean))];
    const categories = ids.map(id => getCategoryById(id)).filter(Boolean);
    return {
        categoryIds: ids,
        categoryNames: categories.map(c => c.name),
        categorySlugs: categories.map(c => c.slug || slugifyCategoryName(c.name)),
        categoryId: ids[0] || '',
        categoryName: categories.map(c => c.name).join(', '),
        categorySlug: categories[0] ? (categories[0].slug || slugifyCategoryName(categories[0].name)) : ''
    };
}

function getProductCategoryIds(product) {
    return normalizeProductCategories(product).categoryIds;
}
window.getProductCategoryIds = getProductCategoryIds;

function productHasCategory(product, categoryId) {
    if (!categoryId) return true;
    return getProductCategoryIds(product).includes(categoryId);
}
window.productHasCategory = productHasCategory;

function getProductsWithCategory(categoryId) {
    return (window.products || []).filter(p => productHasCategory(p, categoryId));
}

function resolveProductCategoryLabel(product) {
    const norm = normalizeProductCategories(product);
    if (norm.categoryNames.length) return norm.categoryNames.join(', ');
    if (Array.isArray(product?.categoryNames) && product.categoryNames.length) {
        return product.categoryNames.map(n => String(n || '').trim()).filter(Boolean).join(', ');
    }
    if (product?.categoryName) return product.categoryName;
    return '';
}
window.resolveProductCategoryLabel = resolveProductCategoryLabel;

function resolveProductCategoryLabels(product) {
    const norm = normalizeProductCategories(product);
    if (norm.categoryNames.length) return norm.categoryNames;
    if (product?.categoryName) {
        return String(product.categoryName).split(/[,|;]/).map(s => s.trim()).filter(Boolean);
    }
    return [];
}
window.resolveProductCategoryLabels = resolveProductCategoryLabels;

function resolveProductCategoryId(product) {
    const ids = getProductCategoryIds(product);
    return ids[0] || '';
}
window.resolveProductCategoryId = resolveProductCategoryId;

function getStorefrontVisibleProducts() {
    return (window.products || []).filter(p => {
        if (typeof isProductOutOfStock === 'function' && isProductOutOfStock(p)) return false;
        return true;
    });
}

function getProductCountsByCategory() {
    const counts = {};
    getStorefrontVisibleProducts().forEach(p => {
        const ids = getProductCategoryIds(p);
        if (!ids.length) {
            counts[''] = (counts[''] || 0) + 1;
            return;
        }
        ids.forEach(id => {
            counts[id] = (counts[id] || 0) + 1;
        });
    });
    return counts;
}

function renderProductCategoryCheckboxes(selectedIds) {
    const container = document.getElementById('m-category-checkboxes');
    const wrapper = document.getElementById('m-category-container');
    if (!container) return;

    const adminCanAssign = canManageProductCategories();
    const storefrontEnabled = isProductCategoriesEnabled();
    if (wrapper) wrapper.style.display = (adminCanAssign || storefrontEnabled) ? 'block' : 'none';
    if (!adminCanAssign && !storefrontEnabled) return;

    const selected = new Set((selectedIds || []).map(id => String(id || '').trim()).filter(Boolean));
    const categories = adminCanAssign ? getAllCategoriesSorted() : getActiveCategories();

    if (!categories.length) {
        container.innerHTML = '<p style="margin:0; font-size:11px; color:#666;">No categories yet. Create categories in Admin first.</p>';
        return;
    }

    container.innerHTML = categories.map(c => {
        const hiddenLabel = c.isActive === false ? ' (Hidden)' : '';
        const checked = selected.has(c.id) ? ' checked' : '';
        return `<label class="m-category-option"><input type="checkbox" value="${c.id}"${checked}><span>${escapeCategoryHtml(c.name)}${hiddenLabel}</span></label>`;
    }).join('');
}

function populateProductCategorySelect(selectedId) {
    const ids = selectedId ? (Array.isArray(selectedId) ? selectedId : [selectedId]) : [];
    renderProductCategoryCheckboxes(ids);
}

function readProductCategoryFromForm() {
    const container = document.getElementById('m-category-checkboxes');
    if (!container || (!isProductCategoriesEnabled() && !canManageProductCategories())) {
        return buildCategoryFieldsFromIds([]);
    }
    const checkedIds = [...container.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value);
    return buildCategoryFieldsFromIds(checkedIds);
}

function hydrateProductCategoryForm(product) {
    renderProductCategoryCheckboxes(getProductCategoryIds(product));
}

function resolveSingleCategoryImportPart(part) {
    const raw = String(part || '').trim();
    if (!raw) return null;

    const byId = getCategoryById(raw);
    if (byId) return byId.id;

    const lower = raw.toLowerCase();
    const byName = (window.productCategories || []).find(c =>
        String(c.name || '').trim().toLowerCase() === lower ||
        String(c.slug || '').trim().toLowerCase() === lower
    );
    return byName ? byName.id : null;
}

function resolveCategoryIdFromImportValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return buildCategoryFieldsFromIds([]);

    const parts = raw.split(/[,|;]/).map(s => s.trim()).filter(Boolean);
    const ids = [];
    parts.forEach(part => {
        const resolvedId = resolveSingleCategoryImportPart(part);
        if (resolvedId) ids.push(resolvedId);
    });

    if (ids.length) return buildCategoryFieldsFromIds(ids);

    return {
        categoryIds: [],
        categoryNames: parts,
        categorySlugs: parts.map(slugifyCategoryName),
        categoryId: '',
        categoryName: parts.join(', '),
        categorySlug: parts[0] ? slugifyCategoryName(parts[0]) : ''
    };
}

function escapeCategoryHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
window.escapeCategoryHtml = escapeCategoryHtml;

function renderHomeCategoryBar() {
    renderCategoryBarForView('home', 'home-category-bar');
}
window.renderHomeCategoryBar = renderHomeCategoryBar;

function renderWishCategoryBar() {
    renderCategoryBarForView('wishlist', 'wish-category-bar');
}
window.renderWishCategoryBar = renderWishCategoryBar;

function renderCategoryFilterChips() {
    const group = document.getElementById('filter-category-group');
    const container = document.getElementById('filter-categories');
    if (!group || !container) return;

    if (!isCategoryBarEnabledForView('home')) {
        group.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const categories = getActiveCategories();
    if (!categories.length) {
        group.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    group.style.display = 'block';
    const activeIds = getCategoryFiltersForView('home');
    container.innerHTML = `<div class="size-chip${activeIds.length === 0 ? ' active' : ''}" onclick="setFilterCategory(this, '')">All</div>` +
        categories.map(cat =>
            `<div class="size-chip${activeIds.includes(cat.id) ? ' active' : ''}" onclick="setFilterCategory(this, '${cat.id}')">${escapeCategoryHtml(cat.name)}</div>`
        ).join('');
}

window.toggleHomeCategoryFilter = function(categoryId) {
    toggleCategoryFilterForView('home', categoryId || '');
    displayedProductsLimit = productsPageLimitSetting;
    renderHomeCategoryBar();
    renderCategoryFilterChips();
    if (typeof applySortAndFilter === 'function') applySortAndFilter();
};

window.toggleWishCategoryFilter = function(categoryId) {
    toggleCategoryFilterForView('wishlist', categoryId || '');
    displayedWishlistLimit = productsPageLimitSetting;
    renderWishCategoryBar();
    if (typeof renderStore === 'function') renderStore();
};

window.setHomeCategoryFilter = window.toggleHomeCategoryFilter;

window.setFilterCategory = function(el, categoryId) {
    toggleCategoryFilterForView('home', categoryId || '');
    displayedProductsLimit = productsPageLimitSetting;
    renderHomeCategoryBar();
    renderCategoryFilterChips();
    if (typeof applySortAndFilter === 'function') applySortAndFilter();
};

function renderAdminCategoryBanner() {
    const banner = document.getElementById('admin-category-storefront-banner');
    if (!banner) return;

    const storefrontOff = !isProductCategoriesEnabled();
    const homeBarOff = typeof isCatalogControlEnabled === 'function' && !isCatalogControlEnabled('home', 'categories');
    const wishBarOff = typeof isCatalogControlEnabled === 'function' && !isCatalogControlEnabled('wishlist', 'categories');

    if (storefrontOff) {
        banner.innerHTML = '<div class="admin-category-banner admin-category-banner-warn"><i class="fa fa-info-circle"></i> Storefront categories are <strong>disabled</strong> in Superadmin. You can still create categories here and assign them to products — they will appear once you enable <strong>Product Categories</strong>.</div>';
        banner.style.display = 'block';
    } else if (homeBarOff && wishBarOff) {
        banner.innerHTML = '<div class="admin-category-banner"><i class="fa fa-info-circle"></i> Category bars are hidden on Home and Wishlist. Enable <strong>Category Bar</strong> under Catalog Controls in Superadmin.</div>';
        banner.style.display = 'block';
    } else if (homeBarOff) {
        banner.innerHTML = '<div class="admin-category-banner"><i class="fa fa-info-circle"></i> The home category bar is hidden. Enable <strong>Category Bar</strong> under Home Catalog Controls in Superadmin.</div>';
        banner.style.display = 'block';
    } else if (wishBarOff) {
        banner.innerHTML = '<div class="admin-category-banner"><i class="fa fa-info-circle"></i> The wishlist category bar is hidden. Enable <strong>Category Bar</strong> under Wishlist Catalog Controls in Superadmin.</div>';
        banner.style.display = 'block';
    } else {
        banner.innerHTML = '';
        banner.style.display = 'none';
    }
}

function renderAdminCategoryList() {
    const list = document.getElementById('admin-category-list');
    const section = document.getElementById('admin-category-section');
    if (!list || !section) return;

    if (isAdminCategoryInlineEditing()) return;

    section.style.display = 'block';
    renderAdminCategoryBanner();

    const categories = getAllCategoriesSorted();
    const query = getAdminCategorySearchQuery();
    const filtered = query ? categories.filter(cat => categoryMatchesSearch(cat, query)) : categories;

    if (!categories.length) {
        const draftRow = adminCategoryNewDraftRowHtml();
        list.innerHTML = draftRow || '<p class="admin-category-empty">No categories yet — type a name above and tap <strong>Add</strong>.</p>';
        updateAdminCategoryCountBadge(0);
        syncAdminCategoryListTools(0, 0);
        return;
    }

    if (!filtered.length) {
        list.innerHTML = adminCategoryNewDraftRowHtml() + '<p class="admin-category-empty">No categories match your search.</p>';
        updateAdminCategoryCountBadge(categories.length);
        syncAdminCategoryListTools(categories.length, 0);
        return;
    }

    const counts = getProductCountsByCategory();
    const inlineId = window.inlineEditingCategoryId || '';
    const categoryEditDraftIds = typeof adminGetCategoryEditDraftIdSet === 'function'
        ? adminGetCategoryEditDraftIdSet()
        : new Set();
    list.innerHTML = adminCategoryNewDraftRowHtml() + filtered.map(cat => {
        if (inlineId === cat.id) return adminCategoryInlineRowHtml(cat, counts);
        return adminCategoryViewRowHtml(cat, counts, categories, categoryEditDraftIds);
    }).join('');

    bindAdminCategoryRowKeys();
    bindAdminCategoryInlineEditors();
    updateAdminCategoryCountBadge(categories.length);
    syncAdminCategoryListTools(categories.length, filtered.length);
}

function bindAdminCategoryInlineEditors() {
    document.querySelectorAll('#admin-category-list .admin-category-inline-input').forEach(el => {
        if (el.dataset.inlineDraftUiBound) return;
        el.dataset.inlineDraftUiBound = '1';
        const onEdit = () => {
            if (!window._adminCategoryDraftUiActive) return;
            clearTimeout(_categoryDraftUiTimer);
            _categoryDraftUiTimer = setTimeout(() => adminSyncCategoryDraftFieldUi(), 200);
        };
        el.addEventListener('input', onEdit);
        el.addEventListener('change', onEdit);
    });
    document.querySelectorAll('#admin-category-list .admin-category-inline-name').forEach(el => {
        if (el.dataset.inlineBound) return;
        el.dataset.inlineBound = '1';
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const id = el.closest('.admin-category-row')?.dataset?.categoryId;
                if (id) saveInlineCategory(id);
            }
            if (e.key === 'Escape') cancelInlineCategoryEdit();
        });
    });
}

function bindAdminCategoryRowKeys() {
    document.querySelectorAll('#admin-category-list .admin-category-row-main[role="button"]').forEach(el => {
        if (el.dataset.rowKeyBound) return;
        el.dataset.rowKeyBound = '1';
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const id = el.closest('.admin-category-row')?.dataset?.categoryId;
                if (id) startInlineCategoryEdit(id);
            }
        });
    });
}

function updateAdminCategoryCountBadge(count) {
    const badge = document.getElementById('admin-category-count-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = String(count);
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

function closeAdminCategoryAccordion() {
    const content = document.getElementById('admin-category-accordion-content');
    const icon = document.getElementById('admin-category-accordion-icon');
    if (!content) return;
    content.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(-90deg)';
}

async function tryCloseAdminCategoryAccordion() {
    if (window.inlineEditingCategoryId && !isInlineCategoryDirty(window.inlineEditingCategoryId)) {
        finishCancelInlineCategoryEdit();
    }

    if (!isAnyCategoryCrudDirty()) {
        if (typeof flushCategoryDraft === 'function') flushCategoryDraft();
        if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
        closeAdminCategoryAccordion();
        renderAdminCategoryList();
        return;
    }

    const choice = typeof adminPromptUnsavedChoice === 'function'
        ? await adminPromptUnsavedChoice('Publish, save as draft, or discard category changes?', true)
        : (window.confirm('Save changes? OK = Save, Cancel = Keep editing') ? 'save' : 'cancel');
    if (choice === 'cancel') return;

    if (choice === 'save') {
        const inlineId = window.inlineEditingCategoryId;
        if (inlineId && isInlineCategoryDirty(inlineId)) {
            await saveInlineCategory(inlineId);
            if (isInlineCategoryDirty(inlineId)) return;
        }
        if (isCategoryFormDirty()) {
            await saveCategory();
            if (isCategoryFormDirty()) return;
        }
    } else if (choice === 'draft') {
        await saveCategoryAsDraft(true);
    } else {
        discardCategoryDraft(true);
    }

    if (isAnyCategoryCrudDirty()) return;
    if (typeof flushCategoryDraft === 'function') flushCategoryDraft();
    if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
    closeAdminCategoryAccordion();
    renderAdminCategoryList();
}

function openAdminCategoryAccordion() {
    const content = document.getElementById('admin-category-accordion-content');
    const icon = document.getElementById('admin-category-accordion-icon');
    if (!content) return;
    content.style.display = 'flex';
    if (icon) icon.style.transform = 'rotate(0deg)';
    if (typeof renderAdminDraftRecoveryPanel === 'function') renderAdminDraftRecoveryPanel();
}

window.toggleAdminCategoryAccordion = async function() {
    const content = document.getElementById('admin-category-accordion-content');
    if (!content) return;

    if (content.style.display === 'none' || !content.style.display) {
        openAdminCategoryAccordion();
        return;
    }
    await tryCloseAdminCategoryAccordion();
};

function updateCategoryFormMode() {
    /* Add-only top form — no mode switching. */
}

function bindCategoryFormUi() {
    const nameEl = document.getElementById('admin-category-name');
    const orderEl = document.getElementById('admin-category-order');
    const activeEl = document.getElementById('admin-category-active');
    const searchEl = document.getElementById('admin-category-search');
    const onChange = () => {
        if (window._adminCategoryDraftUiActive) {
            clearTimeout(_categoryDraftUiTimer);
            _categoryDraftUiTimer = setTimeout(() => adminSyncCategoryDraftFieldUi(), 200);
        }
    };
    if (nameEl && !nameEl.dataset.categoryUiBound) {
        nameEl.dataset.categoryUiBound = '1';
        nameEl.addEventListener('input', onChange);
    }
    if (orderEl && !orderEl.dataset.categoryUiBound) {
        orderEl.dataset.categoryUiBound = '1';
        orderEl.addEventListener('input', onChange);
        orderEl.addEventListener('change', onChange);
    }
    if (activeEl && !activeEl.dataset.categoryUiBound) {
        activeEl.dataset.categoryUiBound = '1';
        activeEl.addEventListener('change', onChange);
    }
    if (searchEl && !searchEl.dataset.categorySearchBound) {
        searchEl.dataset.categorySearchBound = '1';
        searchEl.addEventListener('input', () => {
            window.adminCategorySearchQuery = searchEl.value || '';
            const clearBtn = document.getElementById('admin-category-search-clear');
            if (clearBtn) clearBtn.hidden = !window.adminCategorySearchQuery;
            renderAdminCategoryList();
        });
    }
}

window.loadCategoryIntoForm = window.startInlineCategoryEdit;

window.moveCategoryOrder = async function(id, direction) {
    if (!isAdmin) return showToast('Admin only.');
    const delta = Number(direction) || 0;
    if (!delta) return;
    const categories = getAllCategoriesSorted();
    const idx = categories.findIndex(c => c.id === id);
    const swapIdx = idx + delta;
    if (idx < 0 || swapIdx < 0 || swapIdx >= categories.length) return;
    const current = categories[idx];
    const swap = categories[swapIdx];
    const currentOrder = getCategorySortOrder(current);
    const swapOrder = getCategorySortOrder(swap);
    try {
        const batch = db.batch();
        const ts = firebase.firestore.FieldValue.serverTimestamp();
        batch.set(db.collection('categories').doc(current.id), { sortOrder: swapOrder, updatedAt: ts }, { merge: true });
        batch.set(db.collection('categories').doc(swap.id), { sortOrder: currentOrder, updatedAt: ts }, { merge: true });
        await batch.commit();
        showToast('Category order updated.');
    } catch (e) {
        console.error('moveCategoryOrder failed:', e);
        showToast('Could not reorder category.');
    }
};

function resetCategoryFormInternal() {
    const name = document.getElementById('admin-category-name');
    const active = document.getElementById('admin-category-active');
    if (name) name.value = '';
    if (active) active.checked = true;
    setCategoryFormDefaultOrder();
    if (typeof adminClearCategoryDraftUi === 'function') adminClearCategoryDraftUi();
}

function resetCategoryForm() {
    resetCategoryFormInternal();
    renderAdminCategoryList();
}

window.openCategoryForm = function() {
    resetCategoryFormInternal();
    focusAdminCategoryForm();
};

window.scrollToCategoryAdmin = function() {
    if (typeof navigateTo === 'function') navigateTo('admin');
    resetCategoryForm();
    openAdminCategoryAccordion();
    const section = document.getElementById('admin-category-section');
    if (section) {
        setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            focusAdminCategoryForm();
        }, 150);
    }
};

window.editCategory = function(id) {
    startInlineCategoryEdit(id);
};

window.saveCategory = async function() {
    if (!isAdmin) return showToast('Admin only.');
    const nameEl = document.getElementById('admin-category-name');
    const orderEl = document.getElementById('admin-category-order');
    const activeEl = document.getElementById('admin-category-active');
    const name = (nameEl?.value || '').trim();
    if (!name) return showToast('Category name required.');

    let sortOrder = parseCategorySortOrder(orderEl?.value, getNextCategorySortOrder());
    if (sortOrder === 0 && (window.productCategories || []).length > 0) {
        sortOrder = getNextCategorySortOrder();
    }

    const payload = {
        name,
        slug: slugifyCategoryName(name),
        sortOrder,
        isActive: activeEl ? !!activeEl.checked : true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const duplicate = (window.productCategories || []).find(c =>
        String(c.slug || slugifyCategoryName(c.name)) === payload.slug
    );
    if (duplicate) return showToast('A category with this name already exists.');

    try {
        await db.collection('categories').add(payload);
        showToast('Category added.');
        resetCategoryForm();
        renderAdminCategoryList();
        clearCategoryDraftForCurrent();
        focusAdminCategoryForm();
    } catch (e) {
        console.error('saveCategory failed:', e);
        showToast('Could not save category.');
    }
};

window.toggleCategoryActive = async function(id) {
    const cat = getCategoryById(id);
    if (!cat) return;
    try {
        await db.collection('categories').doc(id).set({
            isActive: cat.isActive === false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        showToast('Could not update category.');
    }
};

window.deleteCategory = async function(id) {
    const cat = getCategoryById(id);
    if (!cat) return;
    const count = getProductCountsByCategory()[id] || 0;
    const msg = count
        ? `Delete "${cat.name}"? It will be removed from ${count} product${count === 1 ? '' : 's'}.`
        : `Delete "${cat.name}"?`;
    if (!confirm(msg)) return;

    try {
        await db.collection('categories').doc(id).delete();
        if (count > 0) {
            const batch = db.batch();
            getProductsWithCategory(id).forEach(p => {
                const newIds = getProductCategoryIds(p).filter(cid => cid !== id);
                batch.update(db.collection('products').doc(p.id), buildCategoryFieldsFromIds(newIds));
            });
            await batch.commit();
        }
        showToast('Category deleted.');
        if (window.inlineEditingCategoryId === id) cancelInlineCategoryEdit();
    } catch (e) {
        console.error('deleteCategory failed:', e);
        showToast('Could not delete category.');
    }
};

function initCategoryFormKeyboard() {
    const nameEl = document.getElementById('admin-category-name');
    if (!nameEl || nameEl.dataset.categoryEnterBound) return;
    nameEl.dataset.categoryEnterBound = '1';
    nameEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveCategory();
        }
    });
    bindCategoryFormUi();
    updateCategoryFormMode();
}

function loadProductCategories() {
    if (typeof db === 'undefined') return;
    if (window._categoriesListenerStarted) return;
    window._categoriesListenerStarted = true;
    initCategoryFormKeyboard();
    setCategoryFormDefaultOrder();
    if (typeof renderAdminDraftRecoveryPanel === 'function') renderAdminDraftRecoveryPanel();

    db.collection('categories').onSnapshot(snap => {
        window.productCategories = snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                sortOrder: parseCategorySortOrder(data.sortOrder, 0)
            };
        });
        window.categoriesLoaded = true;
        const container = document.getElementById('m-category-checkboxes');
        const selected = container
            ? [...container.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value)
            : [];
        renderProductCategoryCheckboxes(selected);
        renderAdminCategoryList();
        renderHomeCategoryBar();
        renderWishCategoryBar();
        renderCategoryFilterChips();
        if (typeof renderAdmin === 'function') renderAdmin();
    }, err => {
        console.error('categories onSnapshot error:', err);
    });
}
window.loadProductCategories = loadProductCategories;

function applyCategoryDeepLink() {
    if (!isProductCategoriesEnabled()) return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('category');
    if (!slug) return;
    const match = getActiveCategories().find(c =>
        (c.slug || slugifyCategoryName(c.name)) === slug.toLowerCase()
    );
    if (match) {
        setCategoryFiltersForView('home', [match.id]);
        renderHomeCategoryBar();
        renderCategoryFilterChips();
    }
}
window.applyCategoryDeepLink = applyCategoryDeepLink;
window.renderAdminCategoryList = renderAdminCategoryList;
window.readProductCategoryFromForm = readProductCategoryFromForm;
window.hydrateProductCategoryForm = hydrateProductCategoryForm;
window.resolveCategoryIdFromImportValue = resolveCategoryIdFromImportValue;
window.renderProductCategoryBadges = function(product) {
    const labels = resolveProductCategoryLabels(product);
    if (!labels.length) return '';
    const shown = labels.slice(0, 2);
    const extra = labels.length - shown.length;
    return `<div class="product-category-badges">${shown.map(label =>
        `<span class="product-category-badge">${escapeCategoryHtml(label)}</span>`
    ).join('')}${extra > 0 ? `<span class="product-category-badge product-category-badge-more">+${extra}</span>` : ''}</div>`;
};
