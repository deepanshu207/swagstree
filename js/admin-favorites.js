// ==========================================
// SWAG STREE | ADMIN LAYOUT & PINNED TOOLS
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
        },
        pinnedTools: {
            ids: ['admin-pinned-tools-slot'],
            title: 'Pinned tools area',
            hint: 'Shortcuts pinned below Products',
            icon: 'fa-thumb-tack',
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

    function adminLayoutDraftGet() {
        if (!_layoutDraft) {
            _layoutDraft = {
                layout: { ...adminLayoutRead() },
                pins: [...adminFavoritesRead()],
                toolVisible: { ...adminToolVisibilityRead() }
            };
        }
        return _layoutDraft;
    }

    function adminLayoutDraftClear() {
        _layoutDraft = null;
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

    function adminIsToolVisible(key) {
        return adminToolVisibilityRead()[key] !== false;
    }

    function adminLayoutIsDirty() {
        if (!_layoutDraft) return false;
        const savedLayout = adminLayoutRead();
        const savedPins = adminFavoritesRead();
        const savedToolVisible = adminToolVisibilityRead();
        const layoutDirty = ADMIN_LAYOUT_ORDER.some(key => !!_layoutDraft.layout[key] !== (savedLayout[key] !== false));
        const pinsDirty = _layoutDraft.pins.length !== savedPins.length
            || _layoutDraft.pins.some(k => !savedPins.includes(k));
        const toolsDirty = STORE_TOOLS_ORDER.some(key => !!_layoutDraft.toolVisible[key] !== (savedToolVisible[key] !== false));
        return layoutDirty || pinsDirty || toolsDirty;
    }

    function adminLayoutUpdateSaveButton() {
        const saveBtn = document.getElementById('admin-layout-save-btn');
        const hint = document.getElementById('admin-layout-unsaved-hint');
        const dirty = adminLayoutIsDirty();
        if (saveBtn) saveBtn.disabled = !dirty;
        if (hint) hint.hidden = !dirty;
    }

    function adminPinnedSlot() {
        return document.getElementById('admin-pinned-tools-slot');
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

    function adminLayoutWrite(prefs, toolVisible) {
        try {
            const payload = { ...prefs, toolVisible: toolVisible || adminToolVisibilityRead() };
            localStorage.setItem(ADMIN_LAYOUT_KEY, JSON.stringify(payload));
        } catch (e) { console.warn('adminLayoutWrite failed:', e); }
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

        const pinnedSlot = adminPinnedSlot();
        if (pinnedSlot) {
            pinnedSlot.classList.remove('admin-layout-hidden');
        }

        if (typeof syncAdminCategoryListToolsFromLayout === 'function') {
            syncAdminCategoryListToolsFromLayout();
        }
    }

    function renderAdminLayoutSettings() {
        const sectionBox = document.getElementById('admin-layout-section-checkboxes');
        const toolRows = document.getElementById('admin-layout-tool-rows');
        if (!sectionBox || !toolRows) return;

        const draft = adminLayoutDraftGet();
        const prefs = draft.layout;
        const favorites = draft.pins;
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

        toolRows.innerHTML = STORE_TOOLS_ORDER.map(key => {
            const meta = ADMIN_FAVORITE_REGISTRY[key];
            if (!meta) return '';
            const visible = toolVisible[key] !== false;
            const pinned = favorites.includes(key);
            const pinDisabled = !visible;
            return `<div class="admin-layout-tool-row${pinDisabled ? ' admin-layout-tool-row--hidden-tool' : ''}${pinned ? ' admin-layout-tool-row--pinned' : ''}">
                <span class="admin-layout-tool-row__name">
                    <i class="fa ${meta.icon}" aria-hidden="true"></i>
                    <span>${meta.title}</span>
                </span>
                <label class="admin-layout-tool-row__check" title="Show ${meta.title} in Admin">
                    <input type="checkbox" data-tool-key="${key}" ${visible ? 'checked' : ''} onchange="adminLayoutDraftToggle('tool', '${key}', this.checked)" aria-label="Show ${meta.title}">
                    <span class="admin-layout-tool-row__check-label">Show</span>
                </label>
                <label class="admin-layout-tool-row__check admin-layout-tool-row__check--pin${pinDisabled ? ' admin-layout-tool-row__check--disabled' : ''}" title="Pin ${meta.title} below Products">
                    <input type="checkbox" data-pin-key="${key}" ${pinned ? 'checked' : ''} ${pinDisabled ? 'disabled' : ''} onchange="adminLayoutDraftToggle('pin', '${key}', this.checked)" aria-label="Pin ${meta.title} below Products">
                    <span class="admin-layout-tool-row__check-label">Pin</span>
                </label>
            </div>`;
        }).join('');

        adminLayoutUpdateSaveButton();
    }

    window.adminLayoutDraftToggle = function(type, key, checked) {
        const draft = adminLayoutDraftGet();
        if (type === 'layout') {
            if (!ADMIN_LAYOUT_REGISTRY[key]) return;
            draft.layout[key] = !!checked;
            if (key === 'categories' && !checked) draft.layout.categorySearch = false;
        } else if (type === 'tool') {
            if (!ADMIN_FAVORITE_REGISTRY[key]) return;
            draft.toolVisible[key] = !!checked;
            if (!checked) draft.pins = draft.pins.filter(k => k !== key);
        } else if (type === 'pin') {
            if (!ADMIN_FAVORITE_REGISTRY[key]) return;
            if (draft.toolVisible[key] === false) return;
            if (checked && !draft.pins.includes(key)) draft.pins.push(key);
            else if (!checked) draft.pins = draft.pins.filter(k => k !== key);
        }
        renderAdminLayoutSettings();
    };

    window.adminSaveLayoutSettings = function() {
        const draft = adminLayoutDraftGet();
        draft.pins = draft.pins.filter(k => draft.toolVisible[k] !== false);
        adminLayoutWrite(draft.layout, draft.toolVisible);
        adminFavoritesWrite(draft.pins);
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

    function adminFavoritesRead() {
        try {
            const raw = localStorage.getItem(ADMIN_FAVORITES_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.filter(k => ADMIN_FAVORITE_REGISTRY[k]);
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    function adminFavoritesWrite(list) {
        try {
            localStorage.setItem(ADMIN_FAVORITES_KEY, JSON.stringify(list));
        } catch (e) { console.warn('adminFavoritesWrite failed:', e); }
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

    function adminExpandFavoriteBlock(key, el) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta) return;
        const node = el || adminResolveToolBlock(key);
        if (node) {
            node.style.display = '';
            node.hidden = false;
            node.classList.add('admin-store-tools-block--pinned');
        }
        if (meta.accordionContentId) {
            adminExpandAccordionPanel(meta.accordionContentId, meta.accordionIconId);
        }
    }

    function adminUnpinBlockVisual(el) {
        if (el) el.classList.remove('admin-store-tools-block--pinned');
    }

    function adminMoveBlock(el, target) {
        if (!el || !target || el.parentNode === target) return;
        target.appendChild(el);
    }

    function renderAdminFavorites() {
        const pinnedSlot = adminPinnedSlot();
        const storeContent = document.getElementById('admin-store-tools-accordion-content');
        if (!pinnedSlot || !storeContent) return;

        adminInitBlockBackups();
        const blocks = adminCollectToolBlocks();
        let favorites = adminFavoritesRead().filter(k => blocks[k] && adminIsBlockVisible(k, blocks[k]));

        const validKeys = favorites.filter(k => blocks[k] && adminIsToolVisible(k));
        if (validKeys.length !== favorites.length) {
            adminFavoritesWrite(validKeys);
            favorites = validKeys;
        }

        STORE_TOOLS_ORDER.forEach(key => {
            let el = blocks[key];
            if (!el) {
                el = adminRecoverToolBlock(key);
                if (el) blocks[key] = el;
            }
            if (!el) return;

            adminSanitizeToolBlock(el);

            if (!adminIsToolVisible(key)) {
                el.classList.add('admin-layout-hidden');
                el.hidden = true;
                return;
            }

            el.classList.remove('admin-layout-hidden');
            el.hidden = false;

            if (!adminIsBlockVisible(key, el)) return;

            const pin = favorites.includes(key);
            const target = pin ? pinnedSlot : storeContent;

            adminMoveBlock(el, target);

            if (pin) {
                adminExpandFavoriteBlock(key, el);
            } else {
                adminUnpinBlockVisual(el);
            }
        });

        const hasPinned = favorites.length > 0;
        pinnedSlot.hidden = !hasPinned;
        pinnedSlot.style.display = hasPinned ? 'block' : 'none';
        pinnedSlot.classList.remove('admin-layout-hidden');

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
    window.adminFavoritesRead = adminFavoritesRead;
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
