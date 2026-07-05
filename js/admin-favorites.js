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
            expandFn: 'toggleAnnouncementAccordion'
        },
        support: {
            id: 'admin-support-inbox-section',
            title: 'Support Chats',
            icon: 'fa-headset',
            defaultFavorite: true,
            expandFn: 'toggleAdminSupportAccordion'
        },
        comments: {
            id: 'admin-comments-moderation',
            title: 'Reviews Moderation',
            icon: 'fa-comments',
            expandFn: 'toggleCommentsModerationAccordion'
        },
        bulk: { id: 'admin-bulk-settings', title: 'Bulk Catalog Actions', icon: 'fa-file-excel-o' },
        cod: { id: 'admin-cod-settings', title: 'COD Advance Payment', icon: 'fa-truck' },
        'max-qty': { id: 'admin-max-qty-settings', title: 'Global Max Cart Quantity', icon: 'fa-shopping-bag' },
        promo: { id: 'admin-promo-settings', title: 'Promo Codes', icon: 'fa-ticket-alt', expandFn: 'toggleAdminPromoAccordion' },
        pagination: { id: 'admin-pagination-settings', title: 'Pagination Settings', icon: 'fa-list-ol', expandFn: 'toggleAdminPaginationAccordion' },
        'feature-content': { id: 'admin-feature-content-settings', title: 'Storefront Content', icon: 'fa-paint-brush' },
        feedback: { id: 'admin-feedback-settings', title: 'Customer Diaries', icon: 'fa-camera', expandFn: 'toggleAdminFeedbackAccordion' },
        footer: { id: 'admin-footer-settings', title: 'Footer Settings', icon: 'fa-window-minimize' }
    };

    const STORE_TOOLS_ORDER = [
        'bulk', 'cod', 'max-qty', 'promo', 'pagination', 'feature-content',
        'feedback', 'footer', 'announcements', 'support', 'comments'
    ];

    let _favoriteConfirmResolver = null;

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

    function adminFavoriteMeta(key) {
        return ADMIN_FAVORITE_REGISTRY[key] || null;
    }

    function adminExpandFavoriteBlock(key) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta) return;
        if (meta.expandFn && typeof window[meta.expandFn] === 'function') {
            // Only auto-expand accordion-style blocks when first pinned to top
            if (['announcements', 'support', 'comments'].includes(key)) {
                const el = document.getElementById(meta.id);
                if (!el) return;
                if (key === 'announcements') {
                    const content = document.getElementById('announcement-accordion-content');
                    const icon = document.getElementById('announcement-accordion-icon');
                    if (content) content.style.display = 'flex';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                } else if (key === 'support') {
                    const content = document.getElementById('admin-support-accordion-content');
                    const icon = document.getElementById('admin-support-accordion-icon');
                    if (content) content.style.display = 'flex';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                } else if (key === 'comments') {
                    const content = document.getElementById('admin-comments-accordion-content');
                    const icon = document.getElementById('admin-comments-accordion-icon');
                    if (content) content.style.display = 'flex';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                }
            }
        }
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
            : `"${meta.title}" will appear above Store settings — same outer level as Categories and Products. You can unpin it anytime with ★.`;

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
        if (!el || el.querySelector('.admin-favorite-toggle')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-favorite-toggle';
        btn.title = adminIsFavorite(key) ? 'Unpin from top' : 'Pin above Store settings';
        btn.setAttribute('aria-label', btn.title);
        btn.innerHTML = `<i class="fa fa-star${adminIsFavorite(key) ? '' : '-o'}"></i>`;
        btn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            adminToggleFavorite(key);
        };
        el.style.position = 'relative';
        el.appendChild(btn);
    }

    function renderAdminFavorites() {
        const section = document.getElementById('admin-favorites-section');
        const favList = document.getElementById('admin-favorites-list');
        const storeContent = document.getElementById('admin-store-tools-accordion-content');
        if (!section || !favList || !storeContent) return;

        const favorites = adminFavoritesRead().filter(adminIsBlockVisible);
        favList.innerHTML = '';

        STORE_TOOLS_ORDER.forEach(key => {
            const meta = ADMIN_FAVORITE_REGISTRY[key];
            if (!meta) return;
            const el = document.getElementById(meta.id);
            if (!el || !adminIsBlockVisible(key)) return;
            adminInjectFavoriteToggle(el, key);
            const star = el.querySelector('.admin-favorite-toggle i');
            if (star) {
                star.className = adminIsFavorite(key) ? 'fa fa-star' : 'fa fa-star-o';
            }
            const starBtn = el.querySelector('.admin-favorite-toggle');
            if (starBtn) {
                const pinned = adminIsFavorite(key);
                starBtn.title = pinned ? 'Unpin — move back to Store settings' : 'Pin above Store settings';
                starBtn.setAttribute('aria-label', starBtn.title);
            }
        });

        favorites.forEach(key => {
            const meta = ADMIN_FAVORITE_REGISTRY[key];
            const el = meta && document.getElementById(meta.id);
            if (el && adminIsBlockVisible(key)) {
                favList.appendChild(el);
                adminExpandFavoriteBlock(key);
            }
        });

        STORE_TOOLS_ORDER.forEach(key => {
            if (favorites.includes(key)) return;
            const meta = ADMIN_FAVORITE_REGISTRY[key];
            const el = meta && document.getElementById(meta.id);
            if (el) storeContent.appendChild(el);
        });

        const hasFavorites = favorites.length > 0;
        section.hidden = !hasFavorites;
        section.style.display = hasFavorites ? '' : 'none';

        const countEl = document.getElementById('admin-favorites-count');
        if (countEl) countEl.textContent = String(favorites.length);
    }

    window.adminToggleFavorite = async function(key) {
        if (!ADMIN_FAVORITE_REGISTRY[key]) return;
        const confirmed = await adminPromptFavoriteToggle(key);
        if (!confirmed) return;

        let list = adminFavoritesRead();
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (list.includes(key)) {
            list = list.filter(k => k !== key);
            adminFavoritesWrite(list);
            renderAdminFavorites();
            showToast(`"${meta.title}" moved to Store settings.`);
        } else {
            list.push(key);
            adminFavoritesWrite(list);
            renderAdminFavorites();
            showToast(`"${meta.title}" pinned above Store settings.`);
        }
    };

    window.adminIsToolBlockPinned = function(blockId) {
        const el = typeof blockId === 'string' ? document.getElementById(blockId) : blockId;
        return !!(el && el.closest('#admin-favorites-list'));
    };

    window.adminEnsureParentStoreToolsOpen = function(blockId) {
        if (blockId && adminIsToolBlockPinned(blockId)) return;
        if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
    };

    window.renderAdminFavorites = renderAdminFavorites;
    window.adminFavoritesRead = adminFavoritesRead;
    window.adminFavoriteRegistryKeys = () => [...STORE_TOOLS_ORDER];

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(renderAdminFavorites, 400);
    });
})();
