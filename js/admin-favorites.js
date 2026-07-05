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
            expandFn: 'toggleAnnouncementAccordion',
            accordionContentId: 'announcement-accordion-content',
            accordionIconId: 'announcement-accordion-icon'
        },
        support: {
            id: 'admin-support-inbox-section',
            title: 'Support Chats',
            icon: 'fa-headset',
            defaultFavorite: true,
            expandFn: 'toggleAdminSupportAccordion',
            accordionContentId: 'admin-support-accordion-content',
            accordionIconId: 'admin-support-accordion-icon'
        },
        comments: {
            id: 'admin-comments-moderation',
            title: 'Reviews Moderation',
            icon: 'fa-comments',
            expandFn: 'toggleCommentsModerationAccordion',
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
            expandFn: 'toggleAdminPromoAccordion',
            accordionContentId: 'admin-promo-accordion-content',
            accordionIconId: 'admin-promo-accordion-icon'
        },
        pagination: {
            id: 'admin-pagination-settings',
            title: 'Pagination Settings',
            icon: 'fa-list-ol',
            expandFn: 'toggleAdminPaginationAccordion',
            accordionContentId: 'admin-pagination-accordion-content',
            accordionIconId: 'admin-pagination-accordion-icon'
        },
        'feature-content': { id: 'admin-feature-content-settings', title: 'Storefront Content', icon: 'fa-paint-brush' },
        feedback: {
            id: 'admin-feedback-settings',
            title: 'Customer Diaries',
            icon: 'fa-camera',
            expandFn: 'toggleAdminFeedbackAccordion',
            accordionContentId: 'admin-feedback-accordion-content',
            accordionIconId: 'admin-feedback-accordion-icon'
        },
        footer: { id: 'admin-footer-settings', title: 'Footer Settings', icon: 'fa-window-minimize' }
    };

    const STORE_TOOLS_ORDER = [
        'bulk', 'cod', 'max-qty', 'promo', 'pagination', 'feature-content',
        'feedback', 'footer', 'announcements', 'support', 'comments'
    ];

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

    function adminCollectToolBlocks() {
        const blocks = {};
        STORE_TOOLS_ORDER.forEach(key => {
            const meta = ADMIN_FAVORITE_REGISTRY[key];
            const el = meta && document.getElementById(meta.id);
            if (el) blocks[key] = el;
        });
        return blocks;
    }

    function adminDetachToolBlock(el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function adminExpandAccordionPanel(contentId, iconId) {
        const content = contentId && document.getElementById(contentId);
        const icon = iconId && document.getElementById(iconId);
        if (content) content.style.display = 'flex';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }

    function adminExpandFavoriteBlock(key) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta) return;
        const el = document.getElementById(meta.id);
        if (el) {
            el.style.display = '';
            el.hidden = false;
            el.classList.add('admin-store-tools-block--pinned');
        }
        if (meta.accordionContentId) {
            adminExpandAccordionPanel(meta.accordionContentId, meta.accordionIconId);
        }
    }

    function adminUnpinBlockVisual(el) {
        if (el) el.classList.remove('admin-store-tools-block--pinned');
    }

    function adminIsBlockVisible(key) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta) return false;
        const el = document.getElementById(meta.id);
        if (!el) return false;
        if (key === 'support' || key === 'comments') {
            return el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
        }
        return true;
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
        btn.innerHTML = `<i class="fa fa-star${pinned ? '' : '-o'}"></i>`;
    }

    function adminInjectPinnedBadge(el, key) {
        if (!el || !adminIsFavorite(key)) return;
        let badge = el.querySelector('.admin-pinned-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'admin-pinned-badge';
            badge.textContent = 'Pinned';
            const head = el.querySelector('h4');
            if (head) head.appendChild(badge);
        }
    }

    function adminScrollToPinnedBlock(key) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        const el = meta && document.getElementById(meta.id);
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    function renderAdminFavorites() {
        const pinnedSlot = adminPinnedSlot();
        const storeContent = document.getElementById('admin-store-tools-accordion-content');
        if (!pinnedSlot || !storeContent) return;

        let favorites = adminFavoritesRead().filter(k => adminIsBlockVisible(k));
        const blocks = adminCollectToolBlocks();

        const validFavorites = favorites.filter(k => blocks[k]);
        if (validFavorites.length !== favorites.length) {
            adminFavoritesWrite(validFavorites);
            favorites = validFavorites;
        }

        STORE_TOOLS_ORDER.forEach(key => {
            const el = blocks[key];
            if (el) adminDetachToolBlock(el);
        });

        STORE_TOOLS_ORDER.forEach(key => {
            const el = blocks[key];
            if (!el || !adminIsBlockVisible(key)) return;
            adminInjectFavoriteToggle(el, key);
        });

        favorites.forEach(key => {
            const el = blocks[key];
            if (el && adminIsBlockVisible(key)) {
                pinnedSlot.appendChild(el);
                adminExpandFavoriteBlock(key);
                adminInjectPinnedBadge(el, key);
            }
        });

        STORE_TOOLS_ORDER.forEach(key => {
            if (favorites.includes(key)) return;
            const el = blocks[key];
            if (el) {
                adminUnpinBlockVisual(el);
                storeContent.appendChild(el);
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
            requestAnimationFrame(() => {
                const el = document.getElementById(meta.id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        } else {
            list.push(key);
            adminFavoritesWrite(list);
            renderAdminFavorites();
            adminExpandFavoriteBlock(key);
            showToast(`"${meta.title}" pinned — scroll below products to see it.`);
            adminScrollToPinnedBlock(key);
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

    document.addEventListener('DOMContentLoaded', () => {
        renderAdminFavorites();
    });
})();
