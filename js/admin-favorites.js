// ==========================================
// SWAG STREE | ADMIN LAYOUT & TOOL ORDERING
// ==========================================

(function() {
    const ADMIN_FAVORITES_KEY = 'swagstree_admin_favorites_v1';
    const ADMIN_LAYOUT_KEY = 'swagstree_admin_layout_v1';

    const ADMIN_LAYOUT_REGISTRY = {
        drafts: {
            ids: ['admin-draft-recovery-panel'],
            title: 'Saved drafts',
            hint: 'Draft recovery panel at the top',
            icon: 'fa-file-text-o',
            defaultVisible: true
        },
        viewHeader: {
            ids: ['admin-view-header'],
            title: 'Admin Tools header',
            hint: 'Title and product count badge',
            icon: 'fa-wrench',
            defaultVisible: true
        },
        headerActions: {
            selector: '#admin-view .admin-view-actions',
            title: 'Quick actions',
            hint: '+ Category and + New item buttons',
            icon: 'fa-plus-circle',
            defaultVisible: true
        },
        productSearch: {
            ids: ['admin-product-search-wrap'],
            title: 'Product search',
            icon: 'fa-search',
            defaultVisible: true
        },
        productFilter: {
            ids: ['admin-product-filter-wrap'],
            title: 'Product filter dropdown',
            icon: 'fa-filter',
            defaultVisible: true
        },
        categories: {
            ids: ['admin-category-section'],
            title: 'Product Categories',
            icon: 'fa-tags',
            defaultVisible: true
        },
        categorySearch: {
            ids: ['admin-category-list-tools'],
            title: 'Category search',
            hint: 'Inside the Categories section (3+ categories)',
            icon: 'fa-search',
            defaultVisible: true,
            parentKey: 'categories'
        },
        products: {
            ids: ['admin-products-area'],
            title: 'Products list',
            hint: 'Product rows and pagination',
            icon: 'fa-box-open',
            defaultVisible: true
        }
    };

    const ADMIN_LAYOUT_ORDER = [
        'drafts', 'viewHeader', 'headerActions', 'productSearch', 'productFilter',
        'categories', 'categorySearch', 'products'
    ];

    const ADMIN_FAVORITE_REGISTRY = {
        announcements: {
            id: 'admin-announcement-settings',
            title: 'Global Announcements',
            icon: 'fa-bullhorn',
            accordionContentId: 'announcement-accordion-content',
            accordionIconId: 'announcement-accordion-icon'
        },
        support: {
            id: 'admin-support-inbox-section',
            title: 'Support Chats',
            icon: 'fa-headset',
            accordionContentId: 'admin-support-accordion-content',
            accordionIconId: 'admin-support-accordion-icon'
        },
        comments: {
            id: 'admin-comments-moderation',
            title: 'Reviews Moderation',
            icon: 'fa-comments',
            accordionContentId: 'admin-comments-accordion-content',
            accordionIconId: 'admin-comments-accordion-icon'
        },
        bulk: { id: 'admin-bulk-settings', title: 'Bulk Catalog Actions', icon: 'fa-file-excel-o' },
        cod: { id: 'admin-cod-settings', title: 'COD Advance Payment', icon: 'fa-truck' },
        'max-qty': { id: 'admin-max-qty-settings', title: 'Global Max Cart Quantity', icon: 'fa-shopping-bag' },
        promo: {
            id: 'admin-promo-settings',
            title: 'Promo Codes',
            icon: 'fa-ticket-alt',
            accordionContentId: 'admin-promo-accordion-content',
            accordionIconId: 'admin-promo-accordion-icon'
        },
        pagination: {
            id: 'admin-pagination-settings',
            title: 'Pagination Settings',
            icon: 'fa-list-ol',
            accordionContentId: 'admin-pagination-accordion-content',
            accordionIconId: 'admin-pagination-accordion-icon'
        },
        'feature-content': { id: 'admin-feature-content-settings', title: 'Storefront Content', icon: 'fa-paint-brush' },
        feedback: {
            id: 'admin-feedback-settings',
            title: 'Customer Diaries',
            icon: 'fa-camera',
            accordionContentId: 'admin-feedback-accordion-content',
            accordionIconId: 'admin-feedback-accordion-icon'
        },
        footer: { id: 'admin-footer-settings', title: 'Footer Settings', icon: 'fa-window-minimize' }
    };

    const STORE_TOOLS_ORDER = [
        'bulk', 'cod', 'max-qty', 'promo', 'pagination', 'feature-content',
        'feedback', 'footer', 'announcements', 'support', 'comments'
    ];

    const _blockRefs = {};
    const _blockBackups = {};
    let _backupsReady = false;
    let _layoutDraft = null;
    let _quickSortable = null;
    let _accordionSortable = null;

    function adminPlacementListsEqual(a, b) {
        return a.length === b.length && a.every((k, i) => k === b[i]);
    }

    function adminLegacyPinsRead() {
        try {
            const raw = localStorage.getItem(ADMIN_FAVORITES_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.filter(k => ADMIN_FAVORITE_REGISTRY[k]);
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    function adminToolVisibilityRead() {
        const defaults = {};
        STORE_TOOLS_ORDER.forEach(key => { defaults[key] = true; });
        try {
            const raw = localStorage.getItem(ADMIN_LAYOUT_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                const saved = parsed?.toolVisible;
                if (saved && typeof saved === 'object') {
                    STORE_TOOLS_ORDER.forEach(key => {
                        if (typeof saved[key] === 'boolean') defaults[key] = saved[key];
                    });
                }
            }
        } catch (e) { /* ignore */ }
        return defaults;
    }

    function adminDefaultPlacement(visible) {
        const legacyPins = adminLegacyPinsRead();
        const quick = legacyPins.length
            ? legacyPins.filter(k => visible[k] !== false)
            : [];
        const accordion = STORE_TOOLS_ORDER.filter(k => visible[k] !== false && !quick.includes(k));
        return { quick, accordion };
    }

    function adminToolPlacementRead() {
        const visible = adminToolVisibilityRead();
        try {
            const raw = localStorage.getItem(ADMIN_LAYOUT_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed?.toolQuick) && Array.isArray(parsed?.toolAccordion)) {
                    const known = new Set(STORE_TOOLS_ORDER);
                    const quick = parsed.toolQuick.filter(k => known.has(k));
                    const accordion = parsed.toolAccordion.filter(k => known.has(k) && !quick.includes(k));
                    STORE_TOOLS_ORDER.forEach(key => {
                        if (visible[key] === false) return;
                        if (!quick.includes(key) && !accordion.includes(key)) accordion.push(key);
                    });
                    return { quick, accordion };
                }
            }
        } catch (e) { /* ignore */ }
        return adminDefaultPlacement(visible);
    }

    function adminIsToolVisible(key) {
        return adminToolVisibilityRead()[key] !== false;
    }

    function adminLayoutRead() {
        const defaults = {};
        ADMIN_LAYOUT_ORDER.forEach(key => {
            defaults[key] = ADMIN_LAYOUT_REGISTRY[key]?.defaultVisible !== false;
        });
        try {
            const raw = localStorage.getItem(ADMIN_LAYOUT_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    ADMIN_LAYOUT_ORDER.forEach(key => {
                        if (typeof parsed[key] === 'boolean') defaults[key] = parsed[key];
                    });
                }
            }
        } catch (e) { /* ignore */ }
        return defaults;
    }

    function adminLayoutWrite(prefs, toolVisible, toolQuick, toolAccordion) {
        try {
            localStorage.setItem(ADMIN_LAYOUT_KEY, JSON.stringify({
                ...prefs,
                toolVisible,
                toolQuick,
                toolAccordion
            }));
        } catch (e) { console.warn('adminLayoutWrite failed:', e); }
    }

    function adminLayoutDraftGet() {
        if (!_layoutDraft) {
            const placement = adminToolPlacementRead();
            _layoutDraft = {
                layout: { ...adminLayoutRead() },
                toolVisible: { ...adminToolVisibilityRead() },
                quick: [...placement.quick],
                accordion: [...placement.accordion]
            };
            adminNormalizeDraftPlacement();
        }
        return _layoutDraft;
    }

    function adminNormalizeDraftPlacement() {
        if (!_layoutDraft) return;
        const known = new Set(STORE_TOOLS_ORDER);
        _layoutDraft.quick = _layoutDraft.quick.filter(k => known.has(k));
        _layoutDraft.accordion = _layoutDraft.accordion.filter(k => known.has(k) && !_layoutDraft.quick.includes(k));
        STORE_TOOLS_ORDER.forEach(key => {
            if (_layoutDraft.quick.includes(key) || _layoutDraft.accordion.includes(key)) return;
            _layoutDraft.accordion.push(key);
        });
    }

    function adminLayoutDraftClear() {
        _layoutDraft = null;
    }

    function adminLayoutIsDirty() {
        if (!_layoutDraft) return false;
        const savedLayout = adminLayoutRead();
        const savedVisible = adminToolVisibilityRead();
        const savedPlacement = adminToolPlacementRead();
        const layoutDirty = ADMIN_LAYOUT_ORDER.some(key => !!_layoutDraft.layout[key] !== (savedLayout[key] !== false));
        const toolsDirty = STORE_TOOLS_ORDER.some(key => !!_layoutDraft.toolVisible[key] !== (savedVisible[key] !== false));
        const orderDirty = !adminPlacementListsEqual(_layoutDraft.quick, savedPlacement.quick)
            || !adminPlacementListsEqual(_layoutDraft.accordion, savedPlacement.accordion);
        return layoutDirty || toolsDirty || orderDirty;
    }

    function adminLayoutUpdateSaveButton() {
        const saveBtn = document.getElementById('admin-layout-save-btn');
        const hint = document.getElementById('admin-layout-unsaved-hint');
        const dirty = adminLayoutIsDirty();
        if (saveBtn) saveBtn.disabled = !dirty;
        if (hint) hint.hidden = !dirty;
    }

    function adminQuickSlot() {
        return document.getElementById('admin-pinned-tools-slot');
    }

    function adminLayoutGetElements(meta) {
        if (!meta) return [];
        const nodes = [];
        (meta.ids || []).forEach(id => {
            const el = document.getElementById(id);
            if (el) nodes.push(el);
        });
        if (meta.selector) {
            document.querySelectorAll(meta.selector).forEach(el => nodes.push(el));
        }
        return nodes;
    }

    function adminIsLayoutSectionEnabled(key) {
        const prefs = adminLayoutRead();
        const meta = ADMIN_LAYOUT_REGISTRY[key];
        if (!meta) return true;
        if (prefs[key] === false) return false;
        if (meta.parentKey && prefs[meta.parentKey] === false) return false;
        return true;
    }

    function adminSanitizeToolBlock(el) {
        if (!el) return;
        el.querySelectorAll('.admin-favorite-toggle, .admin-pinned-badge').forEach(node => node.remove());
    }

    function adminToolItemHtml(key, visible) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta) return '';
        return `<div class="admin-layout-tool-item${visible ? '' : ' admin-layout-tool-item--off'}" data-tool-key="${key}">
            <button type="button" class="admin-layout-drag-handle" aria-label="Drag ${meta.title} to reorder" title="Drag to reorder">
                <i class="fa fa-bars" aria-hidden="true"></i>
            </button>
            <span class="admin-layout-tool-item__name">
                <i class="fa ${meta.icon}" aria-hidden="true"></i>
                <span>${meta.title}</span>
            </span>
            <div class="admin-layout-tool-item__nudge">
                <button type="button" class="admin-layout-nudge-btn" onclick="adminLayoutNudgeTool('${key}', -1)" aria-label="Move ${meta.title} up" title="Move up">↑</button>
                <button type="button" class="admin-layout-nudge-btn" onclick="adminLayoutNudgeTool('${key}', 1)" aria-label="Move ${meta.title} down" title="Move down">↓</button>
            </div>
            <label class="admin-layout-tool-item__show" title="Show ${meta.title} in Admin">
                <input type="checkbox" ${visible ? 'checked' : ''} onchange="adminLayoutDraftToggle('tool', '${key}', this.checked)" aria-label="Show ${meta.title}">
                <span>Show</span>
            </label>
        </div>`;
    }

    function adminDestroyToolSortables() {
        if (_quickSortable) {
            _quickSortable.destroy();
            _quickSortable = null;
        }
        if (_accordionSortable) {
            _accordionSortable.destroy();
            _accordionSortable = null;
        }
    }

    function adminReadPlacementFromDom() {
        const read = (id) => Array.from(document.querySelectorAll(`#${id} .admin-layout-tool-item`))
            .map(el => el.dataset.toolKey)
            .filter(Boolean);
        return {
            quick: read('admin-layout-quick-list'),
            accordion: read('admin-layout-accordion-list')
        };
    }

    function adminBindToolSortables() {
        adminDestroyToolSortables();
        if (!window.Sortable) return;
        const quickEl = document.getElementById('admin-layout-quick-list');
        const accEl = document.getElementById('admin-layout-accordion-list');
        if (!quickEl || !accEl) return;

        const opts = {
            group: 'admin-tool-order',
            animation: 160,
            handle: '.admin-layout-drag-handle',
            draggable: '.admin-layout-tool-item',
            ghostClass: 'admin-layout-tool-item--ghost',
            chosenClass: 'admin-layout-tool-item--chosen',
            onEnd() {
                const draft = adminLayoutDraftGet();
                const next = adminReadPlacementFromDom();
                draft.quick = next.quick;
                draft.accordion = next.accordion;
                adminNormalizeDraftPlacement();
                adminLayoutUpdateSaveButton();
            }
        };
        _quickSortable = Sortable.create(quickEl, opts);
        _accordionSortable = Sortable.create(accEl, opts);
    }

    function renderAdminLayoutSettings() {
        const sectionBox = document.getElementById('admin-layout-section-checkboxes');
        const quickList = document.getElementById('admin-layout-quick-list');
        const accordionList = document.getElementById('admin-layout-accordion-list');
        if (!sectionBox || !quickList || !accordionList) return;

        adminDestroyToolSortables();

        const draft = adminLayoutDraftGet();
        const prefs = draft.layout;
        const toolVisible = draft.toolVisible;

        sectionBox.innerHTML = ADMIN_LAYOUT_ORDER.map(key => {
            const meta = ADMIN_LAYOUT_REGISTRY[key];
            if (!meta) return '';
            const checked = prefs[key] !== false;
            const disabled = meta.parentKey && prefs[meta.parentKey] === false;
            const hint = meta.hint ? `<span class="admin-layout-checkbox__hint">${meta.hint}</span>` : '';
            const icon = meta.icon ? `<i class="fa ${meta.icon}" aria-hidden="true"></i> ` : '';
            return `<label class="admin-layout-checkbox${disabled ? ' admin-layout-checkbox--disabled' : ''}">
                <input type="checkbox" data-layout-key="${key}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="adminLayoutDraftToggle('layout', '${key}', this.checked)">
                <span class="admin-layout-checkbox__text">
                    <span class="admin-layout-checkbox__label">${icon}${meta.title}</span>
                    ${hint}
                </span>
            </label>`;
        }).join('');

        quickList.innerHTML = draft.quick.map(key => adminToolItemHtml(key, toolVisible[key] !== false)).join('');
        accordionList.innerHTML = draft.accordion.map(key => adminToolItemHtml(key, toolVisible[key] !== false)).join('');

        adminBindToolSortables();
        adminLayoutUpdateSaveButton();
    }

    function adminSwapInList(list, index, delta) {
        const next = index + delta;
        if (next < 0 || next >= list.length) return;
        const tmp = list[index];
        list[index] = list[next];
        list[next] = tmp;
    }

    window.adminLayoutNudgeTool = function(key, delta) {
        const draft = adminLayoutDraftGet();
        let list = draft.quick.includes(key) ? draft.quick : draft.accordion;
        const index = list.indexOf(key);
        if (index < 0) return;
        adminSwapInList(list, index, delta);
        renderAdminLayoutSettings();
    };

    window.adminLayoutDraftToggle = function(type, key, checked) {
        const draft = adminLayoutDraftGet();
        if (type === 'layout') {
            if (!ADMIN_LAYOUT_REGISTRY[key]) return;
            draft.layout[key] = !!checked;
            if (key === 'categories' && !checked) draft.layout.categorySearch = false;
        } else if (type === 'tool') {
            if (!ADMIN_FAVORITE_REGISTRY[key]) return;
            draft.toolVisible[key] = !!checked;
            if (!checked) {
                draft.quick = draft.quick.filter(k => k !== key);
                if (!draft.accordion.includes(key)) draft.accordion.push(key);
            }
        }
        renderAdminLayoutSettings();
    };

    window.adminSaveLayoutSettings = function() {
        const draft = adminLayoutDraftGet();
        const next = adminReadPlacementFromDom();
        draft.quick = next.quick.filter(k => draft.toolVisible[k] !== false);
        draft.accordion = next.accordion.filter(k => draft.toolVisible[k] !== false && !draft.quick.includes(k));
        adminNormalizeDraftPlacement();
        adminLayoutWrite(draft.layout, draft.toolVisible, draft.quick, draft.accordion);
        adminLayoutDraftClear();
        renderAdminFavorites();
        if (typeof renderAdminDraftRecoveryPanel === 'function') renderAdminDraftRecoveryPanel();
        if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();
        showToast('Admin layout saved.');
    };

    window.adminResetLayoutDraft = function() {
        adminLayoutDraftClear();
        renderAdminLayoutSettings();
        showToast('Changes discarded.');
    };

    function applyAdminLayout() {
        const prefs = adminLayoutRead();
        ADMIN_LAYOUT_ORDER.forEach(key => {
            const meta = ADMIN_LAYOUT_REGISTRY[key];
            if (!meta) return;
            const parentOk = !meta.parentKey || prefs[meta.parentKey] !== false;
            const visible = prefs[key] !== false && parentOk;
            adminLayoutGetElements(meta).forEach(el => {
                el.classList.toggle('admin-layout-hidden', !visible);
            });
        });

        const toolbar = document.getElementById('admin-product-toolbar');
        if (toolbar) {
            const showToolbar = prefs.productSearch !== false || prefs.productFilter !== false;
            toolbar.classList.toggle('admin-layout-hidden', !showToolbar);
        }

        if (typeof syncAdminCategoryListToolsFromLayout === 'function') {
            syncAdminCategoryListToolsFromLayout();
        }
    }

    function adminInitBlockBackups() {
        if (_backupsReady) return;
        STORE_TOOLS_ORDER.forEach(key => {
            const meta = ADMIN_FAVORITE_REGISTRY[key];
            if (!meta || _blockBackups[key]) return;
            const el = document.getElementById(meta.id);
            if (el) {
                const clone = el.cloneNode(true);
                adminSanitizeToolBlock(clone);
                _blockBackups[key] = clone;
            }
        });
        _backupsReady = true;
    }

    function adminRecoverToolBlock(key) {
        const existing = adminGetToolBlock(key);
        if (existing) return existing;

        const meta = ADMIN_FAVORITE_REGISTRY[key];
        const backup = _blockBackups[key];
        if (!meta || !backup) return null;

        const restored = backup.cloneNode(true);
        restored.id = meta.id;
        restored.hidden = false;
        restored.style.display = '';
        adminSanitizeToolBlock(restored);
        _blockRefs[key] = restored;
        console.warn(`[admin-favorites] Restored missing block: ${meta.title}`);
        return restored;
    }

    function adminResolveToolBlock(key) {
        adminInitBlockBackups();
        return adminRecoverToolBlock(key) || adminGetToolBlock(key);
    }

    function adminGetToolBlock(key) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta) return null;
        const live = document.getElementById(meta.id);
        if (live) {
            adminSanitizeToolBlock(live);
            _blockRefs[key] = live;
            return live;
        }
        const cached = _blockRefs[key];
        if (cached && cached.id === meta.id) return cached;
        return null;
    }

    function adminCollectToolBlocks() {
        adminInitBlockBackups();
        const blocks = {};
        STORE_TOOLS_ORDER.forEach(key => {
            const el = adminResolveToolBlock(key);
            if (el) blocks[key] = el;
        });
        return blocks;
    }

    function adminIsBlockVisible(key, el) {
        const node = el || adminResolveToolBlock(key);
        if (!node) return false;
        if (!adminIsToolVisible(key)) return false;
        if (key === 'support' || key === 'comments') {
            return node.style.display !== 'none' && getComputedStyle(node).display !== 'none';
        }
        return true;
    }

    function adminExpandAccordionPanel(contentId, iconId) {
        const content = contentId && document.getElementById(contentId);
        const icon = iconId && document.getElementById(iconId);
        if (content) content.style.display = 'flex';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }

    function adminPrepareQuickBlock(key, el) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!el) return;
        el.style.display = '';
        el.hidden = false;
        el.classList.add('admin-store-tools-block--quick');
        if (meta?.accordionContentId) {
            adminExpandAccordionPanel(meta.accordionContentId, meta.accordionIconId);
        }
    }

    function adminPrepareAccordionBlock(el) {
        if (!el) return;
        el.classList.remove('admin-store-tools-block--quick');
    }

    function adminMoveBlock(el, target) {
        if (!el || !target || el.parentNode === target) return;
        target.appendChild(el);
    }

    function adminPlaceToolsInOrder(keys, blocks, target, prepareFn) {
        keys.forEach(key => {
            const el = blocks[key];
            if (!el || !adminIsBlockVisible(key, el)) return;
            adminSanitizeToolBlock(el);
            el.classList.remove('admin-layout-hidden');
            el.hidden = false;
            adminMoveBlock(el, target);
            prepareFn(key, el);
        });
    }

    function renderAdminFavorites() {
        const quickSlot = adminQuickSlot();
        const storeContent = document.getElementById('admin-store-tools-accordion-content');
        const layoutSettings = document.getElementById('admin-layout-settings');
        if (!quickSlot || !storeContent) return;

        adminInitBlockBackups();
        const blocks = adminCollectToolBlocks();
        const placement = adminToolPlacementRead();

        STORE_TOOLS_ORDER.forEach(key => {
            const el = blocks[key];
            if (!el) return;
            if (!adminIsToolVisible(key)) {
                adminSanitizeToolBlock(el);
                el.classList.add('admin-layout-hidden');
                el.hidden = true;
                return;
            }
            el.classList.remove('admin-layout-hidden');
            el.hidden = false;
        });

        adminPlaceToolsInOrder(placement.quick, blocks, quickSlot, adminPrepareQuickBlock);
        if (layoutSettings && layoutSettings.parentNode === storeContent) {
            storeContent.insertBefore(layoutSettings, storeContent.firstChild);
        }
        adminPlaceToolsInOrder(placement.accordion, blocks, storeContent, (_, el) => adminPrepareAccordionBlock(el));

        const hasQuick = placement.quick.some(k => adminIsToolVisible(k) && blocks[k] && adminIsBlockVisible(k, blocks[k]));
        quickSlot.hidden = !hasQuick;
        quickSlot.style.display = hasQuick ? 'block' : 'none';

        applyAdminLayout();
        renderAdminLayoutSettings();
    }

    window.adminIsToolBlockPinned = function(blockId) {
        const el = typeof blockId === 'string' ? document.getElementById(blockId) : blockId;
        return !!(el && el.closest('#admin-pinned-tools-slot'));
    };

    window.adminEnsureParentStoreToolsOpen = function(blockId) {
        if (blockId && adminIsToolBlockPinned(blockId)) return;
        if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
    };

    window.renderAdminFavorites = renderAdminFavorites;
    window.adminFavoritesRead = () => adminToolPlacementRead().quick;
    window.adminFavoriteRegistryKeys = () => [...STORE_TOOLS_ORDER];
    window.adminGetToolBlock = adminResolveToolBlock;
    window.adminIsLayoutSectionEnabled = adminIsLayoutSectionEnabled;
    window.adminIsToolVisible = adminIsToolVisible;
    window.applyAdminLayout = applyAdminLayout;
    window.renderAdminLayoutSettings = renderAdminLayoutSettings;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.admin-favorite-toggle, .admin-pinned-badge').forEach(el => el.remove());
        adminInitBlockBackups();
        renderAdminFavorites();
        applyAdminLayout();
    });
})();
