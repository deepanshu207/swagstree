// ==========================================
// SWAG STREE | ADMIN FAVORITES (pin tools)
// ==========================================

(function() {
    const ADMIN_FAVORITES_KEY = 'swagstree_admin_favorites_v1';

    const ADMIN_FAVORITE_REGISTRY = {
        announcements: {
            id: 'admin-announcement-settings',
            title: 'Global Announcements',
            icon: 'fa-bullhorn',
            defaultFavorite: true,
            accordionContentId: 'announcement-accordion-content',
            accordionIconId: 'announcement-accordion-icon'
        },
        support: {
            id: 'admin-support-inbox-section',
            title: 'Support Chats',
            icon: 'fa-headset',
            defaultFavorite: true,
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
    let _favoriteConfirmResolver = null;

    function adminPinnedSlot() {
        return document.getElementById('admin-pinned-tools-slot');
    }

    function adminFavoritesRead() {
        try {
            const raw = localStorage.getItem(ADMIN_FAVORITES_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.filter(k => ADMIN_FAVORITE_REGISTRY[k]);
            }
        } catch (e) { /* ignore */ }
        return STORE_TOOLS_ORDER.filter(k => ADMIN_FAVORITE_REGISTRY[k]?.defaultFavorite);
    }

    function adminFavoritesWrite(list) {
        try {
            localStorage.setItem(ADMIN_FAVORITES_KEY, JSON.stringify(list));
        } catch (e) { console.warn('adminFavoritesWrite failed:', e); }
    }

    function adminIsFavorite(key) {
        return adminFavoritesRead().includes(key);
    }

    function adminInitBlockBackups() {
        if (_backupsReady) return;
        STORE_TOOLS_ORDER.forEach(key => {
            const meta = ADMIN_FAVORITE_REGISTRY[key];
            if (!meta || _blockBackups[key]) return;
            const el = document.getElementById(meta.id);
            if (el) _blockBackups[key] = el.cloneNode(true);
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
        if (key === 'support' || key === 'comments') {
            return node.style.display !== 'none' && getComputedStyle(node).display !== 'none';
        }
        return true;
    }

    function adminStarIconHtml(pinned) {
        return pinned
            ? '<i class="fa-solid fa-star" aria-hidden="true"></i>'
            : '<i class="fa-regular fa-star" aria-hidden="true"></i>';
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

    function adminPromptFavoriteToggle(key) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta) return Promise.resolve(false);
        const isPinned = adminIsFavorite(key);
        const title = isPinned ? 'Move back to Store settings?' : 'Pin above Store settings?';
        const message = isPinned
            ? `"${meta.title}" will move back inside the Store settings accordion. You can pin it again anytime with ★.`
            : `"${meta.title}" will appear directly below your product list and above Store settings. You can unpin it anytime with ★.`;

        return new Promise(resolve => {
            const modal = document.getElementById('admin-favorite-confirm-modal');
            const titleEl = document.getElementById('admin-favorite-confirm-title');
            const msgEl = document.getElementById('admin-favorite-confirm-message');
            const yesBtn = document.getElementById('admin-favorite-confirm-yes');
            if (!modal || !msgEl) {
                resolve(window.confirm(`${title}\n\n${message}`));
                return;
            }
            _favoriteConfirmResolver = resolve;
            if (titleEl) titleEl.textContent = title;
            msgEl.textContent = message;
            if (yesBtn) yesBtn.textContent = isPinned ? 'Yes, move to Store settings' : 'Yes, pin above';
            modal.style.display = 'flex';
        });
    }

    window.adminFavoriteConfirmResolve = function(confirmed) {
        const modal = document.getElementById('admin-favorite-confirm-modal');
        if (modal) modal.style.display = 'none';
        if (_favoriteConfirmResolver) _favoriteConfirmResolver(!!confirmed);
        _favoriteConfirmResolver = null;
    };

    function adminInjectFavoriteToggle(el, key) {
        if (!el) return;
        let btn = el.querySelector('.admin-favorite-toggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'admin-favorite-toggle';
            btn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                adminToggleFavorite(key);
            };
            el.style.position = 'relative';
            el.appendChild(btn);
        }
        const pinned = adminIsFavorite(key);
        btn.title = pinned ? 'Unpin — move back to Store settings' : 'Pin above Store settings';
        btn.setAttribute('aria-label', btn.title);
        btn.innerHTML = adminStarIconHtml(pinned);
    }

    function adminInjectPinnedBadge(el) {
        if (!el) return;
        let badge = el.querySelector('.admin-pinned-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'admin-pinned-badge';
            badge.textContent = 'Pinned';
            const head = el.querySelector('h4');
            if (head) head.appendChild(badge);
        }
    }

    function adminRemovePinnedBadge(el) {
        el?.querySelector('.admin-pinned-badge')?.remove();
    }

    function adminScrollToBlock(key) {
        const el = adminResolveToolBlock(key);
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
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

        const validKeys = favorites.filter(k => blocks[k]);
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
            if (!el || !adminIsBlockVisible(key, el)) return;

            const pin = favorites.includes(key);
            const target = pin ? pinnedSlot : storeContent;

            adminInjectFavoriteToggle(el, key);
            adminMoveBlock(el, target);

            if (pin) {
                adminExpandFavoriteBlock(key, el);
                adminInjectPinnedBadge(el);
            } else {
                adminUnpinBlockVisual(el);
                adminRemovePinnedBadge(el);
            }
        });

        const hasPinned = favorites.length > 0;
        pinnedSlot.hidden = !hasPinned;
        pinnedSlot.style.display = hasPinned ? 'block' : 'none';
    }

    window.adminToggleFavorite = async function(key) {
        if (!ADMIN_FAVORITE_REGISTRY[key]) return;
        const confirmed = await adminPromptFavoriteToggle(key);
        if (!confirmed) return;

        let list = adminFavoritesRead();
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        const wasPinned = list.includes(key);

        if (wasPinned) {
            list = list.filter(k => k !== key);
            adminFavoritesWrite(list);
            renderAdminFavorites();
            showToast(`"${meta.title}" moved to Store settings.`);
            if (typeof openAdminStoreToolsAccordion === 'function') openAdminStoreToolsAccordion();
            if (meta.accordionContentId) {
                adminExpandAccordionPanel(meta.accordionContentId, meta.accordionIconId);
            }
            adminScrollToBlock(key);
        } else {
            list.push(key);
            adminFavoritesWrite(list);
            renderAdminFavorites();
            showToast(`"${meta.title}" pinned below products.`);
            adminScrollToBlock(key);
        }
    };

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

    document.addEventListener('DOMContentLoaded', () => {
        adminInitBlockBackups();
        renderAdminFavorites();
    });
})();
