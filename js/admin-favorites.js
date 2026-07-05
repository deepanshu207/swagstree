// ==========================================
// SWAG STREE | ADMIN LAYOUT & BLOCK ORDERING
// ==========================================

(function() {
    const ADMIN_FAVORITES_KEY = 'swagstree_admin_favorites_v1';
    const ADMIN_LAYOUT_KEY = 'swagstree_admin_layout_v1';

    const SECTION_REGISTRY = {
        drafts: {
            title: 'Saved drafts',
            hint: 'Draft recovery panel',
            icon: 'fa-file-text-o',
            ids: ['admin-draft-recovery-panel']
        },
        viewHeader: {
            title: 'Admin Tools header',
            hint: 'Title and product count',
            icon: 'fa-wrench',
            ids: ['admin-view-header']
        },
        headerActions: {
            title: 'Quick actions',
            hint: '+ Category and + New item',
            icon: 'fa-plus-circle',
            selector: '#admin-view .admin-view-actions'
        },
        productSearch: {
            title: 'Product search',
            icon: 'fa-search',
            ids: ['admin-product-search-wrap']
        },
        productFilter: {
            title: 'Product filter dropdown',
            icon: 'fa-filter',
            ids: ['admin-product-filter-wrap']
        },
        categories: {
            title: 'Product Categories',
            icon: 'fa-tags',
            ids: ['admin-category-section']
        },
        categorySearch: {
            title: 'Category search',
            hint: 'Inside Categories (3+ items)',
            icon: 'fa-search',
            ids: ['admin-category-list-tools'],
            parentKey: 'categories',
            sortable: false
        },
        products: {
            title: 'Products list',
            hint: 'Rows and pagination',
            icon: 'fa-box-open',
            ids: ['admin-products-area']
        }
    };

    const TOOL_REGISTRY = {
        bulk: { title: 'Bulk Catalog Actions', icon: 'fa-file-excel-o', id: 'admin-bulk-settings' },
        cod: { title: 'COD Advance Payment', icon: 'fa-truck', id: 'admin-cod-settings' },
        'max-qty': { title: 'Global Max Cart Quantity', icon: 'fa-shopping-bag', id: 'admin-max-qty-settings' },
        promo: {
            title: 'Promo Codes', icon: 'fa-ticket-alt', id: 'admin-promo-settings',
            accordionContentId: 'admin-promo-accordion-content', accordionIconId: 'admin-promo-accordion-icon'
        },
        pagination: {
            title: 'Pagination Settings', icon: 'fa-list-ol', id: 'admin-pagination-settings',
            accordionContentId: 'admin-pagination-accordion-content', accordionIconId: 'admin-pagination-accordion-icon'
        },
        'feature-content': { title: 'Storefront Content', icon: 'fa-paint-brush', id: 'admin-feature-content-settings' },
        feedback: {
            title: 'Customer Diaries', icon: 'fa-camera', id: 'admin-feedback-settings',
            accordionContentId: 'admin-feedback-accordion-content', accordionIconId: 'admin-feedback-accordion-icon'
        },
        footer: { title: 'Footer Settings', icon: 'fa-window-minimize', id: 'admin-footer-settings' },
        announcements: {
            title: 'Global Announcements', icon: 'fa-bullhorn', id: 'admin-announcement-settings',
            accordionContentId: 'announcement-accordion-content', accordionIconId: 'announcement-accordion-icon'
        },
        support: {
            title: 'Support Chats', icon: 'fa-headset', id: 'admin-support-inbox-section',
            accordionContentId: 'admin-support-accordion-content', accordionIconId: 'admin-support-accordion-icon'
        },
        comments: {
            title: 'Reviews Moderation', icon: 'fa-comments', id: 'admin-comments-moderation',
            accordionContentId: 'admin-comments-accordion-content', accordionIconId: 'admin-comments-accordion-icon'
        }
    };

    const SECTION_KEYS = [
        'drafts', 'viewHeader', 'headerActions', 'productSearch', 'productFilter',
        'categories', 'categorySearch', 'products'
    ];

    const TOOL_KEYS = [
        'bulk', 'cod', 'max-qty', 'promo', 'pagination', 'feature-content',
        'feedback', 'footer', 'announcements', 'support', 'comments'
    ];

    const SORTABLE_BLOCK_KEYS = [...SECTION_KEYS.filter(k => SECTION_REGISTRY[k]?.sortable !== false), ...TOOL_KEYS];

    const DEFAULT_ABOVE = [
        'drafts', 'viewHeader', 'headerActions', 'productSearch', 'productFilter', 'categories', 'products'
    ];

    const DEFAULT_INSIDE = [...TOOL_KEYS];

    const _blockRefs = {};
    const _blockBackups = {};
    let _backupsReady = false;
    let _layoutDraft = null;
    let _aboveSortable = null;
    let _insideSortable = null;

    function adminBlockMeta(key) {
        return SECTION_REGISTRY[key] || TOOL_REGISTRY[key] || null;
    }

    function adminIsToolKey(key) {
        return TOOL_KEYS.includes(key);
    }

    function adminListsEqual(a, b) {
        return a.length === b.length && a.every((k, i) => k === b[i]);
    }

    function adminDefaultVisible() {
        const vis = {};
        [...SECTION_KEYS, ...TOOL_KEYS].forEach(key => { vis[key] = true; });
        return vis;
    }

    function adminBlockVisibilityRead() {
        const defaults = adminDefaultVisible();
        try {
            const raw = localStorage.getItem(ADMIN_LAYOUT_KEY);
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            if (parsed?.blockVisible && typeof parsed.blockVisible === 'object') {
                Object.keys(parsed.blockVisible).forEach(key => {
                    if (typeof parsed.blockVisible[key] === 'boolean') defaults[key] = parsed.blockVisible[key];
                });
                return defaults;
            }
            if (parsed?.toolVisible) {
                TOOL_KEYS.forEach(key => {
                    if (typeof parsed.toolVisible[key] === 'boolean') defaults[key] = parsed.toolVisible[key];
                });
            }
            SECTION_KEYS.forEach(key => {
                if (typeof parsed[key] === 'boolean') defaults[key] = parsed[key];
            });
        } catch (e) { /* ignore */ }
        return defaults;
    }

    function adminLegacyPinsRead() {
        try {
            const raw = localStorage.getItem(ADMIN_FAVORITES_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.filter(k => TOOL_REGISTRY[k]);
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    function adminPlacementRead() {
        const visible = adminBlockVisibilityRead();
        try {
            const raw = localStorage.getItem(ADMIN_LAYOUT_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed?.aboveOrder) && Array.isArray(parsed?.insideOrder)) {
                    return adminNormalizePlacement(
                        parsed.aboveOrder.filter(k => SORTABLE_BLOCK_KEYS.includes(k)),
                        parsed.insideOrder.filter(k => SORTABLE_BLOCK_KEYS.includes(k)),
                        visible,
                        parsed.blockVisible?.categorySearch !== false
                    );
                }
                if (Array.isArray(parsed?.toolQuick) && Array.isArray(parsed?.toolAccordion)) {
                    const above = [
                        ...DEFAULT_ABOVE.filter(k => visible[k] !== false),
                        ...parsed.toolQuick.filter(k => TOOL_KEYS.includes(k) && visible[k] !== false)
                    ];
                    const inside = parsed.toolAccordion.filter(k => TOOL_KEYS.includes(k));
                    return adminNormalizePlacement(above, inside, visible, visible.categorySearch !== false);
                }
            }
        } catch (e) { /* ignore */ }
        const legacyPins = adminLegacyPinsRead();
        const above = [
            ...DEFAULT_ABOVE.filter(k => visible[k] !== false),
            ...legacyPins.filter(k => visible[k] !== false)
        ];
        const inside = DEFAULT_INSIDE.filter(k => visible[k] !== false && !above.includes(k));
        return adminNormalizePlacement(above, inside, visible, visible.categorySearch !== false);
    }

    function adminNormalizePlacement(above, inside, visible, categorySearchOn) {
        const known = new Set(SORTABLE_BLOCK_KEYS);
        const cleanAbove = [];
        const seen = new Set();
        above.forEach(key => {
            if (!known.has(key) || seen.has(key)) return;
            cleanAbove.push(key);
            seen.add(key);
        });
        const cleanInside = [];
        inside.forEach(key => {
            if (!known.has(key) || seen.has(key)) return;
            cleanInside.push(key);
            seen.add(key);
        });
        SORTABLE_BLOCK_KEYS.forEach(key => {
            if (seen.has(key)) return;
            cleanInside.push(key);
            seen.add(key);
        });
        const vis = visible || adminBlockVisibilityRead();
        if (categorySearchOn !== false && vis.categories !== false) {
            vis.categorySearch = true;
        }
        return { above: cleanAbove, inside: cleanInside, visible: vis };
    }

    function adminIsBlockShown(key) {
        const vis = adminBlockVisibilityRead();
        const meta = adminBlockMeta(key);
        if (!meta) return true;
        if (vis[key] === false) return false;
        if (meta.parentKey && vis[meta.parentKey] === false) return false;
        return true;
    }

    function adminIsLayoutSectionEnabled(key) {
        return adminIsBlockShown(key);
    }

    function adminIsToolVisible(key) {
        return adminIsBlockShown(key);
    }

    function adminLayoutWrite(visible, above, inside) {
        try {
            localStorage.setItem(ADMIN_LAYOUT_KEY, JSON.stringify({
                version: 2,
                blockVisible: visible,
                aboveOrder: above,
                insideOrder: inside
            }));
        } catch (e) { console.warn('adminLayoutWrite failed:', e); }
    }

    function adminLayoutDraftGet() {
        if (!_layoutDraft) {
            const saved = adminPlacementRead();
            _layoutDraft = {
                visible: { ...saved.visible },
                above: [...saved.above],
                inside: [...saved.inside]
            };
        }
        return _layoutDraft;
    }

    function adminLayoutDraftClear() {
        _layoutDraft = null;
    }

    function adminLayoutIsDirty() {
        if (!_layoutDraft) return false;
        const saved = adminPlacementRead();
        const visDirty = [...SECTION_KEYS, ...TOOL_KEYS].some(key =>
            !!_layoutDraft.visible[key] !== (saved.visible[key] !== false)
        );
        const aboveDirty = !adminListsEqual(_layoutDraft.above, saved.above);
        const insideDirty = !adminListsEqual(_layoutDraft.inside, saved.inside);
        return visDirty || aboveDirty || insideDirty;
    }

    function adminLayoutUpdateSaveButton() {
        const saveBtn = document.getElementById('admin-layout-save-btn');
        const hint = document.getElementById('admin-layout-unsaved-hint');
        const dirty = adminLayoutIsDirty();
        if (saveBtn) saveBtn.disabled = !dirty;
        if (hint) hint.hidden = !dirty;
    }

    function adminAboveSlot() {
        return document.getElementById('admin-above-settings-slot');
    }

    function adminBlockElements(key) {
        const meta = adminBlockMeta(key);
        if (!meta) return [];
        if (meta.id) {
            const el = document.getElementById(meta.id);
            return el ? [el] : [];
        }
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

    function adminSanitizeBlock(el) {
        if (!el) return;
        el.querySelectorAll('.admin-favorite-toggle, .admin-pinned-badge').forEach(n => n.remove());
    }

    function adminBlockItemHtml(key, visible, nested) {
        const meta = adminBlockMeta(key);
        if (!meta) return '';
        const hint = meta.hint ? `<span class="admin-layout-block-item__hint">${meta.hint}</span>` : '';
        const parentOff = meta.parentKey && visible[meta.parentKey] === false;
        const drag = nested
            ? '<span class="admin-layout-drag-handle admin-layout-drag-handle--nested" aria-hidden="true">↳</span>'
            : `<button type="button" class="admin-layout-drag-handle" aria-label="Drag ${meta.title}" title="Drag to reorder"><i class="fa fa-bars" aria-hidden="true"></i></button>`;
        return `<div class="admin-layout-block-item${nested ? ' admin-layout-block-item--nested' : ''}${visible[key] !== false && !parentOff ? '' : ' admin-layout-block-item--off'}" data-block-key="${key}">
            ${drag}
            <span class="admin-layout-block-item__name">
                <i class="fa ${meta.icon}" aria-hidden="true"></i>
                <span>${meta.title}${hint}</span>
            </span>
            ${nested ? '<span class="admin-layout-block-item__nudge admin-layout-block-item__nudge--spacer"></span>' : `<div class="admin-layout-block-item__nudge">
                <button type="button" class="admin-layout-nudge-btn" onclick="adminLayoutNudgeBlock('${key}', -1)" aria-label="Move up">↑</button>
                <button type="button" class="admin-layout-nudge-btn" onclick="adminLayoutNudgeBlock('${key}', 1)" aria-label="Move down">↓</button>
            </div>`}
            <label class="admin-layout-block-item__show">
                <input type="checkbox" ${visible[key] !== false && !parentOff ? 'checked' : ''} ${parentOff ? 'disabled' : ''} onchange="adminLayoutDraftToggle('${key}', this.checked)" aria-label="Show ${meta.title}">
                <span>Show</span>
            </label>
        </div>`;
    }

    function adminDestroySortables() {
        _aboveSortable?.destroy();
        _insideSortable?.destroy();
        _aboveSortable = _insideSortable = null;
    }

    function adminReadOrderFromDom() {
        const read = (id) => Array.from(document.querySelectorAll(`#${id} .admin-layout-block-item:not(.admin-layout-block-item--nested)`))
            .map(el => el.dataset.blockKey)
            .filter(k => k && SORTABLE_BLOCK_KEYS.includes(k));
        return {
            above: read('admin-layout-above-list'),
            inside: read('admin-layout-inside-list')
        };
    }

    function adminLayoutZoneIsOpen(zone) {
        window._adminLayoutZoneOpen = window._adminLayoutZoneOpen || { above: false, inside: false };
        return window._adminLayoutZoneOpen[zone] === true;
    }

    function adminSyncLayoutZoneAccordions() {
        ['above', 'inside'].forEach(zone => {
            const open = adminLayoutZoneIsOpen(zone);
            const content = document.getElementById(`admin-layout-${zone}-content`);
            const icon = document.getElementById(`admin-layout-${zone}-icon`);
            const head = content?.closest('.admin-layout-zone-accordion')?.querySelector('.admin-layout-zone-accordion__head');
            if (content) content.style.display = open ? 'block' : 'none';
            if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
            if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    window.toggleAdminLayoutZoneAccordion = function(zone) {
        window._adminLayoutZoneOpen = window._adminLayoutZoneOpen || { above: false, inside: false };
        window._adminLayoutZoneOpen[zone] = !adminLayoutZoneIsOpen(zone);
        adminSyncLayoutZoneAccordions();
    };

    function adminUpdateLayoutZoneCounts(aboveLen, insideLen) {
        const aboveCount = document.getElementById('admin-layout-above-count');
        const insideCount = document.getElementById('admin-layout-inside-count');
        if (aboveCount) aboveCount.textContent = `${aboveLen} item${aboveLen === 1 ? '' : 's'}`;
        if (insideCount) insideCount.textContent = `${insideLen} item${insideLen === 1 ? '' : 's'}`;
    }

    function adminBindSortables() {
        adminDestroySortables();
        if (!window.Sortable) return;
        const aboveEl = document.getElementById('admin-layout-above-list');
        const insideEl = document.getElementById('admin-layout-inside-list');
        if (!aboveEl || !insideEl) return;
        const opts = {
            group: 'admin-block-order',
            animation: 160,
            handle: '.admin-layout-drag-handle:not(.admin-layout-drag-handle--nested)',
            draggable: '.admin-layout-block-item:not(.admin-layout-block-item--nested)',
            ghostClass: 'admin-layout-block-item--ghost',
            chosenClass: 'admin-layout-block-item--chosen',
            onEnd() {
                const draft = adminLayoutDraftGet();
                const next = adminReadOrderFromDom();
                draft.above = next.above;
                draft.inside = next.inside;
                adminLayoutUpdateSaveButton();
            }
        };
        _aboveSortable = Sortable.create(aboveEl, opts);
        _insideSortable = Sortable.create(insideEl, opts);
    }

    function renderAdminLayoutSettings() {
        const aboveList = document.getElementById('admin-layout-above-list');
        const insideList = document.getElementById('admin-layout-inside-list');
        if (!aboveList || !insideList) return;

        adminDestroySortables();
        const draft = adminLayoutDraftGet();

        const allKeys = new Set([...draft.above, ...draft.inside]);
        SORTABLE_BLOCK_KEYS.forEach(key => {
            if (!allKeys.has(key)) draft.inside.push(key);
        });

        const buildZoneHtml = (keys) => keys.map(key => {
            let html = adminBlockItemHtml(key, draft.visible);
            if (key === 'categories') html += adminBlockItemHtml('categorySearch', draft.visible, true);
            return html;
        }).join('');

        aboveList.innerHTML = buildZoneHtml(draft.above);
        insideList.innerHTML = buildZoneHtml(draft.inside);

        adminBindSortables();
        adminLayoutUpdateSaveButton();
    }

    function adminSwapInList(list, index, delta) {
        const next = index + delta;
        if (next < 0 || next >= list.length) return;
        [list[index], list[next]] = [list[next], list[index]];
    }

    window.adminLayoutNudgeBlock = function(key, delta) {
        const draft = adminLayoutDraftGet();
        const list = draft.above.includes(key) ? draft.above : draft.inside;
        const index = list.indexOf(key);
        if (index < 0) return;
        adminSwapInList(list, index, delta);
        renderAdminLayoutSettings();
    };

    window.adminLayoutDraftToggle = function(key, checked) {
        const draft = adminLayoutDraftGet();
        if (!adminBlockMeta(key)) return;
        draft.visible[key] = !!checked;
        if (key === 'categories' && !checked) draft.visible.categorySearch = false;
        renderAdminLayoutSettings();
    };

    window.adminSaveLayoutSettings = function() {
        const draft = adminLayoutDraftGet();
        const next = adminReadOrderFromDom();
        draft.above = next.above;
        draft.inside = next.inside;
        adminLayoutWrite(draft.visible, draft.above, draft.inside);
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

    function adminInitBlockBackups() {
        if (_backupsReady) return;
        TOOL_KEYS.forEach(key => {
            const meta = TOOL_REGISTRY[key];
            if (!meta || _blockBackups[key]) return;
            const el = document.getElementById(meta.id);
            if (el) {
                const clone = el.cloneNode(true);
                adminSanitizeBlock(clone);
                _blockBackups[key] = clone;
            }
        });
        _backupsReady = true;
    }

    function adminRecoverToolBlock(key) {
        const live = adminGetToolBlock(key);
        if (live) return live;
        const meta = TOOL_REGISTRY[key];
        const backup = _blockBackups[key];
        if (!meta || !backup) return null;
        const restored = backup.cloneNode(true);
        restored.id = meta.id;
        restored.hidden = false;
        restored.style.display = '';
        adminSanitizeBlock(restored);
        _blockRefs[key] = restored;
        return restored;
    }

    function adminGetToolBlock(key) {
        const meta = TOOL_REGISTRY[key];
        if (!meta) return null;
        const live = document.getElementById(meta.id);
        if (live) {
            adminSanitizeBlock(live);
            _blockRefs[key] = live;
            return live;
        }
        const cached = _blockRefs[key];
        return cached?.id === meta.id ? cached : null;
    }

    function adminGetBlockNode(key) {
        if (adminIsToolKey(key)) {
            adminInitBlockBackups();
            return adminRecoverToolBlock(key) || adminGetToolBlock(key);
        }
        return adminBlockElements(key)[0] || null;
    }

    function adminIsRuntimeToolVisible(key, el) {
        if (key !== 'support' && key !== 'comments') return true;
        if (!el) return false;
        return el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
    }

    function adminExpandToolAccordion(key) {
        const meta = TOOL_REGISTRY[key];
        if (!meta?.accordionContentId) return;
        const content = document.getElementById(meta.accordionContentId);
        const icon = meta.accordionIconId && document.getElementById(meta.accordionIconId);
        if (content) content.style.display = 'flex';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }

    function adminHideBlockNode(key, el) {
        if (!el) return;
        if (key === 'categorySearch') {
            el.hidden = true;
            el.classList.add('admin-layout-hidden');
            return;
        }
        el.classList.add('admin-layout-hidden');
        el.hidden = true;
    }

    function adminShowBlockNode(key, el) {
        if (!el) return;
        el.classList.remove('admin-layout-hidden');
        if (key === 'categorySearch') {
            if (typeof syncAdminCategoryListToolsFromLayout === 'function') syncAdminCategoryListToolsFromLayout();
            return;
        }
        el.hidden = false;
        el.style.display = '';
    }

    function adminMoveBlock(el, target) {
        if (el && target && el.parentNode !== target) target.appendChild(el);
    }

    function adminPlaceToolbarPair(target, searchEl, filterEl) {
        let row = target.querySelector('.admin-product-toolbar--placed');
        if (!row) {
            row = document.createElement('div');
            row.className = 'admin-product-toolbar admin-product-toolbar--placed';
            target.appendChild(row);
        }
        if (searchEl) adminMoveBlock(searchEl, row);
        if (filterEl) adminMoveBlock(filterEl, row);
    }

    function adminPlaceOrderedBlocks(keys, target, opts = {}) {
        const emptyToolbar = document.getElementById('admin-product-toolbar');
        let i = 0;
        while (i < keys.length) {
            const key = keys[i];
            if (!adminIsBlockShown(key)) {
                const el = adminGetBlockNode(key);
                adminHideBlockNode(key, el);
                i++;
                continue;
            }
            if (key === 'categorySearch') {
                i++;
                continue;
            }

            if (key === 'productSearch' && keys[i + 1] === 'productFilter') {
                const searchEl = adminGetBlockNode('productSearch');
                const filterEl = adminGetBlockNode('productFilter');
                if (searchEl && filterEl && adminIsBlockShown('productSearch') && adminIsBlockShown('productFilter')) {
                    adminShowBlockNode('productSearch', searchEl);
                    adminShowBlockNode('productFilter', filterEl);
                    adminPlaceToolbarPair(target, searchEl, filterEl);
                } else {
                    ['productSearch', 'productFilter'].forEach(k => {
                        const el = adminGetBlockNode(k);
                        if (!adminIsBlockShown(k)) adminHideBlockNode(k, el);
                        else if (el) {
                            adminShowBlockNode(k, el);
                            adminMoveBlock(el, target);
                        }
                    });
                }
                i += 2;
                continue;
            }

            const el = adminGetBlockNode(key);
            if (!el) { i++; continue; }

            if (adminIsToolKey(key) && !adminIsRuntimeToolVisible(key, el)) {
                adminHideBlockNode(key, el);
                i++;
                continue;
            }

            adminSanitizeBlock(el);
            adminShowBlockNode(key, el);
            if (opts.insideTool) adminExpandToolAccordion(key);
            adminMoveBlock(el, target);
            i++;
        }

        if (emptyToolbar) {
            const hasChildren = emptyToolbar.querySelector('#admin-product-search-wrap, #admin-product-filter-wrap');
            emptyToolbar.classList.toggle('admin-layout-hidden', !hasChildren);
        }
    }

    function applyAdminLayout() {
        const visible = adminBlockVisibilityRead();
        if (!adminIsBlockShown('categorySearch')) {
            document.querySelectorAll('#admin-category-list-tools').forEach(el => {
                el.classList.add('admin-layout-hidden');
                el.hidden = true;
            });
        }
        if (typeof syncAdminCategoryListToolsFromLayout === 'function') {
            syncAdminCategoryListToolsFromLayout();
        }
    }

    function renderAdminFavorites() {
        const aboveSlot = adminAboveSlot();
        const storeContent = document.getElementById('admin-store-tools-accordion-content');
        const layoutSettings = document.getElementById('admin-layout-settings');
        if (!aboveSlot || !storeContent) return;

        const placement = adminPlacementRead();

        aboveSlot.querySelectorAll('.admin-product-toolbar--placed').forEach(n => n.remove());
        adminPlaceOrderedBlocks(placement.above, aboveSlot);

        if (layoutSettings?.parentNode === storeContent) {
            storeContent.insertBefore(layoutSettings, storeContent.firstChild);
        }
        adminPlaceOrderedBlocks(placement.inside, storeContent, { insideTool: true });

        const hasAbove = placement.above.some(k => adminIsBlockShown(k) && k !== 'categorySearch');
        aboveSlot.hidden = !hasAbove;
        aboveSlot.style.display = hasAbove ? 'block' : 'none';

        applyAdminLayout();
        renderAdminLayoutSettings();
    }

    window.adminIsToolBlockPinned = function(blockId) {
        const el = typeof blockId === 'string' ? document.getElementById(blockId) : blockId;
        return !!(el && el.closest('#admin-above-settings-slot'));
    };

    window.adminEnsureParentStoreToolsOpen = function(blockId) {
        if (blockId && adminIsToolBlockPinned(blockId)) return;
        if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
    };

    window.renderAdminFavorites = renderAdminFavorites;
    window.adminFavoritesRead = () => adminPlacementRead().above.filter(adminIsToolKey);
    window.adminFavoriteRegistryKeys = () => [...TOOL_KEYS];
    window.adminGetToolBlock = adminGetToolBlock;
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
