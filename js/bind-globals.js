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

    function bindAdminCategoryAccordion() {
        const head = document.getElementById('admin-category-accordion-head');
        const content = document.getElementById('admin-category-accordion-content');
        if (!head || head.dataset.accordionBound === '1') return;
        head.dataset.accordionBound = '1';
        const toggle = () => {
            if (typeof window.toggleAdminCategoryAccordion === 'function') {
                void window.toggleAdminCategoryAccordion();
            }
        };
        head.addEventListener('click', toggle);
        head.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
        const syncExpanded = () => {
            const open = content && content.style.display !== 'none' && content.style.display;
            head.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        if (content && typeof MutationObserver !== 'undefined') {
            const obs = new MutationObserver(syncExpanded);
            obs.observe(content, { attributes: true, attributeFilter: ['style'] });
        }
        syncExpanded();
    }

    if (typeof window.toggleAdminCategoryAccordion !== 'function') {
        window.toggleAdminCategoryAccordion = async function toggleAdminCategoryAccordionStub() {
            const content = document.getElementById('admin-category-accordion-content');
            if (!content) return;
            const open = content.style.display === 'none' || !content.style.display;
            content.style.display = open ? 'flex' : 'none';
            const icon = document.getElementById('admin-category-accordion-icon');
            if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
        };
    }

    bindNavItems();
    bindPromoRow();
    bindAdminCategoryAccordion();
    document.addEventListener('DOMContentLoaded', () => {
        bindNavItems();
        bindPromoRow();
        bindAdminCategoryAccordion();
    });

    const critical = [
        'navigateTo', 'showToast', 'closeModal', 'openCart', 'applyPromo', 'applyPromoFromModal',
        'openPromoView', 'closePromoView', 'openPromoModal', 'closePromoModal', 'selectCheckoutPromo', 'clearCheckoutPromo',
        'toggleFilter', 'resetFilters', 'openAnnouncementModal', 'toggleAIChat',
        'openSupportChat', 'toggleAdminCategoryAccordion', 'openSoLicenseCreateForm'
    ];
    critical.forEach((name) => {
        if (typeof window[name] !== 'function') {
            console.warn('[Swag Stree] Missing global handler:', name);
        }
    });
})();
