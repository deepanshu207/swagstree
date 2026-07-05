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
            icon: 'fa-comments'
        },
        bulk: { id: 'admin-bulk-settings', title: 'Bulk Catalog Actions', icon: 'fa-file-excel-o' },
        cod: { id: 'admin-cod-settings', title: 'COD Advance Payment', icon: 'fa-truck' },
        'max-qty': { id: 'admin-max-qty-settings', title: 'Global Max Cart Quantity', icon: 'fa-shopping-bag' },
        promo: { id: 'admin-promo-settings', title: 'Promo Codes', icon: 'fa-ticket-alt' },
        pagination: { id: 'admin-pagination-settings', title: 'Pagination Settings', icon: 'fa-list-ol' },
        'feature-content': { id: 'admin-feature-content-settings', title: 'Storefront Content', icon: 'fa-paint-brush' },
        feedback: { id: 'admin-feedback-settings', title: 'Customer Diaries', icon: 'fa-camera' },
        footer: { id: 'admin-footer-settings', title: 'Footer Settings', icon: 'fa-window-minimize' }
    };

    const STORE_TOOLS_ORDER = [
        'bulk', 'cod', 'max-qty', 'promo', 'pagination', 'feature-content',
        'feedback', 'footer', 'announcements', 'support', 'comments'
    ];

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

    function adminExpandFavoriteBlock(key) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta?.expandFn || typeof window[meta.expandFn] !== 'function') return;
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

    function adminIsBlockVisible(key) {
        const meta = ADMIN_FAVORITE_REGISTRY[key];
        if (!meta) return false;
        const el = document.getElementById(meta.id);
        if (!el) return false;
        if (key === 'support') {
            return el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
        }
        if (key === 'comments') {
            return el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
        }
        return true;
    }

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
                starBtn.title = adminIsFavorite(key) ? 'Unpin from top' : 'Pin above Store settings';
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
            if (el) {
                if (key === 'support' || key === 'comments') {
                    // visibility controlled by feature flags — do not force show
                }
                storeContent.appendChild(el);
            }
        });

        const hasFavorites = favorites.length > 0;
        section.hidden = !hasFavorites;
        section.style.display = hasFavorites ? '' : 'none';

        const countEl = document.getElementById('admin-favorites-count');
        if (countEl) countEl.textContent = String(favorites.length);
    }

    window.adminToggleFavorite = function(key) {
        if (!ADMIN_FAVORITE_REGISTRY[key]) return;
        let list = adminFavoritesRead();
        if (list.includes(key)) {
            list = list.filter(k => k !== key);
            showToast('Moved to Store settings.');
        } else {
            list.push(key);
            showToast('Pinned above Store settings.');
        }
        adminFavoritesWrite(list);
        renderAdminFavorites();
    };

    window.renderAdminFavorites = renderAdminFavorites;
    window.adminFavoritesRead = adminFavoritesRead;

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(renderAdminFavorites, 400);
    });
})();
