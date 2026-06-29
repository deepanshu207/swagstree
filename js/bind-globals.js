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

    bindNavItems();
    document.addEventListener('DOMContentLoaded', bindNavItems);

    const critical = [
        'navigateTo', 'showToast', 'closeModal', 'openCart', 'applyPromo',
        'toggleFilter', 'resetFilters', 'openAnnouncementModal', 'toggleAIChat',
        'openSupportChat', 'selectCheckoutPromo', 'clearCheckoutPromo'
    ];
    critical.forEach((name) => {
        if (typeof window[name] !== 'function') {
            console.warn('[Swag Stree] Missing global handler:', name);
        }
    });
})();
