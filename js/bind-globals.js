// Ensures inline HTML handlers and delegated UI always resolve safe globals.
(function initSwagStreeGlobals() {
    function bindNavItems() {
        document.querySelectorAll('[data-nav-view]').forEach((el) => {
            if (el.dataset.navBound === '1') return;
            el.dataset.navBound = '1';
            el.addEventListener('click', (e) => {
                const view = el.getAttribute('data-nav-view');
                if (!view) return;
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo(view, el);
                } else {
                    console.error('navigateTo is not available');
                }
            });
        });
    }

    function bindPromoRow() {
        const row = document.getElementById('checkout-promo-row');
        if (!row || row.dataset.promoBound === '1') return;
        row.dataset.promoBound = '1';
        const open = () => {
            if (typeof window.openPromoView === 'function') window.openPromoView();
            else if (typeof window.openPromoModal === 'function') window.openPromoModal();
        };
        row.addEventListener('click', (e) => {
            if (e.target.closest('.checkout-promo-row-remove')) return;
            open();
        });
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    }

    bindNavItems();
    bindPromoRow();
    document.addEventListener('DOMContentLoaded', () => {
        bindNavItems();
        bindPromoRow();
    });

    const critical = [
        'navigateTo', 'showToast', 'closeModal', 'openCart', 'applyPromo', 'applyPromoFromModal',
        'openPromoView', 'closePromoView', 'openPromoModal', 'closePromoModal', 'selectCheckoutPromo', 'clearCheckoutPromo',
        'toggleFilter', 'resetFilters', 'openAnnouncementModal', 'toggleAIChat',
        'openSupportChat'
    ];
    critical.forEach((name) => {
        if (typeof window[name] !== 'function') {
            console.warn('[Swag Stree] Missing global handler:', name);
        }
    });
})();
