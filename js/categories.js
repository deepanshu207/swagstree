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
    return false;
}

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
        editingCategoryId: window.editingCategoryId || null,
        name: (nameEl?.value || '').trim(),
        sortOrder: orderEl?.value ?? '0',
        isActive: activeEl ? !!activeEl.checked : true
    };
}

function getCategoryFormBaseline() {
    if (window.editingCategoryId) {
        const cat = getCategoryById(window.editingCategoryId);
        if (!cat) return { editingCategoryId: null, name: '', sortOrder: '0', isActive: true };
        return {
            editingCategoryId: window.editingCategoryId,
            name: cat.name || '',
            sortOrder: String(getCategorySortOrder(cat)),
            isActive: cat.isActive !== false
        };
    }
    const orderEl = document.getElementById('admin-category-order');
    const baselineOrder = orderEl?.dataset?.baselineOrder || String(getNextCategorySortOrder());
    return { editingCategoryId: null, name: '', sortOrder: baselineOrder, isActive: true };
}

function isCategoryFormDirty() {
    const current = serializeCategoryFormState();
    const baseline = getCategoryFormBaseline();
    return JSON.stringify(current) !== JSON.stringify(baseline);
}
window.isCategoryFormDirty = isCategoryFormDirty;

function applyCategoryFormState(state) {
    if (!state) return;
    window.editingCategoryId = state.editingCategoryId || null;
    const name = document.getElementById('admin-category-name');
    const order = document.getElementById('admin-category-order');
    const active = document.getElementById('admin-category-active');
    if (name) name.value = state.name || '';
    if (order) {
        order.value = String(state.sortOrder ?? '0');
        if (!window.editingCategoryId) {
            order.dataset.baselineOrder = String(state.sortOrder ?? getNextCategorySortOrder());
        }
    }
    if (active) active.checked = state.isActive !== false;
    updateCategoryFormMode();
    renderAdminCategoryList();
}

function persistCategoryDraft() {
    if (!canManageProductCategories()) return;
    if (!isCategoryFormDirty()) {
        const existing = typeof adminDraftRead === 'function' ? adminDraftRead() : null;
        if (existing?.type === 'category' && typeof adminDraftClear === 'function') adminDraftClear();
        return;
    }
    const state = serializeCategoryFormState();
    if (!state.name && !state.editingCategoryId) return;
    const draft = {
        v: 1,
        type: 'category',
        updatedAt: Date.now(),
        entityId: state.editingCategoryId,
        label: state.name || 'Category',
        form: state
    };
    if (typeof adminDraftWrite === 'function') adminDraftWrite(draft);
}
window.persistCategoryDraft = persistCategoryDraft;

function discardCategoryDraft(silent) {
    const baseline = getCategoryFormBaseline();
    applyCategoryFormState(baseline);
    if (typeof adminDraftClear === 'function') adminDraftClear();
    if (!silent) showToast('Category draft discarded.');
}
window.discardCategoryDraft = discardCategoryDraft;

function tryOfferCategoryDraftRestore() {
    if (!canManageProductCategories() || window._categoryDraftOffered) return;
    const draft = typeof adminDraftRead === 'function' ? adminDraftRead() : null;
    if (!draft || draft.type !== 'category' || !draft.form) return;
    if (isCategoryFormDirty()) return;
    if (!draft.form.name && !draft.form.editingCategoryId) {
        if (typeof adminDraftClear === 'function') adminDraftClear();
        return;
    }
    window._categoryDraftOffered = true;
    const label = draft.form.name || 'category';
    if (window.confirm(`Resume unsaved work on "${label}"?`)) {
        applyCategoryFormState(draft.form);
        showToast('Draft restored — tap Save when ready.');
    } else if (typeof adminDraftClear === 'function') {
        adminDraftClear();
    }
}

function loadCategoryIntoFormInternal(id) {
    const cat = getCategoryById(id);
    if (!cat) return;
    openAdminCategoryAccordion();
    window.editingCategoryId = id;
    const name = document.getElementById('admin-category-name');
    const order = document.getElementById('admin-category-order');
    const active = document.getElementById('admin-category-active');
    if (name) name.value = cat.name || '';
    if (order) order.value = String(getCategorySortOrder(cat));
    if (active) active.checked = cat.isActive !== false;
    updateCategoryFormMode();
    renderAdminCategoryList();
    focusAdminCategoryForm();
    if (typeof adminDraftClear === 'function') adminDraftClear();
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

    section.style.display = 'block';
    renderAdminCategoryBanner();

    const categories = getAllCategoriesSorted();
    const query = getAdminCategorySearchQuery();
    const filtered = query ? categories.filter(cat => categoryMatchesSearch(cat, query)) : categories;

    if (!categories.length) {
        list.innerHTML = '<p class="admin-category-empty">No categories yet — type a name above and tap <strong>Add Category</strong>.</p>';
        updateAdminCategoryCountBadge(0);
        syncAdminCategoryListTools(0, 0);
        highlightAdminCategoryRow(null);
        return;
    }

    if (!filtered.length) {
        list.innerHTML = '<p class="admin-category-empty">No categories match your search.</p>';
        updateAdminCategoryCountBadge(categories.length);
        syncAdminCategoryListTools(categories.length, 0);
        highlightAdminCategoryRow(window.editingCategoryId || null);
        return;
    }

    const counts = getProductCountsByCategory();
    const editingId = window.editingCategoryId || '';
    list.innerHTML = filtered.map((cat, index) => {
        const count = counts[cat.id] || 0;
        const active = cat.isActive !== false;
        const sortOrder = getCategorySortOrder(cat);
        const globalIndex = categories.findIndex(c => c.id === cat.id);
        const canMoveUp = globalIndex > 0;
        const canMoveDown = globalIndex >= 0 && globalIndex < categories.length - 1;
        const isEditing = editingId === cat.id;
        return `
        <div class="admin-category-row${isEditing ? ' is-editing' : ''}${!active ? ' is-hidden-cat' : ''}" data-category-id="${cat.id}">
            <div class="admin-category-row-main" onclick="loadCategoryIntoForm('${cat.id}')" role="button" tabindex="0" aria-label="Edit ${escapeCategoryHtml(cat.name)}">
                <span class="admin-category-order-badge" title="Display order">${sortOrder}</span>
                <div class="admin-category-main">
                    <strong>${escapeCategoryHtml(cat.name)}</strong>
                    <span class="admin-category-meta">${escapeCategoryHtml(cat.slug || slugifyCategoryName(cat.name))}${count ? ` · ${count} product${count === 1 ? '' : 's'}` : ''}</span>
                </div>
            </div>
            <div class="admin-category-actions">
                <span class="admin-category-status ${active ? 'is-active' : 'is-hidden'}">${active ? 'Active' : 'Hidden'}</span>
                <div class="admin-category-icon-actions">
                    <button type="button" class="admin-category-icon-btn" onclick="moveCategoryOrder('${cat.id}', -1)" title="Move up" ${canMoveUp ? '' : 'disabled'}><i class="fa fa-chevron-up"></i></button>
                    <button type="button" class="admin-category-icon-btn" onclick="moveCategoryOrder('${cat.id}', 1)" title="Move down" ${canMoveDown ? '' : 'disabled'}><i class="fa fa-chevron-down"></i></button>
                    <button type="button" class="admin-category-icon-btn admin-category-icon-btn--gold" onclick="loadCategoryIntoForm('${cat.id}')" title="Edit"><i class="fa fa-pencil"></i></button>
                    <button type="button" class="admin-category-icon-btn" onclick="toggleCategoryActive('${cat.id}')" title="${active ? 'Hide on storefront' : 'Show on storefront'}"><i class="fa fa-${active ? 'eye-slash' : 'eye'}"></i></button>
                    <button type="button" class="admin-category-icon-btn admin-category-icon-btn--danger" onclick="deleteCategory('${cat.id}')" title="Delete"><i class="fa fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');

    bindAdminCategoryRowKeys();
    updateAdminCategoryCountBadge(categories.length);
    syncAdminCategoryListTools(categories.length, filtered.length);
    highlightAdminCategoryRow(editingId || null);
}

function bindAdminCategoryRowKeys() {
    document.querySelectorAll('#admin-category-list .admin-category-row-main[role="button"]').forEach(el => {
        if (el.dataset.rowKeyBound) return;
        el.dataset.rowKeyBound = '1';
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const id = el.closest('.admin-category-row')?.dataset?.categoryId;
                if (id) loadCategoryIntoForm(id);
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

function openAdminCategoryAccordion() {
    const content = document.getElementById('admin-category-accordion-content');
    const icon = document.getElementById('admin-category-accordion-icon');
    if (!content) return;
    content.style.display = 'flex';
    if (icon) icon.style.transform = 'rotate(0deg)';
}

window.toggleAdminCategoryAccordion = async function() {
    const content = document.getElementById('admin-category-accordion-content');
    const icon = document.getElementById('admin-category-accordion-icon');
    if (!content) return;

    if (content.style.display === 'none' || !content.style.display) {
        openAdminCategoryAccordion();
        tryOfferCategoryDraftRestore();
        return;
    }
    if (typeof adminGuardCategoryLeave === 'function') {
        const ok = await adminGuardCategoryLeave('Save category changes before closing?', () => {});
        if (!ok) return;
    }
    content.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(-90deg)';
};

function updateCategoryFormMode() {
    const formWrap = document.getElementById('admin-category-form-wrap');
    const modeLabel = document.getElementById('admin-category-form-mode');
    const saveBtn = document.getElementById('admin-category-save-btn');
    const clearBtn = document.getElementById('admin-category-clear-btn');
    const nameEl = document.getElementById('admin-category-name');
    const isEditing = !!window.editingCategoryId;
    const cat = isEditing ? getCategoryById(window.editingCategoryId) : null;
    const hasDraft = !!(nameEl?.value || '').trim();

    if (modeLabel) {
        modeLabel.textContent = isEditing
            ? `Editing “${cat?.name || 'category'}”`
            : 'Add category';
        modeLabel.classList.toggle('is-editing', isEditing);
    }
    if (saveBtn) {
        saveBtn.textContent = isEditing ? 'Save' : 'Add';
        saveBtn.classList.toggle('is-editing', isEditing);
        saveBtn.setAttribute('aria-label', isEditing ? 'Save category' : 'Add category');
    }
    if (clearBtn) {
        clearBtn.textContent = 'Cancel';
        clearBtn.hidden = !isEditing && !hasDraft;
    }
    if (formWrap) {
        formWrap.classList.toggle('admin-category-form-editing', isEditing);
    }
    highlightAdminCategoryRow(isEditing ? window.editingCategoryId : null);
}

function bindCategoryFormUi() {
    const nameEl = document.getElementById('admin-category-name');
    const orderEl = document.getElementById('admin-category-order');
    const activeEl = document.getElementById('admin-category-active');
    const searchEl = document.getElementById('admin-category-search');
    const onChange = () => {
        updateCategoryFormMode();
        if (typeof adminScheduleCategoryDraftSave === 'function') adminScheduleCategoryDraftSave();
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

window.loadCategoryIntoForm = async function(id) {
    if (window.editingCategoryId === id && !isCategoryFormDirty()) return;
    const load = () => loadCategoryIntoFormInternal(id);
    if (typeof adminGuardCategoryLeave === 'function' && isCategoryFormDirty()) {
        await adminGuardCategoryLeave('Save changes before switching category?', load);
        return;
    }
    load();
};

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
    window.editingCategoryId = null;
    const name = document.getElementById('admin-category-name');
    const order = document.getElementById('admin-category-order');
    const active = document.getElementById('admin-category-active');
    if (name) name.value = '';
    if (active) active.checked = true;
    setCategoryFormDefaultOrder();
    renderAdminCategoryList();
    updateCategoryFormMode();
    if (typeof adminDraftClear === 'function') adminDraftClear();
}

function resetCategoryForm() {
    resetCategoryFormInternal();
}

window.openCategoryForm = async function() {
    if (typeof adminGuardCategoryLeave === 'function' && isCategoryFormDirty()) {
        const ok = await adminGuardCategoryLeave('Save changes before clearing the form?', () => resetCategoryFormInternal());
        if (!ok) return;
    } else {
        resetCategoryFormInternal();
    }
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
    loadCategoryIntoForm(id);
};

window.saveCategory = async function() {
    if (!isAdmin) return showToast('Admin only.');
    const nameEl = document.getElementById('admin-category-name');
    const orderEl = document.getElementById('admin-category-order');
    const activeEl = document.getElementById('admin-category-active');
    const name = (nameEl?.value || '').trim();
    if (!name) return showToast('Category name required.');

    let sortOrder;
    if (orderEl?.value === '' || orderEl?.value === null || orderEl?.value === undefined) {
        sortOrder = window.editingCategoryId
            ? getCategorySortOrder(getCategoryById(window.editingCategoryId))
            : getNextCategorySortOrder();
    } else {
        sortOrder = parseCategorySortOrder(orderEl.value, 0);
    }
    if (!window.editingCategoryId && sortOrder === 0 && (window.productCategories || []).length > 0) {
        sortOrder = getNextCategorySortOrder();
    }

    const payload = {
        name,
        slug: slugifyCategoryName(name),
        sortOrder,
        isActive: activeEl ? !!activeEl.checked : true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const duplicate = (window.productCategories || []).find(c =>
        c.id !== window.editingCategoryId &&
        String(c.slug || slugifyCategoryName(c.name)) === payload.slug
    );
    if (duplicate) return showToast('A category with this name already exists.');

    try {
        if (window.editingCategoryId) {
            await db.collection('categories').doc(window.editingCategoryId).set(payload, { merge: true });
            const linkedProducts = getProductsWithCategory(window.editingCategoryId);
            if (linkedProducts.length) {
                const batch = db.batch();
                linkedProducts.forEach(p => {
                    batch.update(db.collection('products').doc(p.id), buildCategoryFieldsFromIds(getProductCategoryIds(p)));
                });
                await batch.commit();
            }
            showToast(linkedProducts.length ? `Category updated (${linkedProducts.length} product${linkedProducts.length === 1 ? '' : 's'} synced).` : 'Category updated.');
        } else {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('categories').add(payload);
            showToast('Category added.');
        }
        resetCategoryForm();
        if (typeof adminDraftClear === 'function') adminDraftClear();
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
        if (window.editingCategoryId === id) resetCategoryForm();
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
