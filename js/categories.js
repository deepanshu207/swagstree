// ==========================================
// SWAG STREE | PRODUCT CATEGORIES
// ==========================================

window.productCategories = window.productCategories || [];
window.filterActiveCategory = window.filterActiveCategory || '';
window.categoriesLoaded = false;

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
    const bar = document.getElementById('home-category-bar');
    if (!bar) return;

    if (!isProductCategoriesEnabled() || !isCatalogControlEnabled('home', 'categories')) {
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
    const active = window.filterActiveCategory || '';

    let html = `<button type="button" class="category-pill${active === '' ? ' active' : ''}" onclick="setHomeCategoryFilter('')">All</button>`;
    categories.forEach(cat => {
        const count = counts[cat.id] || 0;
        html += `<button type="button" class="category-pill${active === cat.id ? ' active' : ''}" onclick="setHomeCategoryFilter('${cat.id}')">${escapeCategoryHtml(cat.name)}${count ? `<span class="category-pill-count">${count}</span>` : ''}</button>`;
    });
    const showUncategorizedHint = typeof isAdmin !== 'undefined' && isAdmin;
    if (showUncategorizedHint && uncategorizedCount > 0 && active === '') {
        html += `<span class="category-pill-hint">${uncategorizedCount} uncategorized</span>`;
    }

    bar.innerHTML = html;
    bar.style.display = 'flex';
}

function renderCategoryFilterChips() {
    const group = document.getElementById('filter-category-group');
    const container = document.getElementById('filter-categories');
    if (!group || !container) return;

    if (!isProductCategoriesEnabled()) {
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
    const active = window.filterActiveCategory || '';
    container.innerHTML = `<div class="size-chip${active === '' ? ' active' : ''}" onclick="setFilterCategory(this, '')">All</div>` +
        categories.map(cat =>
            `<div class="size-chip${active === cat.id ? ' active' : ''}" onclick="setFilterCategory(this, '${cat.id}')">${escapeCategoryHtml(cat.name)}</div>`
        ).join('');
}

window.setHomeCategoryFilter = function(categoryId) {
    window.filterActiveCategory = categoryId || '';
    filterActiveCategory = window.filterActiveCategory;
    displayedProductsLimit = productsPageLimitSetting;
    renderHomeCategoryBar();
    renderCategoryFilterChips();
    if (typeof applySortAndFilter === 'function') applySortAndFilter();
};

window.setFilterCategory = function(el, categoryId) {
    window.filterActiveCategory = categoryId || '';
    filterActiveCategory = window.filterActiveCategory;
    displayedProductsLimit = productsPageLimitSetting;
    renderHomeCategoryBar();
    renderCategoryFilterChips();
    if (typeof applySortAndFilter === 'function') applySortAndFilter();
};

function renderAdminCategoryBanner() {
    const banner = document.getElementById('admin-category-storefront-banner');
    if (!banner) return;

    const storefrontOff = !isProductCategoriesEnabled();
    const barOff = typeof isCatalogControlEnabled === 'function' && !isCatalogControlEnabled('home', 'categories');

    if (storefrontOff) {
        banner.innerHTML = '<div class="admin-category-banner admin-category-banner-warn"><i class="fa fa-info-circle"></i> Storefront categories are <strong>disabled</strong> in Superadmin. You can still create categories here and assign them to products — they will appear once you enable <strong>Product Categories</strong>.</div>';
        banner.style.display = 'block';
    } else if (barOff) {
        banner.innerHTML = '<div class="admin-category-banner"><i class="fa fa-info-circle"></i> The home category bar is hidden. Customers can still filter by category in the filter drawer, or enable <strong>Category Bar</strong> in Superadmin.</div>';
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

    if (isAdminCategoryInlineEditing()) return;

    const categories = getAllCategoriesSorted();

    if (!categories.length) {
        list.innerHTML = '<p style="margin:0; font-size:12px; color:#666;">No categories yet. Enter a name below and click <strong>Add Category</strong>.</p>';
        return;
    }

    const counts = getProductCountsByCategory();
    list.innerHTML = `
        <div class="admin-category-list-header" aria-hidden="true">
            <span class="admin-category-col-order">Order</span>
            <span class="admin-category-col-name">Name</span>
            <span class="admin-category-col-actions">Actions</span>
        </div>` +
        categories.map(cat => {
        const count = counts[cat.id] || 0;
        const active = cat.isActive !== false;
        const sortOrder = getCategorySortOrder(cat);
        return `
        <div class="admin-category-row" data-category-id="${cat.id}">
            <div class="admin-category-fields">
                <input type="number" min="0" step="1" inputmode="numeric"
                    class="admin-category-inline-input admin-category-inline-order"
                    value="${sortOrder}" aria-label="Order for ${escapeCategoryHtml(cat.name)}">
                <div class="admin-category-name-wrap">
                    <input type="text"
                        class="admin-category-inline-input admin-category-inline-name"
                        value="${escapeCategoryHtml(cat.name)}" aria-label="Category name">
                    <span class="admin-category-meta">${escapeCategoryHtml(cat.slug || slugifyCategoryName(cat.name))}${count ? ` · ${count} product${count === 1 ? '' : 's'}` : ''}</span>
                </div>
            </div>
            <div class="admin-category-actions">
                <span class="admin-category-status ${active ? 'is-active' : 'is-hidden'}">${active ? 'Active' : 'Hidden'}</span>
                <button type="button" class="btn-gold admin-category-btn admin-category-btn-muted" onclick="toggleCategoryActive('${cat.id}')">${active ? 'Hide' : 'Show'}</button>
                <button type="button" class="btn-gold admin-category-btn admin-category-btn-danger" onclick="deleteCategory('${cat.id}')">Delete</button>
            </div>
        </div>`;
    }).join('');

    bindAdminCategoryInlineEditors();
}

function bindAdminCategoryInlineEditors() {
    document.querySelectorAll('#admin-category-list .admin-category-inline-input').forEach(el => {
        if (el.dataset.inlineBound) return;
        el.dataset.inlineBound = '1';
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
        el.addEventListener('blur', () => {
            const row = el.closest('.admin-category-row');
            const id = row?.dataset?.categoryId;
            if (id) saveCategoryInline(id);
        });
    });
}

async function saveCategoryInline(id) {
    if (!isAdmin) return showToast('Admin only.');
    const cat = getCategoryById(id);
    const row = document.querySelector(`.admin-category-row[data-category-id="${id}"]`);
    if (!cat || !row) return;

    const nameEl = row.querySelector('.admin-category-inline-name');
    const orderEl = row.querySelector('.admin-category-inline-order');
    const name = (nameEl?.value || '').trim();
    if (!name) {
        showToast('Category name required.');
        if (nameEl) nameEl.value = cat.name || '';
        return;
    }

    const sortOrder = parseCategorySortOrder(orderEl?.value, getCategorySortOrder(cat));
    const slug = slugifyCategoryName(name);
    const duplicate = (window.productCategories || []).find(c =>
        c.id !== id && String(c.slug || slugifyCategoryName(c.name)) === slug
    );
    if (duplicate) {
        showToast('A category with this name already exists.');
        if (nameEl) nameEl.value = cat.name || '';
        if (orderEl) orderEl.value = String(getCategorySortOrder(cat));
        return;
    }

    const unchanged = name === (cat.name || '') && sortOrder === getCategorySortOrder(cat);
    if (unchanged) return;

    try {
        await db.collection('categories').doc(id).set({
            name,
            slug,
            sortOrder,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        const nameChanged = name !== (cat.name || '');
        if (nameChanged) {
            const linkedProducts = getProductsWithCategory(id);
            if (linkedProducts.length) {
                const batch = db.batch();
                linkedProducts.forEach(p => {
                    batch.update(db.collection('products').doc(p.id), buildCategoryFieldsFromIds(getProductCategoryIds(p)));
                });
                await batch.commit();
            }
        }

        showToast(sortOrder !== getCategorySortOrder(cat) ? 'Category order saved.' : 'Category saved.');
    } catch (e) {
        console.error('saveCategoryInline failed:', e);
        showToast('Could not save category.');
        if (nameEl) nameEl.value = cat.name || '';
        if (orderEl) orderEl.value = String(getCategorySortOrder(cat));
    }
}
window.saveCategoryInline = saveCategoryInline;

function resetCategoryForm() {
    window.editingCategoryId = null;
    const name = document.getElementById('admin-category-name');
    const order = document.getElementById('admin-category-order');
    const active = document.getElementById('admin-category-active');
    const saveBtn = document.getElementById('admin-category-save-btn');
    if (name) name.value = '';
    if (order) order.value = '0';
    if (active) active.checked = true;
    if (saveBtn) saveBtn.textContent = 'Add Category';
}

window.openCategoryForm = function() {
    resetCategoryForm();
};

window.scrollToCategoryAdmin = function() {
    if (typeof navigateTo === 'function') navigateTo('admin');
    resetCategoryForm();
    const section = document.getElementById('admin-category-section');
    if (section) {
        setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const nameEl = document.getElementById('admin-category-name');
            if (nameEl) nameEl.focus();
        }, 150);
    }
};

window.editCategory = function(id) {
    const cat = getCategoryById(id);
    if (!cat) return;
    const row = document.querySelector(`.admin-category-row[data-category-id="${id}"]`);
    if (row) {
        const nameEl = row.querySelector('.admin-category-inline-name');
        if (nameEl) {
            nameEl.focus();
            nameEl.select();
            return;
        }
    }
    window.editingCategoryId = id;
    const name = document.getElementById('admin-category-name');
    const order = document.getElementById('admin-category-order');
    const active = document.getElementById('admin-category-active');
    const saveBtn = document.getElementById('admin-category-save-btn');
    if (name) name.value = cat.name || '';
    if (order) order.value = String(getCategorySortOrder(cat));
    if (active) active.checked = cat.isActive !== false;
    if (saveBtn) saveBtn.textContent = 'Update Category';
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
}

function loadProductCategories() {
    if (typeof db === 'undefined') return;
    if (window._categoriesListenerStarted) return;
    window._categoriesListenerStarted = true;
    initCategoryFormKeyboard();

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
        window.filterActiveCategory = match.id;
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
