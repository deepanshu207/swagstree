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

function getActiveCategories() {
    return (window.productCategories || [])
        .filter(c => c.isActive !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || '')));
}
window.getActiveCategories = getActiveCategories;

function getCategoryById(id) {
    if (!id) return null;
    return (window.productCategories || []).find(c => c.id === id) || null;
}
window.getCategoryById = getCategoryById;

function resolveProductCategoryLabel(product) {
    if (!product) return '';
    if (product.categoryName) return product.categoryName;
    const cat = getCategoryById(product.categoryId);
    return cat ? cat.name : '';
}

function getProductCountsByCategory() {
    const counts = {};
    (window.products || []).forEach(p => {
        const id = p.categoryId || '';
        counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
}

function populateProductCategorySelect(selectedId) {
    const select = document.getElementById('m-category');
    const container = document.getElementById('m-category-container');
    if (!select) return;

    const enabled = isProductCategoriesEnabled();
    if (container) container.style.display = enabled ? 'block' : 'none';
    if (!enabled) return;

    const categories = getActiveCategories();
    select.innerHTML = `<option value="">— No category —</option>` + categories.map(c =>
        `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${escapeCategoryHtml(c.name)}</option>`
    ).join('');
}

function escapeCategoryHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
window.escapeCategoryHtml = escapeCategoryHtml;

function readProductCategoryFromForm() {
    const select = document.getElementById('m-category');
    if (!select || !isProductCategoriesEnabled()) {
        return { categoryId: '', categoryName: '', categorySlug: '' };
    }
    const categoryId = select.value || '';
    const cat = getCategoryById(categoryId);
    return {
        categoryId: categoryId || '',
        categoryName: cat ? cat.name : '',
        categorySlug: cat ? (cat.slug || slugifyCategoryName(cat.name)) : ''
    };
}

function hydrateProductCategoryForm(product) {
    populateProductCategorySelect(product?.categoryId || '');
}

function resolveCategoryIdFromImportValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return { categoryId: '', categoryName: '', categorySlug: '' };

    const byId = getCategoryById(raw);
    if (byId) {
        return {
            categoryId: byId.id,
            categoryName: byId.name,
            categorySlug: byId.slug || slugifyCategoryName(byId.name)
        };
    }

    const lower = raw.toLowerCase();
    const byName = (window.productCategories || []).find(c =>
        String(c.name || '').trim().toLowerCase() === lower ||
        String(c.slug || '').trim().toLowerCase() === lower
    );
    if (byName) {
        return {
            categoryId: byName.id,
            categoryName: byName.name,
            categorySlug: byName.slug || slugifyCategoryName(byName.name)
        };
    }

    return { categoryId: '', categoryName: raw, categorySlug: slugifyCategoryName(raw) };
}

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
        if (count === 0 && active !== cat.id) return;
        html += `<button type="button" class="category-pill${active === cat.id ? ' active' : ''}" onclick="setHomeCategoryFilter('${cat.id}')">${escapeCategoryHtml(cat.name)}${count ? `<span class="category-pill-count">${count}</span>` : ''}</button>`;
    });
    if (uncategorizedCount > 0 && active === '') {
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

function renderAdminCategoryList() {
    const list = document.getElementById('admin-category-list');
    const section = document.getElementById('admin-category-section');
    if (!list || !section) return;

    if (!isProductCategoriesEnabled()) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const categories = [...(window.productCategories || [])].sort((a, b) =>
        (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''))
    );

    if (!categories.length) {
        list.innerHTML = '<p style="margin:0; font-size:12px; color:#666;">No categories yet. Add your first category below.</p>';
        return;
    }

    const counts = getProductCountsByCategory();
    list.innerHTML = categories.map(cat => {
        const count = counts[cat.id] || 0;
        const active = cat.isActive !== false;
        return `
        <div class="admin-category-row">
            <div class="admin-category-main">
                <strong>${escapeCategoryHtml(cat.name)}</strong>
                <span class="admin-category-meta">${escapeCategoryHtml(cat.slug || slugifyCategoryName(cat.name))}${count ? ` · ${count} product${count === 1 ? '' : 's'}` : ''}</span>
            </div>
            <div class="admin-category-actions">
                <span class="admin-category-status ${active ? 'is-active' : 'is-hidden'}">${active ? 'Active' : 'Hidden'}</span>
                <button type="button" class="btn-gold admin-category-btn" onclick="editCategory('${cat.id}')">Edit</button>
                <button type="button" class="btn-gold admin-category-btn admin-category-btn-muted" onclick="toggleCategoryActive('${cat.id}')">${active ? 'Hide' : 'Show'}</button>
                <button type="button" class="btn-gold admin-category-btn admin-category-btn-danger" onclick="deleteCategory('${cat.id}')">Delete</button>
            </div>
        </div>`;
    }).join('');
}

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

window.editCategory = function(id) {
    const cat = getCategoryById(id);
    if (!cat) return;
    window.editingCategoryId = id;
    const name = document.getElementById('admin-category-name');
    const order = document.getElementById('admin-category-order');
    const active = document.getElementById('admin-category-active');
    const saveBtn = document.getElementById('admin-category-save-btn');
    if (name) name.value = cat.name || '';
    if (order) order.value = String(cat.sortOrder || 0);
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

    const payload = {
        name,
        slug: slugifyCategoryName(name),
        sortOrder: Number(orderEl?.value) || 0,
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
            showToast('Category updated.');
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
        ? `Delete "${cat.name}"? ${count} product(s) will become uncategorized.`
        : `Delete "${cat.name}"?`;
    if (!confirm(msg)) return;

    try {
        await db.collection('categories').doc(id).delete();
        if (count > 0) {
            const batch = db.batch();
            (window.products || []).filter(p => p.categoryId === id).forEach(p => {
                batch.update(db.collection('products').doc(p.id), {
                    categoryId: '',
                    categoryName: '',
                    categorySlug: ''
                });
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

function loadProductCategories() {
    if (typeof db === 'undefined') return;
    if (window._categoriesListenerStarted) return;
    window._categoriesListenerStarted = true;

    db.collection('categories').onSnapshot(snap => {
        window.productCategories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.categoriesLoaded = true;
        populateProductCategorySelect(document.getElementById('m-category')?.value || '');
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
