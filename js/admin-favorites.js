// ==========================================
// SWAG STREE | ADMIN LAYOUT & BLOCK ORDERING
// ==========================================

(function() {
    const ADMIN_FAVORITES_KEY = 'swagstree_admin_favorites_v1';
    const ADMIN_LAYOUT_KEY = 'swagstree_admin_layout_v1';
    const LAYOUT_ZONES = ['above', 'inside', 'below'];

    const SECTION_REGISTRY = {
        drafts: { title: 'Saved drafts', hint: 'Draft recovery panel', icon: 'fa-file-text-o', ids: ['admin-draft-recovery-panel'] },
        viewHeader: { title: 'Admin Tools header', hint: 'Title and product count', icon: 'fa-wrench', ids: ['admin-view-header'] },
        headerActions: { title: 'Quick actions', hint: '+ Category and + New item', icon: 'fa-plus-circle', selector: '#admin-view .admin-view-actions' },
        productSearch: { title: 'Product search', icon: 'fa-search', ids: ['admin-product-search-wrap'] },
        productFilter: { title: 'Product filter dropdown', icon: 'fa-filter', ids: ['admin-product-filter-wrap'] },
        productSort: { title: 'Product sort', icon: 'fa-sort', ids: ['admin-product-sort-wrap'] },
        categories: { title: 'Product Categories', icon: 'fa-tags', ids: ['admin-category-section'] },
        categorySearch: { title: 'Category search', hint: 'Inside Categories (3+ items)', icon: 'fa-search', ids: ['admin-category-list-tools'], parentKey: 'categories', sortable: false },
        products: { title: 'Products list', hint: 'Rows and pagination', icon: 'fa-box-open', ids: ['admin-products-area'] }
    };

    const TOOL_REGISTRY = {
        bulk: { title: 'Bulk Catalog Actions', icon: 'fa-file-excel-o', id: 'admin-bulk-settings' },
        cod: { title: 'COD Advance Payment', icon: 'fa-truck', id: 'admin-cod-settings' },
        'max-qty': { title: 'Global Max Cart Quantity', icon: 'fa-shopping-bag', id: 'admin-max-qty-settings' },
        promo: { title: 'Promo Codes', icon: 'fa-ticket-alt', id: 'admin-promo-settings', accordionContentId: 'admin-promo-accordion-content', accordionIconId: 'admin-promo-accordion-icon' },
        pagination: { title: 'Pagination Settings', icon: 'fa-list-ol', id: 'admin-pagination-settings', accordionContentId: 'admin-pagination-accordion-content', accordionIconId: 'admin-pagination-accordion-icon' },
        'feature-content': { title: 'Storefront Content', icon: 'fa-paint-brush', id: 'admin-feature-content-settings', accordionContentId: 'admin-feature-content-accordion-content', accordionIconId: 'admin-feature-content-accordion-icon' },
        feedback: { title: 'Customer Diaries', icon: 'fa-camera', id: 'admin-feedback-settings', accordionContentId: 'admin-feedback-accordion-content', accordionIconId: 'admin-feedback-accordion-icon' },
        footer: { title: 'Footer Settings', icon: 'fa-window-minimize', id: 'admin-footer-settings' },
        announcements: { title: 'Global Announcements', icon: 'fa-bullhorn', id: 'admin-announcement-settings', accordionContentId: 'announcement-accordion-content', accordionIconId: 'announcement-accordion-icon' },
        support: { title: 'Support Chats', icon: 'fa-headset', id: 'admin-support-inbox-section', accordionContentId: 'admin-support-accordion-content', accordionIconId: 'admin-support-accordion-icon' },
        comments: { title: 'Reviews Moderation', icon: 'fa-comments', id: 'admin-comments-moderation', accordionContentId: 'admin-comments-accordion-content', accordionIconId: 'admin-comments-accordion-icon' }
    };

    const SECTION_KEYS = ['drafts', 'viewHeader', 'headerActions', 'productSearch', 'productFilter', 'productSort', 'categories', 'categorySearch', 'products'];
    const TOOL_KEYS = ['bulk', 'cod', 'max-qty', 'promo', 'pagination', 'feature-content', 'feedback', 'footer', 'announcements', 'support', 'comments'];
    const SORTABLE_BLOCK_KEYS = [...SECTION_KEYS.filter(k => SECTION_REGISTRY[k]?.sortable !== false), ...TOOL_KEYS];

    const DEFAULT_ABOVE = ['drafts', 'viewHeader', 'headerActions', 'productSearch', 'productFilter', 'productSort', 'categories', 'products'];
    const DEFAULT_INSIDE = [...TOOL_KEYS];
    const DEFAULT_BELOW = [];

    const _blockRefs = {};
    const _blockBackups = {};
    let _backupsReady = false;
    let _layoutDraft = null;
    const _zoneSortables = { above: null, inside: null, below: null };

    function adminBlockMeta(key) { return SECTION_REGISTRY[key] || TOOL_REGISTRY[key] || null; }
    function adminIsToolKey(key) { return TOOL_KEYS.includes(key); }
    function adminListsEqual(a, b) { return a.length === b.length && a.every((k, i) => k === b[i]); }

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
            if (parsed?.blockVisible) {
                Object.keys(parsed.blockVisible).forEach(key => {
                    if (typeof parsed.blockVisible[key] === 'boolean') defaults[key] = parsed.blockVisible[key];
                });
            }
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

    function adminNormalizePlacement(above, inside, below, visible) {
        const known = new Set(SORTABLE_BLOCK_KEYS);
        const clean = { above: [], inside: [], below: [] };
        const seen = new Set();
        LAYOUT_ZONES.forEach(zone => {
            (zone === 'above' ? above : zone === 'inside' ? inside : below).forEach(key => {
                if (!known.has(key) || seen.has(key)) return;
                clean[zone].push(key);
                seen.add(key);
            });
        });
        SORTABLE_BLOCK_KEYS.forEach(key => {
            if (seen.has(key)) return;
            clean.inside.push(key);
            seen.add(key);
        });
        adminEnsureToolbarKeysPlacement(clean);
        const vis = { ...(visible || adminBlockVisibilityRead()) };
        if (vis.categories !== false) vis.categorySearch = vis.categorySearch !== false;
        return { above: clean.above, inside: clean.inside, below: clean.below, visible: vis };
    }

    function adminEnsureToolbarKeysPlacement(clean) {
        const toolbarKeys = ['productSearch', 'productFilter', 'productSort'];
        const zones = ['above', 'inside', 'below'];

        const hostZone = zones.find(z => clean[z].includes('productSearch') || clean[z].includes('productFilter'));
        if (hostZone) {
            zones.forEach(z => {
                if (z === hostZone) return;
                const idx = clean[z].indexOf('productSort');
                if (idx >= 0) clean[z].splice(idx, 1);
            });
            if (!clean[hostZone].includes('productSort')) {
                let insertAt = clean[hostZone].indexOf('productFilter');
                if (insertAt >= 0) insertAt += 1;
                else {
                    insertAt = clean[hostZone].indexOf('productSearch');
                    insertAt = insertAt >= 0 ? insertAt + 1 : clean[hostZone].length;
                }
                clean[hostZone].splice(insertAt, 0, 'productSort');
            } else {
                clean[hostZone] = clean[hostZone].filter(k => k !== 'productSort');
                let insertAt = clean[hostZone].indexOf('productFilter');
                if (insertAt >= 0) insertAt += 1;
                else {
                    insertAt = clean[hostZone].indexOf('productSearch');
                    insertAt = insertAt >= 0 ? insertAt + 1 : clean[hostZone].length;
                }
                clean[hostZone].splice(insertAt, 0, 'productSort');
            }
            return;
        }

        toolbarKeys.forEach(key => {
            if (zones.some(z => clean[z].includes(key))) return;
            const headerIdx = clean.above.indexOf('headerActions');
            if (headerIdx >= 0) clean.above.splice(headerIdx + 1, 0, key);
            else clean.above.push(key);
        });
    }

    function adminPlacementRead() {
        const visible = adminBlockVisibilityRead();
        try {
            const raw = localStorage.getItem(ADMIN_LAYOUT_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed?.aboveOrder) && Array.isArray(parsed?.insideOrder)) {
                    const below = Array.isArray(parsed.belowOrder) ? parsed.belowOrder : [];
                    return adminNormalizePlacement(
                        parsed.aboveOrder.filter(k => SORTABLE_BLOCK_KEYS.includes(k)),
                        parsed.insideOrder.filter(k => SORTABLE_BLOCK_KEYS.includes(k)),
                        below.filter(k => SORTABLE_BLOCK_KEYS.includes(k)),
                        visible
                    );
                }
            }
        } catch (e) { /* ignore */ }
        const legacyPins = adminLegacyPinsRead();
        const above = [...DEFAULT_ABOVE, ...legacyPins.filter(k => !DEFAULT_ABOVE.includes(k))];
        const inside = DEFAULT_INSIDE.filter(k => !above.includes(k));
        return adminNormalizePlacement(above, inside, DEFAULT_BELOW, visible);
    }

    function adminIsBlockShown(key) {
        const vis = adminBlockVisibilityRead();
        const meta = adminBlockMeta(key);
        if (!meta) return true;
        if (vis[key] === false) return false;
        if (meta.parentKey && vis[meta.parentKey] === false) return false;
        return true;
    }

    function adminIsLayoutSectionEnabled(key) { return adminIsBlockShown(key); }
    function adminIsToolVisible(key) { return adminIsBlockShown(key); }

    function adminLayoutWrite(visible, above, inside, below) {
        try {
            localStorage.setItem(ADMIN_LAYOUT_KEY, JSON.stringify({
                version: 3,
                blockVisible: visible,
                aboveOrder: above,
                insideOrder: inside,
                belowOrder: below
            }));
        } catch (e) { console.warn('adminLayoutWrite failed:', e); }
    }

    function adminLayoutDraftGet() {
        if (!_layoutDraft) {
            const saved = adminPlacementRead();
            _layoutDraft = {
                visible: { ...saved.visible },
                above: [...saved.above],
                inside: [...saved.inside],
                below: [...saved.below]
            };
        }
        return _layoutDraft;
    }

    function adminLayoutDraftClear() { _layoutDraft = null; }

    function adminZoneForKey(draft, key) {
        if (draft.above.includes(key)) return 'above';
        if (draft.below.includes(key)) return 'below';
        return 'inside';
    }

    function adminRemoveKeyFromZones(draft, key) {
        draft.above = draft.above.filter(k => k !== key);
        draft.inside = draft.inside.filter(k => k !== key);
        draft.below = draft.below.filter(k => k !== key);
    }

    function adminLayoutIsDirty() {
        if (!_layoutDraft) return false;
        const saved = adminPlacementRead();
        const visDirty = [...SECTION_KEYS, ...TOOL_KEYS].some(key =>
            !!_layoutDraft.visible[key] !== (saved.visible[key] !== false)
        );
        return visDirty
            || !adminListsEqual(_layoutDraft.above, saved.above)
            || !adminListsEqual(_layoutDraft.inside, saved.inside)
            || !adminListsEqual(_layoutDraft.below, saved.below);
    }

    function adminLayoutUpdateSaveButton() {
        const saveBtn = document.getElementById('admin-layout-save-btn');
        const hint = document.getElementById('admin-layout-unsaved-hint');
        const dirty = adminLayoutIsDirty();
        if (saveBtn) saveBtn.disabled = !dirty;
        if (hint) hint.hidden = !dirty;
    }

    function adminBlockElements(key) {
        const meta = adminBlockMeta(key);
        if (!meta) return [];
        if (meta.id) {
            const el = document.getElementById(meta.id);
            return el ? [el] : [];
        }
        const nodes = [];
        (meta.ids || []).forEach(id => { const el = document.getElementById(id); if (el) nodes.push(el); });
        if (meta.selector) document.querySelectorAll(meta.selector).forEach(el => nodes.push(el));
        return nodes;
    }

    function adminSanitizeBlock(el) {
        el?.querySelectorAll('.admin-favorite-toggle, .admin-pinned-badge').forEach(n => n.remove());
    }

    function adminZonePillsHtml(key, zone) {
        const labels = { above: 'Above', inside: 'Inside', below: 'Below' };
        return `<div class="admin-layout-zone-pills" role="group" aria-label="Placement for ${adminBlockMeta(key)?.title || key}">
            ${LAYOUT_ZONES.map(z => `<button type="button" class="admin-layout-zone-pill${zone === z ? ' admin-layout-zone-pill--active' : ''}" onclick="adminLayoutMoveBlockToZone('${key}', '${z}')" aria-pressed="${zone === z ? 'true' : 'false'}">${labels[z]}</button>`).join('')}
        </div>`;
    }

    function adminBlockItemHtml(key, visible, nested, zone) {
        const meta = adminBlockMeta(key);
        if (!meta) return '';
        const hint = meta.hint ? `<span class="admin-layout-block-item__hint">${meta.hint}</span>` : '';
        const parentOff = meta.parentKey && visible[meta.parentKey] === false;
        const drag = nested
            ? '<span class="admin-layout-drag-handle admin-layout-drag-handle--nested" aria-hidden="true">↳</span>'
            : `<button type="button" class="admin-layout-drag-handle" aria-label="Drag ${meta.title}"><i class="fa fa-bars" aria-hidden="true"></i></button>`;
        const controls = nested ? '' : `<div class="admin-layout-block-item__controls">
            ${adminZonePillsHtml(key, zone)}
            <div class="admin-layout-block-item__nudge">
                <button type="button" class="admin-layout-nudge-btn" onclick="adminLayoutNudgeBlock('${key}', -1)" aria-label="Move up"><i class="fa fa-chevron-up" aria-hidden="true"></i></button>
                <button type="button" class="admin-layout-nudge-btn" onclick="adminLayoutNudgeBlock('${key}', 1)" aria-label="Move down"><i class="fa fa-chevron-down" aria-hidden="true"></i></button>
            </div>
        </div>`;
        return `<div class="admin-layout-block-item${nested ? ' admin-layout-block-item--nested' : ''}${visible[key] !== false && !parentOff ? '' : ' admin-layout-block-item--off'}" data-block-key="${key}">
            <div class="admin-layout-block-item__top">
                ${drag}
                <span class="admin-layout-block-item__name"><i class="fa ${meta.icon}" aria-hidden="true"></i><span class="admin-layout-block-item__title-wrap">${meta.title}${hint}</span></span>
                <label class="admin-layout-block-item__show">
                    <input type="checkbox" ${visible[key] !== false && !parentOff ? 'checked' : ''} ${parentOff ? 'disabled' : ''} onchange="adminLayoutDraftToggle('${key}', this.checked)" aria-label="Show ${meta.title}">
                    <span>Show</span>
                </label>
            </div>
            ${controls}
        </div>`;
    }

    function adminDestroySortables() {
        LAYOUT_ZONES.forEach(z => { _zoneSortables[z]?.destroy(); _zoneSortables[z] = null; });
    }

    function adminReadOrderFromDom() {
        const read = (id) => Array.from(document.querySelectorAll(`#${id} .admin-layout-block-item:not(.admin-layout-block-item--nested)`))
            .map(el => el.dataset.blockKey).filter(k => k && SORTABLE_BLOCK_KEYS.includes(k));
        return { above: read('admin-layout-above-list'), inside: read('admin-layout-inside-list'), below: read('admin-layout-below-list') };
    }

    function adminLayoutZoneIsOpen(zone) {
        if (!window._adminLayoutZoneOpen) {
            window._adminLayoutZoneOpen = { above: false, inside: true, below: false };
        }
        return window._adminLayoutZoneOpen[zone] === true;
    }

    function adminSyncLayoutZoneAccordions() {
        LAYOUT_ZONES.forEach(zone => {
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
        window._adminLayoutZoneOpen = window._adminLayoutZoneOpen || { above: false, inside: false, below: false };
        window._adminLayoutZoneOpen[zone] = !adminLayoutZoneIsOpen(zone);
        adminSyncLayoutZoneAccordions();
    };

    function adminUpdateLayoutZoneCounts(aboveLen, insideLen, belowLen) {
        const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = `${n} item${n === 1 ? '' : 's'}`; };
        set('admin-layout-above-count', aboveLen);
        set('admin-layout-inside-count', insideLen);
        set('admin-layout-below-count', belowLen);
    }

    function adminBindSortables() {
        adminDestroySortables();
        if (!window.Sortable) return;
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
                draft.below = next.below;
                adminLayoutUpdateSaveButton();
            }
        };
        LAYOUT_ZONES.forEach(zone => {
            const el = document.getElementById(`admin-layout-${zone}-list`);
            if (el) _zoneSortables[zone] = Sortable.create(el, opts);
        });
    }

    function renderAdminLayoutSettings() {
        const lists = { above: document.getElementById('admin-layout-above-list'), inside: document.getElementById('admin-layout-inside-list'), below: document.getElementById('admin-layout-below-list') };
        if (!lists.above || !lists.inside || !lists.below) return;

        adminDestroySortables();
        const draft = adminLayoutDraftGet();
        const allKeys = new Set([...draft.above, ...draft.inside, ...draft.below]);
        SORTABLE_BLOCK_KEYS.forEach(key => { if (!allKeys.has(key)) draft.inside.push(key); });

        const buildZoneHtml = (keys, zone) => keys.map(key => {
            let html = adminBlockItemHtml(key, draft.visible, false, zone);
            if (key === 'categories') html += adminBlockItemHtml('categorySearch', draft.visible, true, zone);
            return html;
        }).join('');

        lists.above.innerHTML = buildZoneHtml(draft.above, 'above');
        lists.inside.innerHTML = buildZoneHtml(draft.inside, 'inside');
        lists.below.innerHTML = buildZoneHtml(draft.below, 'below');

        adminUpdateLayoutZoneCounts(draft.above.length, draft.inside.length, draft.below.length);
        adminBindSortables();
        adminSyncLayoutZoneAccordions();
        adminLayoutUpdateSaveButton();
    }

    window.adminLayoutMoveBlockToZone = function(key, zone) {
        if (!LAYOUT_ZONES.includes(zone) || !SORTABLE_BLOCK_KEYS.includes(key)) return;
        const draft = adminLayoutDraftGet();
        adminRemoveKeyFromZones(draft, key);
        draft[zone].push(key);
        renderAdminLayoutSettings();
    };

    window.adminLayoutNudgeBlock = function(key, delta) {
        const draft = adminLayoutDraftGet();
        const zone = adminZoneForKey(draft, key);
        const list = draft[zone];
        const index = list.indexOf(key);
        if (index < 0) return;
        const next = index + delta;
        if (next < 0 || next >= list.length) return;
        [list[index], list[next]] = [list[next], list[index]];
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
        draft.below = next.below;
        adminLayoutWrite(draft.visible, draft.above, draft.inside, draft.below);
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
            if (el) { const clone = el.cloneNode(true); adminSanitizeBlock(clone); _blockBackups[key] = clone; }
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
        if (live) { adminSanitizeBlock(live); _blockRefs[key] = live; return live; }
        const cached = _blockRefs[key];
        return cached?.id === meta.id ? cached : null;
    }

    function adminGetBlockNode(key) {
        if (adminIsToolKey(key)) { adminInitBlockBackups(); return adminRecoverToolBlock(key) || adminGetToolBlock(key); }
        return adminBlockElements(key)[0] || null;
    }

    function adminIsRuntimeToolVisible(key, el) {
        if (key !== 'support' && key !== 'comments') return true;
        return el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
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
        if (key === 'categorySearch') { el.hidden = true; el.classList.add('admin-layout-hidden'); return; }
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
        if (key === 'productSearch' || key === 'productFilter' || key === 'productSort') {
            const row = el.closest('.admin-product-toolbar--placed, #admin-product-toolbar');
            if (row) {
                row.classList.remove('admin-layout-hidden');
                row.hidden = false;
                row.style.display = '';
            }
        }
    }

    function adminMoveBlock(el, target, afterEl) {
        if (!el || !target) return afterEl || null;
        if (afterEl && afterEl.parentNode === target) {
            if (el.previousElementSibling !== afterEl) {
                afterEl.insertAdjacentElement('afterend', el);
            }
            return el;
        }
        if (el.parentNode !== target) target.appendChild(el);
        return el;
    }

    function adminGetSourceProductToolbar() {
        return document.getElementById('admin-product-toolbar');
    }

    function adminReleasePlacedToolbars(slot) {
        const source = adminGetSourceProductToolbar();
        if (!slot || !source) return;
        slot.querySelectorAll(':scope > .admin-product-toolbar--placed').forEach(row => {
            ['admin-product-search-wrap', 'admin-product-filter-wrap', 'admin-product-sort-wrap'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.parentNode === row) source.appendChild(el);
            });
            row.remove();
        });
    }

    function adminEnsureToolbarRowAt(target, afterEl) {
        let row = target.querySelector(':scope > .admin-product-toolbar--placed');
        if (!row) {
            row = document.createElement('div');
            row.className = 'admin-product-toolbar admin-product-toolbar--placed';
            if (afterEl && afterEl.parentNode === target) {
                afterEl.insertAdjacentElement('afterend', row);
            } else {
                target.appendChild(row);
            }
        } else if (afterEl && afterEl.parentNode === target && row.previousElementSibling !== afterEl) {
            afterEl.insertAdjacentElement('afterend', row);
        }
        return row;
    }

    function adminPlaceToolbarPair(target, searchEl, filterEl, afterEl) {
        const row = adminEnsureToolbarRowAt(target, afterEl);
        if (searchEl) adminMoveBlock(searchEl, row);
        if (filterEl) adminMoveBlock(filterEl, row);
        return row;
    }

    function adminPlaceSearchFilterBlocks(keys, target, startIndex, insertAfter) {
        let i = startIndex;
        if (keys[i] !== 'productSearch' && keys[i] !== 'productFilter' && keys[i] !== 'productSort') {
            return { nextIndex: i, insertAfter };
        }
        const row = adminEnsureToolbarRowAt(target, insertAfter);
        let placed = false;
        while (i < keys.length && (keys[i] === 'productSearch' || keys[i] === 'productFilter' || keys[i] === 'productSort')) {
            const key = keys[i];
            const el = adminGetBlockNode(key);
            if (!adminIsBlockShown(key)) {
                adminHideBlockNode(key, el);
            } else if (el) {
                adminShowBlockNode(key, el);
                adminMoveBlock(el, row);
                placed = true;
            }
            i++;
        }
        if (!placed && row.parentNode === target && !row.children.length) row.remove();
        return { nextIndex: i, insertAfter: placed ? row : insertAfter };
    }

    function adminPlaceOrderedBlocks(keys, target, opts = {}) {
        const emptyToolbar = document.getElementById('admin-product-toolbar');
        let insertAfter = opts.afterEl || null;
        let i = 0;
        while (i < keys.length) {
            const key = keys[i];
            const hidden = !adminIsBlockShown(key);
            if (hidden && key === 'categorySearch') { i++; continue; }
            if (hidden) {
                const hiddenEl = adminGetBlockNode(key);
                if (hiddenEl) insertAfter = adminMoveBlock(hiddenEl, target, insertAfter);
                adminHideBlockNode(key, hiddenEl);
                i++;
                continue;
            }
            if (key === 'categorySearch') { i++; continue; }

            if (key === 'productSearch' || key === 'productFilter' || key === 'productSort') {
                const result = adminPlaceSearchFilterBlocks(keys, target, i, insertAfter);
                i = result.nextIndex;
                insertAfter = result.insertAfter;
                continue;
            }

            const el = adminGetBlockNode(key);
            if (!el) { i++; continue; }
            if (adminIsToolKey(key) && !adminIsRuntimeToolVisible(key, el)) { adminHideBlockNode(key, el); i++; continue; }

            adminSanitizeBlock(el);
            adminShowBlockNode(key, el);
            if (opts.insideTool) adminExpandToolAccordion(key);
            insertAfter = adminMoveBlock(el, target, insertAfter);
            i++;
        }
        if (emptyToolbar) {
            emptyToolbar.classList.toggle('admin-layout-hidden', !emptyToolbar.querySelector('#admin-product-search-wrap, #admin-product-filter-wrap, #admin-product-sort-wrap'));
        }
    }

    function adminZoneForPlacementKey(placement, key) {
        if (placement.above.includes(key)) return 'above';
        if (placement.below.includes(key)) return 'below';
        return 'inside';
    }

    function adminHideBlocksOutsideZones(placement) {
        SORTABLE_BLOCK_KEYS.forEach(key => {
            const el = adminGetBlockNode(key);
            if (!el) return;
            const zone = adminZoneForPlacementKey(placement, key);
            if (!adminIsBlockShown(key)) {
                adminHideBlockNode(key, el);
                return;
            }
            if (adminIsToolKey(key) && !adminIsRuntimeToolVisible(key, el)) {
                adminHideBlockNode(key, el);
            }
        });
    }

    function adminUpdateStoreToolsSubtitle(insideKeys) {
        const subtitle = document.getElementById('admin-store-tools-subtitle');
        if (!subtitle) return;
        const count = insideKeys.filter(k => adminIsBlockShown(k)).length;
        subtitle.textContent = count > 0
            ? `${count} tool${count === 1 ? '' : 's'} inside — expand to view · reorder in Admin layout`
            : 'Bulk Excel, checkout, promos & more — order tools in Admin layout below';
    }

    function adminUpdateBelowSlotHeading(belowSlot, belowKeys) {
        if (!belowSlot) return;
        let heading = document.getElementById('admin-below-slot-heading');
        const visibleCount = belowKeys.filter(k => adminIsBlockShown(k)).length;
        if (visibleCount === 0) {
            if (heading) heading.hidden = true;
            return;
        }
        if (!heading) {
            heading = document.createElement('div');
            heading.id = 'admin-below-slot-heading';
            heading.className = 'admin-layout-slot-heading';
            heading.innerHTML = '<i class="fa fa-arrow-down" aria-hidden="true"></i><span>Below store settings</span>';
            belowSlot.insertBefore(heading, belowSlot.firstChild);
        }
        heading.hidden = false;
    }

    function applyAdminLayout() {
        if (!adminIsBlockShown('categorySearch')) {
            document.querySelectorAll('#admin-category-list-tools').forEach(el => { el.classList.add('admin-layout-hidden'); el.hidden = true; });
        }
        if (typeof syncAdminCategoryListToolsFromLayout === 'function') syncAdminCategoryListToolsFromLayout();
    }

    function adminSetSlotVisibility(slot, keys) {
        if (!slot) return;
        const has = keys.some(k => adminIsBlockShown(k) && k !== 'categorySearch');
        slot.hidden = !has;
        slot.style.display = has ? 'block' : 'none';
    }

    function renderAdminFavorites() {
        const aboveSlot = document.getElementById('admin-above-settings-slot');
        const belowSlot = document.getElementById('admin-below-settings-slot');
        const storeContent = document.getElementById('admin-store-tools-accordion-content');
        const layoutSettings = document.getElementById('admin-layout-settings');
        const storeSection = document.getElementById('admin-store-tools-section');
        if (!aboveSlot || !belowSlot || !storeContent || !storeSection) return;

        const placement = adminPlacementRead();

        adminReleasePlacedToolbars(aboveSlot);
        adminReleasePlacedToolbars(belowSlot);

        adminPlaceOrderedBlocks(placement.above, aboveSlot);

        if (layoutSettings && layoutSettings.parentNode !== storeContent) {
            storeContent.insertBefore(layoutSettings, storeContent.firstChild);
        } else if (layoutSettings) {
            storeContent.insertBefore(layoutSettings, storeContent.firstChild);
        }
        adminPlaceOrderedBlocks(placement.inside, storeContent, { insideTool: true, afterEl: layoutSettings });

        adminUpdateBelowSlotHeading(belowSlot, placement.below);
        const belowHeading = document.getElementById('admin-below-slot-heading');
        adminPlaceOrderedBlocks(placement.below, belowSlot, {
            afterEl: belowHeading && !belowHeading.hidden ? belowHeading : null
        });

        adminHideBlocksOutsideZones(placement);
        adminSetSlotVisibility(aboveSlot, placement.above);
        adminSetSlotVisibility(belowSlot, placement.below);
        adminUpdateStoreToolsSubtitle(placement.inside);

        applyAdminLayout();
        renderAdminLayoutSettings();
        if (typeof adminSyncProductSortUi === 'function') adminSyncProductSortUi();
    }

    window.adminIsToolBlockPinned = function(blockId) {
        const el = typeof blockId === 'string' ? document.getElementById(blockId) : blockId;
        return !!(el && (el.closest('#admin-above-settings-slot') || el.closest('#admin-below-settings-slot')));
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
    window.adminLayoutMoveBlockToZone = adminLayoutMoveBlockToZone;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.admin-favorite-toggle, .admin-pinned-badge').forEach(el => el.remove());
        adminInitBlockBackups();
        renderAdminFavorites();
        applyAdminLayout();
    });
})();
