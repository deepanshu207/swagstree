// ==========================================
// SWAG STREE | SHIPPING OPTIMIZER EXTENSION ADMIN
// Firestore: extension-e6e32 → shipping_optimizer_* collections only
// Swagstree storefront uses swagstree-web (global db) — never touched here
// Access: superadmin@swagstree.com on BOTH Swagstree + extension-e6e32 Auth
// ==========================================

(function() {
    const SO_CONFIG_DOC = 'shipping_optimizer_config';
    const SO_CONFIG_ID = 'app';
    const SO_DEMO_COL = 'shipping_optimizer_demo_keys';
    const SO_LICENSE_COL = 'shipping_optimizer_licenses';
    const SO_LICENSE_MAX = 200;
    const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    const DEFAULT_PLANS = [
        { id: 'monthly', name: 'Monthly', price: 599, days: 30, duration: '1 Month', active: true, order: 0 },
        { id: 'quarterly', name: '3 Months', price: 1399, days: 90, duration: '3 Months', save: 'Save ₹1000', active: true, order: 1 },
        { id: 'halfyearly', name: '6 Months', price: 2299, days: 180, duration: '6 Months', save: 'Save ₹3000', active: true, order: 2 },
        { id: 'yearly', name: 'Yearly', price: 3099, days: 365, duration: '1 Year', save: 'Save ₹8000', best: true, active: true, order: 3 }
    ];

    const DEFAULT_INLINE_DEMO_KEYS = {
        'MEESHO-DEMOFREE': { days: 30, label: 'Free 30-day trial' }
    };

    const DEFAULT_CREDITS = {
        enabled: true,
        price_per_credit: 2,
        min_purchase: 10,
        cost_per_operation: 1
    };

    const DEFAULT_IMAGE_GENERATION = {
        enabled: true,
        credits_per_image: 2,
        daily_limit: 20,
        monthly_limit: 0,
        max_batch_size: 0
    };

    const DEFAULT_SUPPORT = {
        enabled: true,
        title: 'Support team',
        page_size: 5,
        users: [
            {
                id: 'sales',
                name: 'Deepanshu',
                role: 'Sales & licenses',
                label: 'New plans, upgrades, payments',
                whatsapp_number: '919654414891',
                whatsapp_message: 'Hi! I need help with Shipping Optimizer.',
                active: true,
                order: 0
            }
        ]
    };

    const DEFAULT_CREDIT_PACKS = [
        { id: 'pack_10', credits: 10, price: 20, label: '10 credits — ₹20', active: true, order: 0 },
        { id: 'pack_20', credits: 20, price: 38, label: '20 credits — ₹38', active: true, order: 1 },
        { id: 'pack_50', credits: 50, price: 90, label: '50 credits — ₹90', active: true, order: 2 },
        { id: 'pack_100', credits: 100, price: 170, label: '100 credits — ₹170', active: true, order: 3 }
    ];

    const SO_DEVICE_TIER_MAX = { standard: 1, family: 3, friends: 5, unlimited: 0 };
    const SO_BILLING_MODES = ['subscription', 'credits', 'hybrid'];
    const SO_DEVICE_TIERS = ['standard', 'family', 'friends', 'unlimited'];

    const SO_PLAN_PRESETS = {
        monthly: {
            id: 'monthly', name: 'Monthly', price: 599, days: 30, duration: '1 Month',
            max_devices: 1, device_tier: 'standard', billing_mode: 'subscription', active: true
        },
        family_yearly: {
            id: 'family_yearly', name: 'Family Yearly', price: 4999, days: 365, duration: '1 Year',
            max_devices: 3, device_tier: 'family', billing_mode: 'subscription', active: true
        },
        friends_yearly: {
            id: 'friends_yearly', name: 'Friends Yearly', price: 6999, days: 365, duration: '1 Year',
            max_devices: 5, device_tier: 'friends', billing_mode: 'subscription', active: true
        },
        lifetime: {
            id: 'lifetime', name: 'Lifetime', price: 9999, days: 0, duration: 'Forever',
            unlimited_time: true, plan_kind: 'lifetime', max_devices: 1, billing_mode: 'subscription', active: true
        },
        unlimited_pro: {
            id: 'unlimited_pro', name: 'Unlimited Pro', price: 19999, days: 0, duration: 'Forever',
            unlimited_time: true, unlimited_devices: true, unlimited_credits: true,
            plan_kind: 'unlimited', billing_mode: 'hybrid', max_devices: 0, device_tier: 'unlimited', active: true
        },
        credits_starter: {
            id: 'credits_starter', name: 'Credits Starter', price: 99, days: 0,
            billing_mode: 'credits', included_credits: 50, plan_kind: 'custom', max_devices: 1, active: true,
            allow_credit_addons: true,
            max_addon_selections: 0,
            credit_addons: [
                { id: 'starter_plus_25', credits: 25, price: 40, label: '+25 credits', active: true, order: 0, default_selected: false },
                { id: 'starter_plus_100', credits: 100, price: 140, label: '+100 credits', active: true, order: 1, default_selected: false }
            ]
        }
    };

    let soConfig = null;
    let soPlans = [];
    let soCredits = null;
    let soCreditPacks = [];
    let soInlineDemoKeys = {};
    let soInlineDemoKeyRows = [];
    let soDemoKeys = [];
    let soDemoKeyPendingRows = [];
    let soDemoKeyEditRows = [];
    let soDemoSelectedKeys = new Set();
    let soLicenses = [];
    let soActiveTab = 'config';
    let soLoaded = false;
    let soEditingLicenseKey = null;
    let soOverridesLicenseKey = null;
    let soAddCreditsLicenseKey = null;
    let soDirtyTabs = { config: false, credits: false };
    let soTabSnapshots = { config: null, credits: null };
    let soHydrating = false;
    let soUserEditsEnabled = false;
    let soSnapshotsReady = false;
    let soDirtyCheckTimer = null;
    let soSupport = null;
    let soLicenseFilter = 'all';
    let soDraftSaveTimer = null;
    const SO_DRAFT_STORAGE_KEY = 'swagstree_so_admin_draft_v1';
    const SO_DRAFT_SAVE_MS = 800;
    let soExpandedPlanIds = new Set();
    let soExpandedPackIds = new Set();
    let soExpandedLicenseKeys = new Set();
    let soOpenSections = new Set(['config-general', 'license-list']);

    function soDb() {
        if (typeof soGetExtensionDb === 'function') {
            const extDb = soGetExtensionDb();
            if (extDb) return extDb;
        }
        throw new Error('Extension Firestore (extension-e6e32) not ready.');
    }

    function soRequireExtensionWrite() {
        if (!soRequireSuperAdmin()) return false;
        if (typeof soIsExtensionFirebaseAuthed === 'function' && soIsExtensionFirebaseAuthed()) return true;
        soToast('Sign in to Extension Firebase (extension-e6e32) to save changes.');
        if (typeof renderSoExtensionAuthBanner === 'function') renderSoExtensionAuthBanner();
        const banner = document.getElementById('so-extension-auth-banner');
        if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return false;
    }

    function soEsc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function soAttr(str) {
        return soEsc(str).replace(/`/g, '&#96;');
    }

    const SO_FIELD_HINTS = {
        'plan-id': 'Slug used in Firebase and the extension. <strong>Never rename</strong> after any license uses this id.',
        'plan-billing-mode': '<code>subscription</code> = time-based · <code>credits</code> = pay per use · <code>hybrid</code> = both.',
        'plan-included-credits': 'Base credits included when customer buys this plan. Added to any selected add-ons for total balance.',
        'plan-allow-addons': 'Shows optional credit bundles under this plan in the extension popup (e.g. +25 credits for ₹40).',
        'plan-max-addon-selections': 'Limit how many add-ons customer can pick. <code>0</code> = unlimited selections.',
        'plan-unlimited-time': 'License never expires (lifetime / forever plans). Sets days to 0 in extension logic.',
        'plan-unlimited-devices': 'Customer can activate on any number of devices.',
        'plan-unlimited-credits': 'No credit deductions — unlimited operations.'
    };

    function soFieldHintId(hintKey, idSuffix) {
        return idSuffix != null && idSuffix !== '' ? `so-hint-${hintKey}-${idSuffix}` : `so-hint-${hintKey}`;
    }

    function soFieldToggleKey(hintKey, idSuffix) {
        return idSuffix != null && idSuffix !== '' ? `${hintKey}-${idSuffix}` : hintKey;
    }

    function soFieldLabelHtml(label, hintKey, idSuffix) {
        const hint = SO_FIELD_HINTS[hintKey];
        if (!hint) return `<span>${soEsc(label)}</span>`;
        const panelId = soFieldHintId(hintKey, idSuffix);
        const toggleKey = soFieldToggleKey(hintKey, idSuffix);
        return `<span class="so-field-label-row"><span>${soEsc(label)}</span><button type="button" class="so-field-info-btn" onclick="toggleSoFieldInfo('${soAttr(toggleKey)}', event)" aria-expanded="false" aria-controls="${panelId}" title="More info">ⓘ</button></span><div id="${panelId}" class="so-field-info-panel" hidden role="note">${hint}</div>`;
    }

    function soCheckboxInfoHtml(label, hintKey, field, checked, idSuffix) {
        const hint = SO_FIELD_HINTS[hintKey];
        const panelId = soFieldHintId(hintKey, idSuffix);
        const toggleKey = soFieldToggleKey(hintKey, idSuffix);
        const infoBtn = hint
            ? `<button type="button" class="so-field-info-btn" onclick="toggleSoFieldInfo('${soAttr(toggleKey)}', event)" aria-expanded="false" aria-controls="${panelId}" title="More info">ⓘ</button>`
            : '';
        const panel = hint ? `<div id="${panelId}" class="so-field-info-panel" hidden role="note">${hint}</div>` : '';
        return `<label class="so-plan-check so-plan-check--with-info"><input type="checkbox" data-field="${field}" ${checked ? 'checked' : ''} onchange="soMarkTabDirty('config')"><span class="so-field-label-row"><span>${soEsc(label)}</span>${infoBtn}</span>${panel}</label>`;
    }

    window.toggleSoFieldInfo = function(key, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const panel = document.getElementById('so-hint-' + key);
        if (!panel) return;
        const btn = event && event.currentTarget;
        const opening = panel.hidden;
        document.querySelectorAll('#shipping-optimizer-admin-section .so-field-info-panel').forEach(p => {
            if (p === panel) return;
            p.hidden = true;
            const ctrlId = p.id;
            const otherBtn = document.querySelector(`#shipping-optimizer-admin-section .so-field-info-btn[aria-controls="${ctrlId}"]`);
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        });
        panel.hidden = !opening;
        if (btn) btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    };

    window.toggleSoAdminGuide = function(forceOpen) {
        const content = document.getElementById('so-admin-guide-content');
        const icon = document.getElementById('so-admin-guide-icon');
        const accordion = document.getElementById('so-admin-guide-accordion');
        const header = accordion?.querySelector('.admin-product-guide-header');
        if (!content || !accordion) return;
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : content.style.display === 'none' || !content.style.display;
        content.style.display = shouldOpen ? 'block' : 'none';
        accordion.classList.toggle('is-open', shouldOpen);
        if (icon) icon.style.transform = shouldOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        if (header) header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    };

    window.toggleSoGuideSection = function(sectionId) {
        const content = document.getElementById(`so-guide-section-${sectionId}`);
        const icon = document.getElementById(`so-guide-section-icon-${sectionId}`);
        const accordion = document.getElementById(`so-guide-section-accord-${sectionId}`);
        const header = accordion?.querySelector('.admin-guide-section-header');
        if (!content || !accordion) return;
        const shouldOpen = content.style.display === 'none' || !content.style.display;
        content.style.display = shouldOpen ? 'block' : 'none';
        accordion.classList.toggle('is-open', shouldOpen);
        if (icon) icon.style.transform = shouldOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        if (header) header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    };

    window.collapseAllSoSections = function() {
        document.querySelectorAll('#shipping-optimizer-admin-section .so-section-accordion').forEach(el => {
            el.classList.remove('so-section-accordion--open');
            const id = el.getAttribute('data-so-section');
            if (id) soOpenSections.delete(id);
        });
        soExpandedPlanIds.clear();
        soExpandedPackIds.clear();
        renderSoPlansEditor();
        renderSoCreditPacksEditor();
        soToast('All sections collapsed.');
    };

    window.copySoDeployChecklist = function() {
        const text = [
            'Shipping Optimizer — deploy checklist',
            '1. Deploy firestore.extension.rules to extension-e6e32',
            '2. Create Auth user superadmin@swagstree.com on extension Firebase',
            '3. Update Meesho extension config.js → project extension-e6e32',
            '4. Superadmin → Shipping Optimizer → sign in → save config',
            '5. Reload extension at chrome://extensions (~5 min cache)'
        ].join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => soToast('Checklist copied.')).catch(() => soToast('Copy failed — select text manually.'));
        } else {
            soToast(text);
        }
    };

    function soSyncTabChips() {
        document.querySelectorAll('.so-tab-chip[data-so-tab-chip]').forEach(chip => {
            chip.classList.toggle('so-tab-chip--active', chip.getAttribute('data-so-tab-chip') === soActiveTab);
        });
    }

    function soBindFieldInfoDismiss() {
        if (document.body.dataset.soFieldInfoBound) return;
        document.body.dataset.soFieldInfoBound = '1';
        document.addEventListener('click', (e) => {
            if (e.target.closest('.so-field-info-btn') || e.target.closest('.so-field-info-panel')) return;
            document.querySelectorAll('#shipping-optimizer-admin-section .so-field-info-panel:not([hidden])').forEach(panel => {
                panel.hidden = true;
                const ctrlId = panel.id;
                const btn = document.querySelector(`#shipping-optimizer-admin-section .so-field-info-btn[aria-controls="${ctrlId}"]`);
                if (btn) btn.setAttribute('aria-expanded', 'false');
            });
        });
    }

    function soToast(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }
    window.soToast = soToast;

    window.soRefreshExtensionPreview = function() {
        renderSoExtensionPreview();
        soToast('Preview refreshed.');
    };

    function soRequireSuperAdmin() {
        if (typeof isSuperAdmin !== 'undefined' && isSuperAdmin) return true;
        soToast('Superadmin access required.');
        return false;
    }

    function soAuthEmail() {
        return (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email)
            ? auth.currentUser.email
            : 'unknown';
    }

    function soSlugifyId(raw) {
        return String(raw || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48);
    }

    function soNormalizePlan(plan, index) {
        const p = Object.assign({}, plan);
        p.id = soSlugifyId(p.id || p.name || `plan_${index}`);
        p.name = String(p.name || p.id || 'Plan').trim();
        p.price = Math.max(0, parseInt(p.price, 10) || 0);
        p.days = Math.max(0, parseInt(p.days, 10));
        if (!Number.isFinite(p.days)) p.days = 30;
        p.duration = String(p.duration || '').trim();
        p.save = String(p.save || '').trim();
        p.plan_kind = String(p.plan_kind || '').trim();
        p.description = String(p.description || '').trim();
        p.active = p.active !== false;
        p.best = !!p.best;
        p.unlimited_time = !!p.unlimited_time;
        p.unlimited_devices = !!p.unlimited_devices;
        p.unlimited_credits = !!p.unlimited_credits;
        p.order = Number.isFinite(Number(p.order)) ? Number(p.order) : index;
        if (!p.duration && p.days > 0) {
            if (p.days === 30) p.duration = '1 Month';
            else if (p.days === 90) p.duration = '3 Months';
            else if (p.days === 180) p.duration = '6 Months';
            else if (p.days === 365) p.duration = '1 Year';
            else p.duration = `${p.days} days`;
        } else if (p.unlimited_time && !p.duration) {
            p.duration = 'Forever';
        } else if (p.days === 0 && !p.duration && !p.unlimited_time) {
            p.duration = '';
        }
        p.device_tier = SO_DEVICE_TIERS.includes(p.device_tier) ? p.device_tier : 'standard';
        const tierDefault = SO_DEVICE_TIER_MAX[p.device_tier];
        const rawMax = parseInt(p.max_devices, 10);
        if (p.unlimited_devices) {
            p.max_devices = 0;
        } else if (p.device_tier === 'unlimited' && !Number.isFinite(rawMax)) {
            p.max_devices = 0;
            p.unlimited_devices = true;
        } else if (Number.isFinite(rawMax) && rawMax >= 0) {
            p.max_devices = rawMax;
        } else {
            p.max_devices = tierDefault != null ? tierDefault : 1;
        }
        p.billing_mode = SO_BILLING_MODES.includes(p.billing_mode) ? p.billing_mode : 'subscription';
        p.included_credits = Math.max(0, parseInt(p.included_credits, 10) || 0);
        p.allow_credit_addons = p.allow_credit_addons === true;
        p.max_addon_selections = Math.max(0, parseInt(p.max_addon_selections, 10) || 0);
        const rawAddons = Array.isArray(p.credit_addons) ? p.credit_addons : [];
        p.credit_addons = soSortCreditAddons(rawAddons.map(soNormalizeCreditAddon));
        p.credit_addons.forEach((a, i) => { a.order = i; });
        p.highlights = Array.isArray(p.highlights)
            ? p.highlights.map(h => String(h || '').trim()).filter(Boolean)
            : [];
        p.features = Array.isArray(p.features) ? p.features : [];
        p.detail_sections = Array.isArray(p.detail_sections) ? p.detail_sections.map(s => ({
            title: String(s && s.title || '').trim(),
            body: String(s && s.body || '').trim(),
            items: Array.isArray(s && s.items) ? s.items.map(i => String(i || '').trim()).filter(Boolean) : []
        })) : [];
        return p;
    }

    function soNormalizeCreditAddon(addon, index) {
        const a = Object.assign({}, addon);
        a.id = soSlugifyId(a.id || `addon_${a.credits || index + 1}`);
        a.credits = Math.max(1, parseInt(a.credits, 10) || 1);
        a.price = Math.max(0, parseInt(a.price, 10) || 0);
        a.label = String(a.label || `+${a.credits} credits`).trim();
        a.active = a.active !== false;
        a.default_selected = a.default_selected === true;
        a.order = Number.isFinite(Number(a.order)) ? Number(a.order) : index;
        return a;
    }

    function soSortCreditAddons(addons) {
        return addons.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function soGetActivePlanCreditAddons(plan) {
        if (!plan || !plan.allow_credit_addons) return [];
        return soSortCreditAddons((plan.credit_addons || []).filter(a => a.active !== false));
    }

    function soCalculatePlanCredits(plan, selectedAddonIds) {
        const included = plan && !soIsUnlimitedCredits(plan)
            ? Math.max(0, parseInt(plan.included_credits, 10) || 0)
            : 0;
        let addonTotal = 0;
        const ids = Array.isArray(selectedAddonIds) ? selectedAddonIds : [];
        const addons = soGetActivePlanCreditAddons(plan);
        ids.forEach(id => {
            const addon = addons.find(a => a.id === id);
            if (addon) addonTotal += addon.credits;
        });
        return { included, addon: addonTotal, total: included + addonTotal, addonPrice: soSumAddonPrices(plan, ids) };
    }

    function soSumAddonPrices(plan, selectedAddonIds) {
        const addons = soGetActivePlanCreditAddons(plan);
        let sum = 0;
        (selectedAddonIds || []).forEach(id => {
            const addon = addons.find(a => a.id === id);
            if (addon) sum += addon.price || 0;
        });
        return sum;
    }

    function soReadPlanCreditAddonsFromRow(row) {
        if (!row) return [];
        const addonRows = row.querySelectorAll('.so-plan-addon-row');
        return Array.from(addonRows).map((addonRow, idx) => {
            const get = (field) => {
                const el = addonRow.querySelector(`[data-addon-field="${field}"]`);
                if (!el) return '';
                if (el.type === 'checkbox') return el.checked;
                return el.value;
            };
            return soNormalizeCreditAddon({
                id: get('id'),
                credits: get('credits'),
                price: get('price'),
                label: get('label'),
                active: get('active'),
                default_selected: get('default_selected'),
                order: idx
            }, idx);
        });
    }

    function soRenderPlanCreditAddonRowHtml(addon, planIdx, addonIdx) {
        return `
            <div class="so-plan-addon-row" data-addon-idx="${addonIdx}">
                <label><span>Addon id</span><input type="text" data-addon-field="id" value="${soAttr(addon.id)}" oninput="soMarkTabDirty('config')"></label>
                <label><span>Credits</span><input type="number" min="1" step="1" data-addon-field="credits" value="${addon.credits || 10}" oninput="soMarkTabDirty('config')"></label>
                <label><span>Price ₹</span><input type="number" min="0" step="1" data-addon-field="price" value="${addon.price || 0}" oninput="soMarkTabDirty('config')"></label>
                <label><span>Label</span><input type="text" data-addon-field="label" value="${soAttr(addon.label || '')}" placeholder="+50 credits" oninput="soMarkTabDirty('config')"></label>
                <label class="so-plan-check"><input type="checkbox" data-addon-field="active" ${addon.active !== false ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Active</label>
                <label class="so-plan-check"><input type="checkbox" data-addon-field="default_selected" ${addon.default_selected ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Default on license</label>
                <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="removeSoPlanCreditAddon(${planIdx}, ${addonIdx})">Remove</button>
            </div>`;
    }

    function soPlanToFirestore(p, order) {
        const out = {
            id: p.id,
            name: p.name,
            price: p.price,
            days: p.days,
            active: p.active !== false,
            order: order,
            device_tier: p.device_tier || 'standard',
            max_devices: p.max_devices != null ? p.max_devices : 1,
            billing_mode: p.billing_mode || 'subscription'
        };
        if (p.duration) out.duration = p.duration;
        if (p.save) out.save = p.save;
        if (p.best) out.best = true;
        if (p.plan_kind) out.plan_kind = p.plan_kind;
        if (p.description) out.description = p.description;
        if (p.included_credits > 0) out.included_credits = p.included_credits;
        if (p.allow_credit_addons) out.allow_credit_addons = true;
        if (p.max_addon_selections > 0) out.max_addon_selections = p.max_addon_selections;
        if (Array.isArray(p.credit_addons) && p.credit_addons.length) {
            out.credit_addons = p.credit_addons.map((a, i) => ({
                id: a.id,
                credits: a.credits,
                price: a.price,
                label: a.label,
                active: a.active !== false,
                default_selected: a.default_selected === true,
                order: i
            }));
        }
        if (p.unlimited_time) out.unlimited_time = true;
        if (p.unlimited_devices) out.unlimited_devices = true;
        if (p.unlimited_credits) out.unlimited_credits = true;
        if (p.highlights && p.highlights.length) out.highlights = p.highlights.slice();
        if (p.features && p.features.length) {
            out.features = p.features.map(f => {
                if (typeof f === 'string') return f;
                const item = {
                    icon: String(f.icon || '').trim(),
                    title: String(f.title || '').trim(),
                    text: String(f.text || '').trim()
                };
                if (!item.icon && !item.title && !item.text) return null;
                return item;
            }).filter(Boolean);
        }
        if (p.detail_sections && p.detail_sections.length) {
            out.detail_sections = p.detail_sections.map(s => {
                const sec = { title: s.title || '' };
                if (s.body) sec.body = s.body;
                if (s.items && s.items.length) sec.items = s.items.slice();
                return sec;
            }).filter(s => s.title || s.body || (s.items && s.items.length));
        }
        return out;
    }

    function soNormalizeSupportUser(user, index) {
        const u = Object.assign({}, user);
        u.id = soSlugifyId(u.id || u.name || `contact_${index}`);
        u.name = String(u.name || u.id || 'Contact').trim();
        u.role = String(u.role || '').trim();
        u.label = String(u.label || '').trim();
        u.whatsapp_number = String(u.whatsapp_number || '').replace(/\D/g, '');
        u.whatsapp_message = String(u.whatsapp_message || '').trim();
        u.active = u.active !== false;
        u.order = Number.isFinite(Number(u.order)) ? Number(u.order) : index;
        return u;
    }

    function soNormalizeSupport(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const users = Array.isArray(src.users) ? src.users.map(soNormalizeSupportUser) : DEFAULT_SUPPORT.users.slice();
        users.sort((a, b) => (a.order || 0) - (b.order || 0));
        users.forEach((u, i) => { u.order = i; });
        return {
            enabled: src.enabled !== false,
            title: String(src.title || DEFAULT_SUPPORT.title).trim(),
            page_size: Math.max(1, parseInt(src.page_size, 10) || DEFAULT_SUPPORT.page_size),
            users
        };
    }

    function soSupportToFirestore(support) {
        const s = soNormalizeSupport(support);
        return {
            enabled: s.enabled,
            title: s.title,
            page_size: s.page_size,
            users: s.users.map((u, i) => {
                const out = {
                    id: u.id,
                    name: u.name,
                    role: u.role,
                    label: u.label,
                    whatsapp_number: u.whatsapp_number,
                    active: u.active !== false,
                    order: i
                };
                if (u.whatsapp_message) out.whatsapp_message = u.whatsapp_message;
                return out;
            })
        };
    }

    function soIsUnlimitedTime(obj) {
        return !!(obj && (obj.unlimited_time || parseInt(obj.days, 10) === 0));
    }

    function soIsUnlimitedDevices(obj) {
        if (!obj) return false;
        if (obj.unlimited_devices) return true;
        const max = parseInt(obj.max_devices, 10);
        return max === 0;
    }

    function soIsUnlimitedCredits(obj) {
        return !!(obj && obj.unlimited_credits);
    }

    function soNormalizeCreditPack(pack, index) {
        const p = Object.assign({}, pack);
        p.id = soSlugifyId(p.id || `pack_${p.credits || index + 1}`);
        p.credits = Math.max(1, parseInt(p.credits, 10) || 10);
        p.price = Math.max(0, parseInt(p.price, 10) || 0);
        p.label = String(p.label || `${p.credits} credits — ₹${p.price}`).trim();
        p.active = p.active !== false;
        p.order = Number.isFinite(Number(p.order)) ? Number(p.order) : index;
        return p;
    }

    function soSortCreditPacks(packs) {
        return packs.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function soValidateCreditPacks(packs) {
        const ids = new Set();
        for (let i = 0; i < packs.length; i++) {
            const p = packs[i];
            if (!p.id) return `Credit pack #${i + 1}: id is required.`;
            if (ids.has(p.id)) return `Duplicate credit pack id "${p.id}".`;
            ids.add(p.id);
            if (p.credits < 1) return `Pack "${p.id}": credits must be ≥ 1.`;
            if (p.price < 0) return `Pack "${p.id}": price must be ≥ 0.`;
        }
        return '';
    }

    function soGetLicenseDeviceIds(lic) {
        if (Array.isArray(lic.device_ids) && lic.device_ids.length) {
            return lic.device_ids.map(id => String(id || '').trim()).filter(Boolean);
        }
        const legacy = lic.machineId && String(lic.machineId).trim();
        return legacy ? [legacy] : [];
    }

    function soGetLicenseMaxDevices(lic) {
        if (soIsUnlimitedDevices(lic)) return 0;
        const override = parseInt(lic.max_devices, 10);
        if (Number.isFinite(override) && override >= 0) {
            if (override === 0) return 0;
            return override;
        }
        const planId = lic.planId || lic.planType;
        const plan = soPlans.find(p => p.id === planId);
        if (plan) {
            if (soIsUnlimitedDevices(plan)) return 0;
            const pm = parseInt(plan.max_devices, 10);
            if (Number.isFinite(pm) && pm >= 1) return pm;
        }
        return 1;
    }

    function soFormatDevicesLabel(lic) {
        const ids = soGetLicenseDeviceIds(lic);
        if (soIsUnlimitedDevices(lic)) return `${ids.length} / Unlimited`;
        const max = soGetLicenseMaxDevices(lic);
        return `${ids.length}/${max || 1}`;
    }

    function soFormatImageGenLabel(lic) {
        const total = parseInt(lic.images_generated_total, 10) || 0;
        const today = parseInt(lic.images_generated_today, 10) || 0;
        const month = parseInt(lic.images_generated_month, 10) || 0;
        return `${total} total runs · ${today} today · ${month} this month`;
    }

    function soLicenseNeverExpires(lic) {
        if (!lic) return false;
        if (soIsUnlimitedTime(lic)) return true;
        const planId = lic.planId || lic.planType;
        const plan = planId ? soPlans.find(p => p.id === planId) : null;
        if (plan && soIsUnlimitedTime(plan)) return true;
        if (lic.plan_kind === 'lifetime' || lic.plan_kind === 'unlimited') return true;
        if (plan && (plan.plan_kind === 'lifetime' || plan.plan_kind === 'unlimited')) return true;
        const planDays = lic.planDays != null ? parseInt(lic.planDays, 10) : (plan ? parseInt(plan.days, 10) : NaN);
        if (planDays === 0) return true;
        return false;
    }

    function soFormatValidity(lic) {
        if (soLicenseNeverExpires(lic)) return 'Never expires';
        const exp = soLicenseExpiryDate(lic);
        if (exp) {
            return exp.getTime() < Date.now()
                ? 'Expired'
                : `Expires ${soFormatTs(lic.expiresAt)}`;
        }
        const expStr = lic.expiresAt && typeof lic.expiresAt === 'string' ? lic.expiresAt.trim() : '';
        if (expStr) return `Expires ${expStr}`;
        if (!lic.activatedAt && lic.expiry_starts_on_activation !== false) {
            const days = lic.planDays != null ? lic.planDays : '?';
            if (parseInt(days, 10) === 0) return 'Never expires';
            return `Starts on activation (${days} days)`;
        }
        return 'No expiry';
    }

    function soIsLicenseActivated(lic) {
        const deviceIds = soGetLicenseDeviceIds(lic);
        return deviceIds.length > 0
            || !!(lic.activatedAt && String(lic.activatedAt).trim())
            || !!(lic.machineId && String(lic.machineId).trim());
    }

    function soIsLicenseShared(lic) {
        return !!(lic.shared_at || (lic.sharedAt && String(lic.sharedAt).trim()));
    }

    function soGetLicenseRegistryStatus(lic) {
        if (lic.active === false) return 'revoked';
        if (soLicenseNeverExpires(lic)) return 'lifetime';
        if (soIsLicenseExpired(lic)) return 'expired';
        if (!soIsLicenseActivated(lic)) {
            return soIsLicenseShared(lic) ? 'unused_shared' : 'unused';
        }
        const bal = parseInt(lic.credits_balance, 10) || 0;
        const billing = lic.billing_mode || 'subscription';
        if ((billing === 'credits' || billing === 'hybrid') && !soIsUnlimitedCredits(lic) && bal <= 5) {
            return 'credits_low';
        }
        return 'active';
    }

    function soRegistryStatusLabel(status) {
        const map = {
            revoked: 'Revoked',
            expired: 'Expired',
            lifetime: 'Lifetime',
            unused: 'Unused · not shared',
            unused_shared: 'Unused · shared',
            credits_low: 'Credits low',
            active: 'Active'
        };
        return map[status] || status;
    }

    function soFormatCreditsLabel(lic) {
        if (soIsUnlimitedCredits(lic)) return 'Unlimited';
        const bal = parseInt(lic.credits_balance, 10) || 0;
        const used = parseInt(lic.credits_used, 10) || 0;
        const included = parseInt(lic.included_credits, 10);
        const addon = parseInt(lic.addon_credits, 10);
        let extra = '';
        if (Number.isFinite(included) && included > 0) extra += ` · ${included} base`;
        if (Number.isFinite(addon) && addon > 0) extra += ` · +${addon} addon`;
        return `${bal} balance · ${used} used${extra}`;
    }

    function soReadSelectedLicenseAddonIds() {
        const container = document.getElementById('so-license-addon-picks');
        if (!container) return [];
        return Array.from(container.querySelectorAll('[data-license-addon]:checked')).map(el => el.value);
    }

    function soRenderLicenseAddonPicks(plan, preselectedIds) {
        const section = document.getElementById('so-license-addon-section');
        const container = document.getElementById('so-license-addon-picks');
        const summary = document.getElementById('so-license-credits-summary');
        if (!section || !container) return;
        const addons = soGetActivePlanCreditAddons(plan);
        if (!plan || !addons.length || soIsUnlimitedCredits(plan)) {
            section.style.display = 'none';
            container.innerHTML = '';
            if (summary) summary.textContent = '';
            return;
        }
        section.style.display = 'block';
        const selected = new Set(Array.isArray(preselectedIds) ? preselectedIds : []);
        if (!selected.size) {
            addons.filter(a => a.default_selected).forEach(a => selected.add(a.id));
        }
        const maxSel = parseInt(plan.max_addon_selections, 10) || 0;
        container.innerHTML = addons.map(a => `
            <label class="so-plan-check so-license-addon-pick">
                <input type="checkbox" data-license-addon value="${soAttr(a.id)}" ${selected.has(a.id) ? 'checked' : ''} onchange="soOnLicenseAddonChange()">
                ${soEsc(a.label || a.id)} — +${a.credits} credits · ₹${a.price}
            </label>
        `).join('');
        if (summary) {
            summary.textContent = maxSel === 1
                ? 'Pick at most one add-on (plan limit).'
                : (maxSel > 1 ? `Pick up to ${maxSel} add-ons.` : 'Select any combination of add-ons.');
        }
        soOnLicenseAddonChange();
    }

    window.soOnLicenseAddonChange = function() {
        const planId = document.getElementById('so-license-plan')?.value;
        const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
        if (!plan) return;
        const maxSel = parseInt(plan.max_addon_selections, 10) || 0;
        const container = document.getElementById('so-license-addon-picks');
        if (container && maxSel === 1) {
            const checked = container.querySelectorAll('[data-license-addon]:checked');
            if (checked.length > 1) {
                const last = checked[checked.length - 1];
                container.querySelectorAll('[data-license-addon]:checked').forEach(el => {
                    if (el !== last) el.checked = false;
                });
            }
        } else if (container && maxSel > 1) {
            const checked = container.querySelectorAll('[data-license-addon]:checked');
            if (checked.length > maxSel) {
                checked[checked.length - 1].checked = false;
                soToast(`This plan allows at most ${maxSel} add-on(s).`);
            }
        }
        const selectedIds = soReadSelectedLicenseAddonIds();
        const calc = soCalculatePlanCredits(plan, selectedIds);
        const balEl = document.getElementById('so-license-credits-balance');
        if (balEl && !soEditingLicenseKey) {
            balEl.value = calc.total;
        }
        const summary = document.getElementById('so-license-credits-summary');
        if (summary && plan.allow_credit_addons) {
            const priceExtra = calc.addonPrice;
            summary.textContent = `Credits: ${calc.included} base + ${calc.addon} addon = ${calc.total} total` +
                (priceExtra > 0 ? ` · Add-on price +₹${priceExtra} on top of plan` : '');
        }
    };

    function soValidatePlans(plans) {
        const ids = new Set();
        for (let i = 0; i < plans.length; i++) {
            const p = plans[i];
            if (!p.name || !String(p.name).trim()) return `Plan #${i + 1}: name is required.`;
            if (!p.id) return `Plan #${i + 1}: id is required.`;
            if (ids.has(p.id)) return `Duplicate plan id "${p.id}".`;
            ids.add(p.id);
            if (p.price < 0) return `Plan "${p.id}": price must be ≥ 0.`;
            if (p.days < 0) return `Plan "${p.id}": days must be ≥ 0 (0 = unlimited).`;
            if (p.allow_credit_addons && Array.isArray(p.credit_addons)) {
                const addonIds = new Set();
                for (let j = 0; j < p.credit_addons.length; j++) {
                    const a = p.credit_addons[j];
                    if (!a.id) return `Plan "${p.id}" addon #${j + 1}: id is required.`;
                    if (addonIds.has(a.id)) return `Plan "${p.id}": duplicate addon id "${a.id}".`;
                    addonIds.add(a.id);
                    if (a.credits < 1) return `Plan "${p.id}" addon "${a.id}": credits must be ≥ 1.`;
                    if (a.price < 0) return `Plan "${p.id}" addon "${a.id}": price must be ≥ 0.`;
                }
            }
        }
        const bestCount = plans.filter(p => p.best).length;
        if (bestCount > 1) return 'Only one plan can have BEST VALUE (best: true).';
        return '';
    }

    function soSortPlans(plans) {
        return plans.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function soGenerateKeySegment() {
        let seg = '';
        for (let i = 0; i < 4; i++) seg += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
        return seg;
    }

    function soFormatLicenseKey() {
        return `MEESHO-${soGenerateKeySegment()}-${soGenerateKeySegment()}-${soGenerateKeySegment()}`;
    }

    async function soKeyExists(key) {
        const upper = String(key || '').trim().toUpperCase();
        if (!upper) return true;
        const lic = await soDb().collection(SO_LICENSE_COL).doc(upper).get();
        if (lic.exists) return true;
        const demo = await soDb().collection(SO_DEMO_COL).doc(upper).get();
        if (demo.exists) return true;
        if (soInlineDemoKeys && soInlineDemoKeys[upper]) return true;
        if (soConfig && soConfig.demo_keys && soConfig.demo_keys[upper]) return true;
        return false;
    }

    async function soGenerateUniqueLicenseKey() {
        for (let attempt = 0; attempt < 12; attempt++) {
            const key = soFormatLicenseKey();
            if (!(await soKeyExists(key))) return key;
        }
        throw new Error('Could not generate a unique license key. Try again.');
    }

    function soFormatTs(ts) {
        if (!ts) return '—';
        try {
            const d = ts.toDate ? ts.toDate() : new Date(ts);
            if (Number.isNaN(d.getTime())) return '—';
            return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_) {
            return String(ts);
        }
    }

    function soParseDate(val) {
        if (!val) return null;
        try {
            if (val.toDate) return val.toDate();
            const d = new Date(val);
            return Number.isNaN(d.getTime()) ? null : d;
        } catch (_) {
            return null;
        }
    }

    function soLicenseExpiryDate(lic) {
        return soParseDate(lic.expiresAt);
    }

    function soIsLicenseExpired(lic) {
        if (soLicenseNeverExpires(lic)) return false;
        const exp = soLicenseExpiryDate(lic);
        return !!(exp && exp.getTime() < Date.now());
    }

    function soPlanInUse(planId) {
        if (!planId) return false;
        return soLicenses.some(lic => lic.planId === planId || lic.planType === planId);
    }

    function soFormatExpiry(lic) {
        if (soIsUnlimitedTime(lic)) return 'Unlimited';
        if (lic.expiresAt && typeof lic.expiresAt === 'string' && lic.expiresAt.trim()) return lic.expiresAt;
        if (lic.expiresAt && lic.expiresAt.toDate) return soFormatTs(lic.expiresAt);
        if (!lic.activatedAt && lic.expiry_starts_on_activation !== false) {
            const days = lic.planDays != null ? lic.planDays : '?';
            if (parseInt(days, 10) === 0) return 'Unlimited — starts on activation';
            return `Starts on activation (${days} days)`;
        }
        return '—';
    }

    window.toggleSoSectionAccordion = function(sectionId) {
        const el = document.querySelector(`.so-section-accordion[data-so-section="${sectionId}"]`);
        if (!el) return;
        el.classList.toggle('so-section-accordion--open');
        if (el.classList.contains('so-section-accordion--open')) {
            soOpenSections.add(sectionId);
            if (sectionId === 'config-preview' || sectionId === 'config-plans') {
                renderSoExtensionPreview();
            }
        } else {
            soOpenSections.delete(sectionId);
        }
    };

    function soRestoreSectionAccordions() {
        document.querySelectorAll('.so-section-accordion[data-so-section]').forEach(el => {
            const id = el.getAttribute('data-so-section');
            if (soOpenSections.has(id)) el.classList.add('so-section-accordion--open');
            else el.classList.remove('so-section-accordion--open');
        });
    }

    window.soMarkTabDirty = function(tab) {
        if (soHydrating || !soSnapshotsReady || !soUserEditsEnabled) return;
        if (tab === 'config' || tab === 'credits') {
            soScheduleDirtyCheck();
            soScheduleDraftSave();
        }
    };

    function soResetUserEditGate() {
        soUserEditsEnabled = false;
    }

    function soEnableUserEditGate() {
        soUserEditsEnabled = true;
    }

    function soBindUserEditGate() {
        const root = document.getElementById('shipping-optimizer-admin-section');
        if (!root || root.dataset.soEditGateBound) return;
        root.dataset.soEditGateBound = '1';
        const enable = (e) => {
            if (soHydrating || !soSnapshotsReady) return;
            if (e && e.isTrusted === false) return;
            soUserEditsEnabled = true;
        };
        root.addEventListener('input', enable, true);
        root.addEventListener('change', enable, true);
    }

    window.soHasUnsavedChanges = function() {
        if (!soSnapshotsReady || !soUserEditsEnabled) return false;
        soRecomputeDirtyState();
        return !!(soDirtyTabs.config || soDirtyTabs.credits);
    };

    function soScheduleDirtyCheck() {
        clearTimeout(soDirtyCheckTimer);
        soDirtyCheckTimer = setTimeout(soRecomputeDirtyState, 0);
    }

    function soDraftsEnabled() {
        return typeof adminCrudDraftsEnabled === 'function' ? adminCrudDraftsEnabled() : true;
    }

    function soReadGeneralConfigLenient() {
        return {
            whatsapp_number: String(document.getElementById('so-whatsapp-number')?.value || '').replace(/\D/g, ''),
            whatsapp_message: String(document.getElementById('so-whatsapp-message')?.value || '').trim(),
            extension_enabled: !!document.getElementById('so-extension-enabled')?.checked,
            min_extension_version: String(document.getElementById('so-min-version')?.value || '1.2.0').trim(),
            announcement: String(document.getElementById('so-announcement')?.value || '').trim()
        };
    }

    function soSerializePlansState() {
        const container = document.getElementById('so-plans-editor');
        const plans = (container && container.querySelector('.so-pricing-plan-row'))
            ? soReadPlansFromDom()
            : soPlans.slice();
        return plans.map((p, i) => soPlanToFirestore(soNormalizePlan(p, i), i));
    }

    function soSerializeInlineDemoState() {
        soPreserveInlineDemoRowsFromDom();
        const out = {};
        soInlineDemoKeyRows.forEach(row => {
            const key = String(row.key || '').trim().toUpperCase();
            if (key.length < 6) return;
            out[key] = soDemoKeyEntryToInlineMap(row);
        });
        const sorted = {};
        Object.keys(out).sort().forEach(k => { sorted[k] = out[k]; });
        return sorted;
    }

    function soSerializeSupportState() {
        const container = document.getElementById('so-support-users-editor');
        if (container && container.querySelector('.so-support-user-row')) {
            return soSupportToFirestore(soReadSupportFromDom());
        }
        return soSupportToFirestore(soSupport || soConfig?.support || DEFAULT_SUPPORT);
    }

    function soReadSupportFromDom() {
        const enabled = !!document.getElementById('so-support-enabled')?.checked;
        const title = String(document.getElementById('so-support-title')?.value || DEFAULT_SUPPORT.title).trim();
        const pageSize = Math.max(1, parseInt(document.getElementById('so-support-page-size')?.value, 10) || DEFAULT_SUPPORT.page_size);
        const container = document.getElementById('so-support-users-editor');
        const users = [];
        if (container) {
            container.querySelectorAll('.so-support-user-row').forEach((row, idx) => {
                const get = (field) => {
                    const el = row.querySelector(`[data-support-field="${field}"]`);
                    if (!el) return '';
                    if (el.type === 'checkbox') return el.checked;
                    return el.value;
                };
                users.push(soNormalizeSupportUser({
                    id: get('id'),
                    name: get('name'),
                    role: get('role'),
                    label: get('label'),
                    whatsapp_number: get('whatsapp_number'),
                    whatsapp_message: get('whatsapp_message'),
                    active: get('active'),
                    order: idx
                }, idx));
            });
        }
        return { enabled, title, page_size: pageSize, users };
    }

    function soBindSupportForm() {
        const support = soNormalizeSupport(soSupport || soConfig?.support || DEFAULT_SUPPORT);
        soSupport = support;
        const enabledEl = document.getElementById('so-support-enabled');
        if (enabledEl) enabledEl.checked = support.enabled !== false;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        setVal('so-support-title', support.title);
        setVal('so-support-page-size', support.page_size);
        soUpdateSupportPaginationPreview();
        renderSoSupportUsersEditor();
    }

    function soUpdateSupportPaginationPreview() {
        const preview = document.getElementById('so-support-page-preview');
        if (!preview) return;
        const pageSize = Math.max(1, parseInt(document.getElementById('so-support-page-size')?.value, 10) || DEFAULT_SUPPORT.page_size);
        const activeCount = (soReadSupportFromDom().users || []).filter(u => u.active !== false).length;
        const pages = Math.max(1, Math.ceil(activeCount / pageSize));
        preview.textContent = `Page 1 of ${pages} (${activeCount} active contact${activeCount === 1 ? '' : 's'} · ${pageSize} per page)`;
    }

    function renderSoSupportUsersEditor() {
        const container = document.getElementById('so-support-users-editor');
        if (!container) return;
        const support = soSupport || soNormalizeSupport(soConfig?.support || DEFAULT_SUPPORT);
        const users = support.users || [];
        if (!users.length) {
            container.innerHTML = '<p class="so-admin-muted">No support contacts yet. Tap + Add contact.</p>';
            soUpdateSupportPaginationPreview();
            return;
        }
        container.innerHTML = users.map((user, idx) => `
            <div class="so-support-user-row so-plan-card so-collapsible-row so-collapsible-row--open" data-support-idx="${idx}">
                <div class="so-plan-fields so-plan-fields--basic">
                    <label><span>Id</span><input type="text" data-support-field="id" value="${soAttr(user.id)}" oninput="soMarkTabDirty('config'); soUpdateSupportPaginationPreview()"></label>
                    <label><span>Name</span><input type="text" data-support-field="name" value="${soAttr(user.name)}" oninput="soMarkTabDirty('config')"></label>
                    <label><span>Role</span><input type="text" data-support-field="role" value="${soAttr(user.role)}" oninput="soMarkTabDirty('config')"></label>
                    <label><span>Subtitle / label</span><input type="text" data-support-field="label" value="${soAttr(user.label)}" oninput="soMarkTabDirty('config')"></label>
                    <label><span>WhatsApp number</span><input type="text" data-support-field="whatsapp_number" inputmode="numeric" value="${soAttr(user.whatsapp_number)}" oninput="soMarkTabDirty('config')"></label>
                    <label style="grid-column:1/-1;"><span>WhatsApp prefill (optional)</span><input type="text" data-support-field="whatsapp_message" value="${soAttr(user.whatsapp_message || '')}" oninput="soMarkTabDirty('config')"></label>
                </div>
                <div class="so-plan-flags so-plan-flags--simple">
                    <label class="so-plan-check"><input type="checkbox" data-support-field="active" ${user.active !== false ? 'checked' : ''} onchange="soMarkTabDirty('config'); soUpdateSupportPaginationPreview()"> Show in extension</label>
                </div>
                <div class="so-plan-actions-bar">
                    <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoSupportUser(${idx}, -1)" title="Move up">▲</button>
                    <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoSupportUser(${idx}, 1)" title="Move down">▼</button>
                    <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="removeSoSupportUser(${idx})">✕ Remove</button>
                </div>
            </div>
        `).join('');
        soUpdateSupportPaginationPreview();
    }

    window.addSoSupportUser = function() {
        soSupport = soReadSupportFromDom();
        soSupport.users.push(soNormalizeSupportUser({
            id: `contact_${soSupport.users.length + 1}`,
            name: 'New contact',
            role: '',
            label: '',
            whatsapp_number: soConfig?.whatsapp_number || '919654414891',
            whatsapp_message: '',
            active: true
        }, soSupport.users.length));
        renderSoSupportUsersEditor();
        soMarkTabDirty('config');
    };

    window.removeSoSupportUser = function(idx) {
        soSupport = soReadSupportFromDom();
        soSupport.users.splice(idx, 1);
        soSupport.users.forEach((u, i) => { u.order = i; });
        renderSoSupportUsersEditor();
        soMarkTabDirty('config');
    };

    window.moveSoSupportUser = function(idx, dir) {
        soSupport = soReadSupportFromDom();
        const next = idx + dir;
        if (next < 0 || next >= soSupport.users.length) return;
        const tmp = soSupport.users[idx];
        soSupport.users[idx] = soSupport.users[next];
        soSupport.users[next] = tmp;
        soSupport.users.forEach((u, i) => { u.order = i; });
        renderSoSupportUsersEditor();
        soMarkTabDirty('config');
    };

    function soFormatPlanFeaturesForEditor(features) {
        if (!Array.isArray(features) || !features.length) return '';
        return features.map(f => {
            if (typeof f === 'string') return f;
            const icon = String(f.icon || '').trim();
            const title = String(f.title || '').trim();
            const text = String(f.text || '').trim();
            if (icon || title || text) return [icon, title, text].join('|');
            return '';
        }).filter(Boolean).join('\n');
    }

    function soParsePlanFeaturesFromText(text) {
        return String(text || '').split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed) return null;
            if (trimmed.includes('|')) {
                const parts = trimmed.split('|');
                const icon = (parts[0] || '').trim();
                const title = (parts[1] || '').trim();
                const detail = (parts[2] || '').trim();
                if (!icon && !title && !detail) return null;
                return { icon, title, text: detail };
            }
            return trimmed;
        }).filter(Boolean);
    }

    function soParsePlanFeaturesText(text) {
        return String(text || '').split('\n').map(line => line.trim()).filter(Boolean);
    }

    function soParsePlanDetailSectionsFromDom(row) {
        const sections = [];
        row.querySelectorAll('.so-plan-detail-section-row').forEach((secRow, idx) => {
            const title = String(secRow.querySelector('[data-detail-field="title"]')?.value || '').trim();
            const body = String(secRow.querySelector('[data-detail-field="body"]')?.value || '').trim();
            const itemsText = String(secRow.querySelector('[data-detail-field="items"]')?.value || '');
            const items = itemsText.split('\n').map(s => s.trim()).filter(Boolean);
            if (title || body || items.length) {
                const sec = { title };
                if (body) sec.body = body;
                if (items.length) sec.items = items;
                sections.push(sec);
            }
        });
        return sections;
    }

    function soRenderPlanDetailSectionRow(section, planIdx, secIdx) {
        const sec = section || {};
        const itemsText = Array.isArray(sec.items) ? sec.items.join('\n') : '';
        return `
            <div class="so-plan-detail-section-row" data-detail-idx="${secIdx}">
                <label><span>Section title</span><input type="text" data-detail-field="title" value="${soAttr(sec.title || '')}" oninput="soMarkTabDirty('config')"></label>
                <label><span>Body (optional)</span><textarea rows="2" data-detail-field="body" oninput="soMarkTabDirty('config')">${soEsc(sec.body || '')}</textarea></label>
                <label><span>Items (one per line)</span><textarea rows="3" data-detail-field="items" oninput="soMarkTabDirty('config')">${soEsc(itemsText)}</textarea></label>
                <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="removeSoPlanDetailSection(${planIdx}, ${secIdx})">Remove section</button>
            </div>`;
    }

    function soNormalizeImageGeneration(raw) {
        const g = Object.assign({}, DEFAULT_IMAGE_GENERATION, raw && typeof raw === 'object' ? raw : {});
        g.enabled = g.enabled !== false;
        g.credits_per_image = Math.max(0, parseInt(g.credits_per_image, 10));
        if (!Number.isFinite(g.credits_per_image)) g.credits_per_image = DEFAULT_IMAGE_GENERATION.credits_per_image;
        g.daily_limit = Math.max(0, parseInt(g.daily_limit, 10) || 0);
        g.monthly_limit = Math.max(0, parseInt(g.monthly_limit, 10) || 0);
        g.max_batch_size = Math.max(0, parseInt(g.max_batch_size, 10));
        if (!Number.isFinite(g.max_batch_size)) g.max_batch_size = DEFAULT_IMAGE_GENERATION.max_batch_size;
        return g;
    }

    function soReadImageGenerationFromDom() {
        return soNormalizeImageGeneration({
            enabled: !!document.getElementById('so-img-gen-enabled')?.checked,
            credits_per_image: document.getElementById('so-img-gen-credits')?.value,
            daily_limit: document.getElementById('so-img-gen-daily-limit')?.value,
            monthly_limit: document.getElementById('so-img-gen-monthly-limit')?.value,
            max_batch_size: document.getElementById('so-img-gen-batch-max')?.value
        });
    }

    function soBindImageGenerationForm() {
        const img = soNormalizeImageGeneration(soCredits?.image_generation);
        const enabledEl = document.getElementById('so-img-gen-enabled');
        if (enabledEl) enabledEl.checked = img.enabled !== false;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        setVal('so-img-gen-credits', img.credits_per_image);
        setVal('so-img-gen-daily-limit', img.daily_limit);
        setVal('so-img-gen-monthly-limit', img.monthly_limit);
        setVal('so-img-gen-batch-max', img.max_batch_size);
        soUpdateImageGenPreviewCard();
    }

    window.soUpdateImageGenPreviewCard = function() {
        const card = document.getElementById('so-img-gen-preview-card');
        if (!card) return;
        const img = soReadImageGenerationFromDom();
        const creditsLabel = img.credits_per_image === 0 ? '0 (free)' : String(img.credits_per_image);
        card.innerHTML = `Example: customer uploads 1 image, selects 50 variants → counts as <strong>1 run</strong>, costs <strong>${creditsLabel}</strong> credits (if credits plan), uses <strong>1</strong> from daily limit.`;
    };

    function soBuildGeneralCanonical(fromDom) {
        if (fromDom) return soReadGeneralConfigLenient();
        return {
            whatsapp_number: String(soConfig?.whatsapp_number || '919654414891').replace(/\D/g, ''),
            whatsapp_message: String(soConfig?.whatsapp_message || 'Hi! I want to purchase Shipping Optimizer license.').trim(),
            extension_enabled: soConfig?.extension_enabled !== false,
            min_extension_version: String(soConfig?.min_extension_version || '1.0.0').trim(),
            announcement: String(soConfig?.announcement || '').trim()
        };
    }

    function soBuildInlineDemoCanonical(fromDom) {
        if (fromDom) return soSerializeInlineDemoState();
        const src = soInlineDemoKeys && Object.keys(soInlineDemoKeys).length
            ? soInlineDemoKeys
            : (soConfig?.demo_keys || DEFAULT_INLINE_DEMO_KEYS);
        const out = {};
        Object.keys(src).sort().forEach(k => {
            const key = String(k).trim().toUpperCase();
            if (key.length < 6) return;
            out[key] = soDemoKeyEntryToInlineMap(src[k]);
        });
        return out;
    }

    function soBuildPlansCanonical(fromDom) {
        if (fromDom) return soSerializePlansState();
        return soPlans.map((p, i) => soPlanToFirestore(soNormalizePlan(p, i), i));
    }

    function soBuildSupportCanonical(fromDom) {
        if (fromDom) return soSerializeSupportState();
        return soSupportToFirestore(soSupport || soConfig?.support || DEFAULT_SUPPORT);
    }

    function soBuildConfigCanonicalObject(fromDom) {
        return {
            general: soBuildGeneralCanonical(fromDom),
            plans: soBuildPlansCanonical(fromDom),
            inlineDemo: soBuildInlineDemoCanonical(fromDom),
            support: soBuildSupportCanonical(fromDom)
        };
    }

    function soBuildCreditsCanonicalObject(fromDom) {
        const container = document.getElementById('so-credit-packs-editor');
        const packs = fromDom && container && container.querySelector('.so-credit-pack-row')
            ? soReadCreditPacksFromDom()
            : soCreditPacks.slice();
        const c = soCredits || DEFAULT_CREDITS;
        return {
            enabled: fromDom
                ? !!document.getElementById('so-credits-enabled')?.checked
                : c.enabled !== false,
            price_per_credit: fromDom
                ? Math.max(0, parseInt(document.getElementById('so-credits-price-per')?.value, 10) || DEFAULT_CREDITS.price_per_credit)
                : Math.max(0, parseInt(c.price_per_credit, 10) || DEFAULT_CREDITS.price_per_credit),
            min_purchase: fromDom
                ? Math.max(1, parseInt(document.getElementById('so-credits-min-purchase')?.value, 10) || DEFAULT_CREDITS.min_purchase)
                : Math.max(1, parseInt(c.min_purchase, 10) || DEFAULT_CREDITS.min_purchase),
            cost_per_operation: fromDom
                ? Math.max(1, parseInt(document.getElementById('so-credits-cost-op')?.value, 10) || DEFAULT_CREDITS.cost_per_operation)
                : Math.max(1, parseInt(c.cost_per_operation, 10) || DEFAULT_CREDITS.cost_per_operation),
            image_generation: fromDom ? soReadImageGenerationFromDom() : soNormalizeImageGeneration(c.image_generation),
            packs: packs.map((p, i) => ({
                id: p.id,
                credits: p.credits,
                price: p.price,
                label: p.label,
                active: p.active !== false,
                order: i
            }))
        };
    }

    function soSerializeConfigTabState() {
        return JSON.stringify(soBuildConfigCanonicalObject(true));
    }

    function soSerializeCreditsTabState() {
        return JSON.stringify(soBuildCreditsCanonicalObject(true));
    }

    function soRecomputeDirtyState() {
        if (soHydrating || !soSnapshotsReady || !soUserEditsEnabled) {
            soDirtyTabs.config = false;
            soDirtyTabs.credits = false;
            soUpdateUnsavedBanner();
            return;
        }
        const configDirty = soTabSnapshots.config != null && soSerializeConfigTabState() !== soTabSnapshots.config;
        const creditsDirty = soTabSnapshots.credits != null && soSerializeCreditsTabState() !== soTabSnapshots.credits;
        soDirtyTabs.config = configDirty;
        soDirtyTabs.credits = creditsDirty;
        soUpdateUnsavedBanner();
    }

    function soCaptureSnapshots(fromDom) {
        const useDom = fromDom !== false;
        soTabSnapshots.config = JSON.stringify(soBuildConfigCanonicalObject(useDom));
        soTabSnapshots.credits = JSON.stringify(soBuildCreditsCanonicalObject(useDom));
        soDirtyTabs.config = false;
        soDirtyTabs.credits = false;
        soUpdateUnsavedBanner();
    }

    function soFinalizeAdminLoadState() {
        soSnapshotsReady = false;
        soHydrating = true;
        switchShippingOptimizerTab(soActiveTab);
        soHydrating = false;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                soCaptureSnapshots(true);
                soResetUserEditGate();
                soSnapshotsReady = true;
                soRecomputeDirtyState();
                soPruneStaleDraft();
                soRenderDraftBanner();
            });
        });
    }

    function soPruneStaleDraft() {
        const draft = soReadDraftFromStorage();
        if (!draft) return;
        try {
            const draftConfig = JSON.stringify(draft.config || {});
            const draftCredits = JSON.stringify(draft.credits || {});
            if (draftConfig === soTabSnapshots.config && draftCredits === soTabSnapshots.credits) {
                soClearDraftStorage();
            }
        } catch (_) { /* ignore */ }
    }

    function soClearTabDirty(tab) {
        if (tab === 'config') soTabSnapshots.config = soSerializeConfigTabState();
        if (tab === 'credits') soTabSnapshots.credits = soSerializeCreditsTabState();
        soRecomputeDirtyState();
    }

    function soUpdateUnsavedBanner() {
        const banner = document.getElementById('so-unsaved-banner');
        if (!banner) return;
        const dirty = soSnapshotsReady && soUserEditsEnabled && soDirtyTabs[soActiveTab];
        banner.hidden = !dirty;
        const label = banner.querySelector('span');
        if (label && dirty) {
            const tabName = soActiveTab === 'credits' ? 'Credits & Packs' : 'Config & Pricing';
            label.textContent = `Unsaved changes on ${tabName}`;
        }
    }

    function soReadDraftFromStorage() {
        if (!soDraftsEnabled()) return null;
        try {
            const raw = localStorage.getItem(SO_DRAFT_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.v !== 1) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    function soWriteDraftToStorage() {
        if (!soDraftsEnabled()) return;
        if (soHydrating) return;
        if (!soDirtyTabs.config && !soDirtyTabs.credits) {
            try { localStorage.removeItem(SO_DRAFT_STORAGE_KEY); } catch (_) { /* ignore */ }
            soRenderDraftBanner();
            return;
        }
        try {
            const payload = {
                v: 1,
                config: JSON.parse(soSerializeConfigTabState()),
                credits: JSON.parse(soSerializeCreditsTabState()),
                savedAt: Date.now()
            };
            localStorage.setItem(SO_DRAFT_STORAGE_KEY, JSON.stringify(payload));
        } catch (_) { /* ignore quota */ }
        soRenderDraftBanner();
    }

    function soScheduleDraftSave() {
        if (!soDraftsEnabled() || !soUserEditsEnabled) return;
        clearTimeout(soDraftSaveTimer);
        soDraftSaveTimer = setTimeout(() => {
            soRecomputeDirtyState();
            soWriteDraftToStorage();
        }, SO_DRAFT_SAVE_MS);
    }

    function soClearDraftStorage() {
        try { localStorage.removeItem(SO_DRAFT_STORAGE_KEY); } catch (_) { /* ignore */ }
        soRenderDraftBanner();
    }

    function soDraftMatchesCurrent(draft) {
        if (!draft) return true;
        try {
            const currentConfig = JSON.parse(soSerializeConfigTabState());
            const currentCredits = JSON.parse(soSerializeCreditsTabState());
            return JSON.stringify(draft.config) === JSON.stringify(currentConfig)
                && JSON.stringify(draft.credits) === JSON.stringify(currentCredits);
        } catch (_) {
            return false;
        }
    }

    function soApplyDraftToForms(draft) {
        if (!draft) return;
        soHydrating = true;
        const general = draft.config?.general || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        setVal('so-whatsapp-number', general.whatsapp_number || '');
        setVal('so-whatsapp-message', general.whatsapp_message || '');
        setVal('so-min-version', general.min_extension_version || '1.2.0');
        setVal('so-announcement', general.announcement || '');
        const enabledEl = document.getElementById('so-extension-enabled');
        if (enabledEl) enabledEl.checked = general.extension_enabled !== false;

        if (Array.isArray(draft.config?.plans)) {
            soPlans = soSortPlans(draft.config.plans.map(soNormalizePlan));
            soPlans.forEach((p, i) => { p.order = i; });
        }
        if (draft.config?.inlineDemo && typeof draft.config.inlineDemo === 'object') {
            soInlineDemoKeys = Object.assign({}, draft.config.inlineDemo);
            soSyncInlineDemoRowsFromObject();
        }
        if (draft.config?.support) {
            soSupport = soNormalizeSupport(draft.config.support);
        }

        const credits = draft.credits || {};
        soCredits = Object.assign({}, DEFAULT_CREDITS, {
            enabled: credits.enabled !== false,
            price_per_credit: credits.price_per_credit,
            min_purchase: credits.min_purchase,
            cost_per_operation: credits.cost_per_operation,
            image_generation: credits.image_generation
        });
        if (Array.isArray(credits.packs)) {
            soCreditPacks = soSortCreditPacks(credits.packs.map(soNormalizeCreditPack));
            soCreditPacks.forEach((p, i) => { p.order = i; });
        }

        soBindCreditsForm();
        soBindImageGenerationForm();
        soBindSupportForm();
        renderSoCreditPacksEditor();
        renderSoPlansEditor();
        renderSoInlineDemoKeysEditor();
        soPopulateLicensePlanSelect();
        soUpdateCustomCreditCalc();
        soHydrating = false;
        soEnableUserEditGate();
        soRecomputeDirtyState();
    }

    function soRenderDraftBanner() {
        const banner = document.getElementById('so-draft-recovery-banner');
        if (!banner) return;
        const draft = soReadDraftFromStorage();
        if (!draft || soDraftMatchesCurrent(draft)) {
            banner.hidden = true;
            banner.innerHTML = '';
            return;
        }
        const age = typeof adminDraftFormatAge === 'function'
            ? adminDraftFormatAge(draft.savedAt)
            : 'recently';
        const differsFromFirebase = soTabSnapshots.config && (
            JSON.stringify(draft.config) !== soTabSnapshots.config ||
            JSON.stringify(draft.credits) !== soTabSnapshots.credits
        );
        const hint = differsFromFirebase
            ? 'Local draft differs from last saved Firebase data. Restore to continue editing, or discard.'
            : 'Local draft differs from current form. Restore to apply it, or discard.';
        banner.hidden = false;
        banner.innerHTML = `
            <div class="admin-draft-banner admin-draft-banner--inline so-draft-banner">
                <div class="admin-draft-banner__text">
                    <strong>Unpublished draft</strong> saved ${soEsc(age)}
                    <div class="admin-draft-recovery-hint">${hint}</div>
                </div>
                <div class="admin-draft-banner__actions">
                    <button type="button" class="btn-gold so-btn-sm" onclick="soRestoreDraft()">Restore draft</button>
                    <button type="button" class="so-btn-sm so-btn-touch" onclick="soDiscardDraft()">Discard draft</button>
                </div>
            </div>`;
    }

    window.soRestoreDraft = function() {
        const draft = soReadDraftFromStorage();
        if (!draft) return soToast('No draft found.');
        soApplyDraftToForms(draft);
        soEnableUserEditGate();
        soToast('Draft restored. Save to Firebase when ready.');
        soRenderDraftBanner();
    };

    window.soDiscardDraft = function() {
        if (!confirm('Discard the local Shipping Optimizer draft? Firebase data will stay as-is.')) return;
        soClearDraftStorage();
        soToast('Draft discarded.');
    };

    window.soDiscardLocalEdits = function() {
        if (!confirm('Revert unsaved changes on this tab to last saved data?')) return;
        soHydrating = true;
        if (soActiveTab === 'config') {
            const rawPlans = Array.isArray(soConfig?.plans) && soConfig.plans.length
                ? soConfig.plans
                : DEFAULT_PLANS.slice();
            soPlans = soSortPlans(rawPlans.map(soNormalizePlan));
            soPlans.forEach((p, i) => { p.order = i; });
            if (soConfig?.demo_keys && typeof soConfig.demo_keys === 'object') {
                soInlineDemoKeys = Object.assign({}, soConfig.demo_keys);
            } else {
                soInlineDemoKeys = Object.assign({}, DEFAULT_INLINE_DEMO_KEYS);
            }
            soSyncInlineDemoRowsFromObject();
            soSupport = soNormalizeSupport(soConfig?.support || DEFAULT_SUPPORT);
            soBindConfigForm();
            soBindSupportForm();
            renderSoPlansEditor();
            renderSoInlineDemoKeysEditor();
        } else if (soActiveTab === 'credits') {
            const rawCredits = soConfig?.credits && typeof soConfig.credits === 'object' ? soConfig.credits : {};
            soCredits = Object.assign({}, DEFAULT_CREDITS, rawCredits);
            const rawPacks = Array.isArray(rawCredits.packs) && rawCredits.packs.length
                ? rawCredits.packs
                : DEFAULT_CREDIT_PACKS.slice();
            soCreditPacks = soSortCreditPacks(rawPacks.map(soNormalizeCreditPack));
            soCreditPacks.forEach((p, i) => { p.order = i; });
            soBindCreditsForm();
            soBindImageGenerationForm();
            renderSoCreditPacksEditor();
            soUpdateCustomCreditCalc();
        }
        soHydrating = false;
        if (soActiveTab === 'config') soClearTabDirty('config');
        else if (soActiveTab === 'credits') soClearTabDirty('credits');
        soResetUserEditGate();
        soWriteDraftToStorage();
        renderSoExtensionPreview();
        soToast('Reverted to last saved values.');
    };

    window.soSaveCurrentTab = function() {
        if (soActiveTab === 'config') saveShippingOptimizerConfig();
        else if (soActiveTab === 'credits') saveShippingOptimizerCredits();
    };

    function soConfirmLeaveTab(nextTab) {
        soRecomputeDirtyState();
        if (!soDirtyTabs[soActiveTab]) return true;
        return confirm('You have unsaved changes on this tab. Leave without saving?');
    }

    window.toggleSoPlanRow = function(idx) {
        soPlans = soReadPlansFromDom();
        const plan = soPlans[idx];
        if (!plan) return;
        const opening = !soExpandedPlanIds.has(plan.id);
        if (soExpandedPlanIds.has(plan.id)) soExpandedPlanIds.delete(plan.id);
        else soExpandedPlanIds.add(plan.id);
        if (opening) {
            soOpenSections.add('config-plans');
            const section = document.querySelector('.so-section-accordion[data-so-section="config-plans"]');
            if (section) section.classList.add('so-section-accordion--open');
        }
        renderSoPlansEditor();
        if (opening) {
            requestAnimationFrame(() => {
                const card = document.querySelector(`.so-pricing-plan-row[data-plan-idx="${idx}"]`);
                if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }
    };

    window.toggleSoPackRow = function(idx) {
        soCreditPacks = soReadCreditPacksFromDom();
        const pack = soCreditPacks[idx];
        if (!pack) return;
        const opening = !soExpandedPackIds.has(pack.id);
        if (soExpandedPackIds.has(pack.id)) soExpandedPackIds.delete(pack.id);
        else soExpandedPackIds.add(pack.id);
        if (opening) {
            soOpenSections.add('credits-packs');
            const section = document.querySelector('.so-section-accordion[data-so-section="credits-packs"]');
            if (section) section.classList.add('so-section-accordion--open');
        }
        renderSoCreditPacksEditor();
    };

    window.toggleSoLicenseRow = function(key) {
        if (soExpandedLicenseKeys.has(key)) soExpandedLicenseKeys.delete(key);
        else soExpandedLicenseKeys.add(key);
        renderSoLicensesList();
    };

    window.toggleShippingOptimizerAccordion = function() {
        const content = document.getElementById('shipping-optimizer-accordion-content');
        const icon = document.getElementById('shipping-optimizer-accordion-icon');
        if (!content) return;
        const open = content.style.display === 'none' || !content.style.display;
        content.style.display = open ? 'flex' : 'none';
        if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
        if (open && typeof loadShippingOptimizerAdmin === 'function') loadShippingOptimizerAdmin();
    };

    window.switchShippingOptimizerTab = function(tab) {
        const next = tab || 'config';
        if (next !== soActiveTab && !soConfirmLeaveTab(next)) {
            const sel = document.getElementById('so-tab-select');
            if (sel) sel.value = soActiveTab;
            return;
        }
        soActiveTab = next;
        const tabSel = document.getElementById('so-tab-select');
        if (tabSel && tabSel.value !== soActiveTab) tabSel.value = soActiveTab;
        document.querySelectorAll('.so-admin-tab-btn').forEach(btn => {
            btn.classList.toggle('so-admin-tab-btn--active', btn.getAttribute('data-so-tab') === soActiveTab);
        });
        soSyncTabChips();
        document.querySelectorAll('.so-admin-tab-panel').forEach(panel => {
            panel.style.display = panel.id === `so-tab-${soActiveTab}` ? 'block' : 'none';
        });
        soUpdateUnsavedBanner();
        soRestoreSectionAccordions();
        if (soActiveTab === 'credits') {
            soBindCreditsForm();
            soUpdateCustomCreditCalc();
        }
        if (soActiveTab === 'demo') {
            renderSoDemoPendingKeysEditor();
            renderSoDemoKeysList();
        }
        if (soActiveTab === 'config' || soActiveTab === 'credits') {
            renderSoExtensionPreview();
        }
        if (soActiveTab === 'licenses') renderSoLicensesList();
    };

    async function soLoadConfig() {
        const snap = await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).get();
        if (snap.exists) {
            soConfig = snap.data() || {};
        } else {
            soConfig = {};
        }
        const rawPlans = Array.isArray(soConfig.plans) && soConfig.plans.length
            ? soConfig.plans
            : DEFAULT_PLANS.slice();
        soPlans = soSortPlans(rawPlans.map(soNormalizePlan));
        soPlans.forEach((p, i) => { p.order = i; });
        const rawCredits = soConfig.credits && typeof soConfig.credits === 'object' ? soConfig.credits : {};
        soCredits = Object.assign({}, DEFAULT_CREDITS, rawCredits);
        const rawPacks = Array.isArray(rawCredits.packs) && rawCredits.packs.length
            ? rawCredits.packs
            : DEFAULT_CREDIT_PACKS.slice();
        soCreditPacks = soSortCreditPacks(rawPacks.map(soNormalizeCreditPack));
        soCreditPacks.forEach((p, i) => { p.order = i; });
        if (soConfig.demo_keys && typeof soConfig.demo_keys === 'object') {
            soInlineDemoKeys = Object.assign({}, soConfig.demo_keys);
        } else {
            soInlineDemoKeys = Object.assign({}, DEFAULT_INLINE_DEMO_KEYS);
        }
        soSyncInlineDemoRowsFromObject();
        soSupport = soNormalizeSupport(soConfig.support || DEFAULT_SUPPORT);
        soHydrating = true;
        soBindConfigForm();
        soBindSupportForm();
        soBindCreditsForm();
        soBindImageGenerationForm();
        renderSoCreditPacksEditor();
        renderSoPlansEditor();
        renderSoInlineDemoKeysEditor();
        soHydrating = false;
    }

    async function soLoadDemoKeys() {
        const snap = await soDb().collection(SO_DEMO_COL).limit(100).get();
        soDemoKeys = [];
        snap.forEach(doc => {
            soDemoKeys.push(Object.assign({ key: doc.id }, doc.data()));
        });
        soDemoKeys.sort((a, b) => {
            const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        soSyncDemoEditRowsFromCollection();
        soDemoSelectedKeys = new Set();
    }

    function soNormalizeDemoKeyEntry(raw) {
        const unlimited = !!(raw && (raw.unlimited_time || raw.unlimitedTime));
        let days = parseInt(raw && raw.days, 10);
        if (!Number.isFinite(days)) days = 30;
        if (unlimited) days = 0;
        else days = Math.max(1, days);
        const label = String((raw && raw.label) || '').trim();
        return {
            days,
            label,
            unlimited_time: unlimited,
            active: raw && raw.active !== false
        };
    }

    function soDemoKeyEntryToFirestore(entry) {
        const n = soNormalizeDemoKeyEntry(entry);
        const out = {
            days: n.days,
            label: n.label || (n.unlimited_time ? 'Unlimited demo' : `${n.days}-day promo`),
            active: n.active !== false
        };
        if (n.unlimited_time) out.unlimited_time = true;
        return out;
    }

    function soDemoKeyEntryToInlineMap(entry) {
        const n = soNormalizeDemoKeyEntry(entry);
        const out = {
            days: n.days,
            label: n.label || (n.unlimited_time ? 'Unlimited demo' : `${n.days}-day promo`)
        };
        if (n.unlimited_time) out.unlimited_time = true;
        return out;
    }

    function soFormatDemoKeyDuration(entry) {
        const n = soNormalizeDemoKeyEntry(entry);
        return n.unlimited_time ? 'Unlimited' : `${n.days} days`;
    }

    function soReadDemoKeyRowFromEl(row) {
        const unlimited = !!row.querySelector('[data-field="unlimited"]')?.checked;
        let days = parseInt(row.querySelector('[data-field="days"]')?.value, 10);
        if (!Number.isFinite(days)) days = 30;
        if (unlimited) days = 0;
        else days = Math.max(1, days);
        return {
            key: String(row.querySelector('[data-field="key"]')?.value || '').trim().toUpperCase(),
            days,
            label: String(row.querySelector('[data-field="label"]')?.value || '').trim(),
            unlimited_time: unlimited,
            active: row.querySelector('[data-field="active"]') ? !!row.querySelector('[data-field="active"]').checked : true
        };
    }

    function soRenderDemoKeyRowHtml(row, idx, opts) {
        opts = opts || {};
        const keyField = opts.keyReadonly
            ? `<input type="text" data-field="key" value="${soAttr(row.key)}" readonly style="text-transform:uppercase; opacity:0.85;">`
            : `<input type="text" data-field="key" value="${soAttr(row.key)}" placeholder="MEESHO-PROMO30" style="text-transform:uppercase;" oninput="${soAttr(opts.dirtyFn || "soMarkTabDirty('config')")}">`;
        const unlimited = !!row.unlimited_time;
        const daysDisabled = unlimited ? 'disabled' : '';
        const daysVal = unlimited ? 0 : (row.days || 30);
        const activeHtml = opts.showActive
            ? `<label class="so-plan-check so-demo-active-check"><input type="checkbox" data-field="active" ${row.active !== false ? 'checked' : ''} onchange="${soAttr(opts.dirtyFn || '')}"> Active</label>`
            : '';
        const unlimitedDirty = opts.dirtyFn || "soMarkTabDirty('config')";
        return `
            <div class="${opts.rowClass || 'so-inline-demo-row'}" data-inline-idx="${idx}" ${row.key ? `data-demo-key="${soAttr(row.key)}"` : ''}>
                ${opts.showSelect ? `<label class="so-plan-check so-demo-select-check"><input type="checkbox" data-field="select" ${soDemoSelectedKeys.has(row.key) ? 'checked' : ''} onchange="toggleSoDemoKeySelect('${soAttr(row.key)}', this.checked)"></label>` : ''}
                <label><span>Key (uppercase)</span>${keyField}</label>
                <label><span>Days</span>
                    <input type="number" data-field="days" min="0" step="1" value="${daysVal}" ${daysDisabled} oninput="${soAttr(unlimitedDirty)}"></label>
                <label><span>Label</span>
                    <input type="text" data-field="label" value="${soAttr(row.label || '')}" placeholder="Promo label" oninput="${soAttr(unlimitedDirty)}"></label>
                <label class="so-plan-check so-demo-unlimited-check"><input type="checkbox" data-field="unlimited" ${unlimited ? 'checked' : ''} onchange="soToggleDemoKeyUnlimited(this); ${soAttr(unlimitedDirty)}"> Unlimited</label>
                ${activeHtml}
                <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="${opts.removeFn || `removeSoInlineDemoKeyRow(${idx})`}">${opts.removeLabel || 'Remove'}</button>
            </div>`;
    }

    window.soToggleDemoKeyUnlimited = function(checkbox) {
        const row = checkbox.closest('.so-inline-demo-row, .so-demo-edit-row');
        if (!row) return;
        const daysInput = row.querySelector('[data-field="days"]');
        if (!daysInput) return;
        if (checkbox.checked) {
            daysInput.value = '0';
            daysInput.disabled = true;
        } else {
            daysInput.disabled = false;
            if (!parseInt(daysInput.value, 10)) daysInput.value = '30';
        }
    };

    async function soLoadLicenses() {
        let snap;
        try {
            snap = await soDb().collection(SO_LICENSE_COL).orderBy('expiresAt', 'desc').limit(SO_LICENSE_MAX).get();
        } catch (_) {
            try {
                snap = await soDb().collection(SO_LICENSE_COL).orderBy('createdAt', 'desc').limit(SO_LICENSE_MAX).get();
            } catch (_e) {
                snap = await soDb().collection(SO_LICENSE_COL).limit(SO_LICENSE_MAX).get();
            }
        }
        soLicenses = [];
        snap.forEach(doc => {
            soLicenses.push(Object.assign({ key: doc.id }, doc.data()));
        });
        soLicenses.sort((a, b) => {
            const ea = soLicenseExpiryDate(a);
            const eb = soLicenseExpiryDate(b);
            const ta = ea ? ea.getTime() : 0;
            const tb = eb ? eb.getTime() : 0;
            if (tb !== ta) return tb - ta;
            const ca = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            const cb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return cb - ca;
        });
    }

    function soBindConfigForm() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        setVal('so-whatsapp-number', soConfig.whatsapp_number || '919654414891');
        setVal('so-whatsapp-message', soConfig.whatsapp_message || 'Hi! I want to purchase Shipping Optimizer license.');
        setVal('so-min-version', soConfig.min_extension_version || '1.0.0');
        setVal('so-announcement', soConfig.announcement || '');
        const enabledEl = document.getElementById('so-extension-enabled');
        if (enabledEl) enabledEl.checked = soConfig.extension_enabled !== false;
    }

    function soBindCreditsForm() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        const credits = soCredits || DEFAULT_CREDITS;
        const enabledEl = document.getElementById('so-credits-enabled');
        if (enabledEl) enabledEl.checked = credits.enabled !== false;
        setVal('so-credits-price-per', credits.price_per_credit);
        setVal('so-credits-min-purchase', credits.min_purchase);
        setVal('so-credits-cost-op', credits.cost_per_operation);
    }

    window.soUpdateCustomCreditCalc = function() {
        const pricePer = Math.max(0, parseInt(document.getElementById('so-credits-price-per')?.value, 10) || DEFAULT_CREDITS.price_per_credit);
        const minPurchase = Math.max(1, parseInt(document.getElementById('so-credits-min-purchase')?.value, 10) || DEFAULT_CREDITS.min_purchase);
        const amountRaw = parseInt(document.getElementById('so-credits-custom-amount')?.value, 10);
        const amount = Number.isFinite(amountRaw) ? Math.max(0, amountRaw) : minPurchase;
        const effective = Math.max(amount, minPurchase);
        const total = effective * pricePer;
        const el = document.getElementById('so-credits-custom-price');
        if (el) {
            el.textContent = `${effective} credits × ₹${pricePer} = ₹${total}${amount < minPurchase ? ` (min ${minPurchase})` : ''}`;
        }
    };

    window.expandAllSoCreditPacks = function() {
        soCreditPacks = soReadCreditPacksFromDom();
        soCreditPacks.forEach(p => soExpandedPackIds.add(p.id));
        renderSoCreditPacksEditor();
    };

    window.collapseAllSoCreditPacks = function() {
        soExpandedPackIds.clear();
        renderSoCreditPacksEditor();
    };

    function renderSoCreditPacksEditor() {
        const container = document.getElementById('so-credit-packs-editor');
        if (!container) return;
        if (!soCreditPacks.length) {
            container.innerHTML = '<p class="so-admin-muted">No credit packs yet. Tap + Add credit pack.</p>';
            return;
        }
        container.innerHTML = soCreditPacks.map((pack, idx) => {
            const open = soExpandedPackIds.has(pack.id);
            const priceLabel = '₹' + (pack.price || 0).toLocaleString('en-IN');
            return `
            <div class="so-plan-card so-credit-pack-row so-collapsible-row ${open ? 'so-collapsible-row--open' : ''}" data-pack-idx="${idx}">
                <div class="so-plan-card-head-wrap">
                    <button type="button" class="so-plan-card-head" onclick="toggleSoPackRow(${idx})" aria-expanded="${open ? 'true' : 'false'}">
                        <span class="so-plan-order" aria-hidden="true">${idx + 1}</span>
                        <div class="so-plan-card-summary">
                            <div class="so-plan-card-title-row">
                                <strong class="so-plan-card-name">${soEsc(pack.label || pack.id)}</strong>
                                <span class="so-plan-card-price">${soEsc(priceLabel)}</span>
                            </div>
                            <div class="so-plan-card-meta">
                                <code class="so-plan-id-tag">${soEsc(pack.id)}</code>
                                <span class="so-meta-chip">${pack.credits} credits</span>
                            </div>
                            <div class="so-plan-card-badges">
                                ${pack.active ? '<span class="so-badge so-badge--on">Visible</span>' : '<span class="so-badge so-badge--off">Hidden</span>'}
                            </div>
                        </div>
                        <i class="fa fa-chevron-down so-plan-chevron" aria-hidden="true"></i>
                    </button>
                    <div class="so-plan-reorder" onclick="event.stopPropagation()">
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoCreditPack(${idx}, -1)" title="Move up" aria-label="Move pack up">▲</button>
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoCreditPack(${idx}, 1)" title="Move down" aria-label="Move pack down">▼</button>
                    </div>
                </div>
                <div class="so-plan-card-body" onclick="event.stopPropagation()">
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-box"></i> Pack details</div>
                        <div class="so-plan-fields so-plan-fields--basic">
                            <label><span>Id (slug)</span><input type="text" data-field="id" value="${soAttr(pack.id)}" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>Credits</span><input type="number" min="1" step="1" data-field="credits" value="${pack.credits}" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>Price (INR)</span><input type="number" min="0" step="1" data-field="price" value="${pack.price}" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>Label (shown in extension)</span><input type="text" data-field="label" value="${soAttr(pack.label || '')}" oninput="soMarkTabDirty('credits')"></label>
                        </div>
                        <div class="so-plan-flags so-plan-flags--simple">
                            <label class="so-plan-check"><input type="checkbox" data-field="active" ${pack.active ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Show in extension</label>
                        </div>
                    </div>
                    <div class="so-plan-actions-bar">
                        <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="removeSoCreditPack(${idx})"><i class="fa fa-trash"></i> Remove pack</button>
                    </div>
                </div>
            </div>`;
        }).join('');
        renderSoExtensionPreview();
    }

    function soReadCreditPacksFromDom() {
        const container = document.getElementById('so-credit-packs-editor');
        if (!container) return [];
        const rows = container.querySelectorAll('.so-credit-pack-row');
        const packs = [];
        rows.forEach((row, idx) => {
            const get = (field) => {
                const el = row.querySelector(`[data-field="${field}"]`);
                if (!el) return '';
                if (el.type === 'checkbox') return el.checked;
                return el.value;
            };
            packs.push(soNormalizeCreditPack({
                id: get('id'),
                credits: get('credits'),
                price: get('price'),
                label: get('label'),
                active: get('active'),
                order: idx
            }, idx));
        });
        return packs;
    }

    window.addSoCreditPack = function() {
        soCreditPacks = soReadCreditPacksFromDom();
        const nextOrder = soCreditPacks.length;
        soCreditPacks.push(soNormalizeCreditPack({
            id: `pack_${nextOrder + 1}`,
            credits: 10,
            price: 20,
            label: '10 credits — ₹20',
            active: true,
            order: nextOrder
        }, nextOrder));
        const added = soCreditPacks[soCreditPacks.length - 1];
        soExpandedPackIds.add(added.id);
        renderSoCreditPacksEditor();
        soMarkTabDirty('credits');
    };

    window.moveSoCreditPack = function(idx, dir) {
        soCreditPacks = soReadCreditPacksFromDom();
        const next = idx + dir;
        if (next < 0 || next >= soCreditPacks.length) return;
        const tmp = soCreditPacks[idx];
        soCreditPacks[idx] = soCreditPacks[next];
        soCreditPacks[next] = tmp;
        soCreditPacks.forEach((p, i) => { p.order = i; });
        renderSoCreditPacksEditor();
        soMarkTabDirty('credits');
    };

    window.removeSoCreditPack = function(idx) {
        soCreditPacks = soReadCreditPacksFromDom();
        if (!confirm('Remove this credit pack from config?')) return;
        soCreditPacks.splice(idx, 1);
        soCreditPacks.forEach((p, i) => { p.order = i; });
        renderSoCreditPacksEditor();
        soMarkTabDirty('credits');
    };

    function soFormatPlanDurationLabel(plan) {
        if (soIsUnlimitedTime(plan)) return 'Unlimited';
        if (plan.duration) return plan.duration;
        return `${plan.days || 0} days`;
    }

    function soFormatPlanDevicesLabel(plan) {
        if (soIsUnlimitedDevices(plan)) return 'Unlimited devices';
        const n = plan.max_devices != null ? plan.max_devices : 1;
        return `${n} device${n === 1 ? '' : 's'}`;
    }

    function soEnsureSingleBestPlan(plans) {
        let found = false;
        return plans.map(p => {
            if (!p.best) return p;
            if (found) return Object.assign({}, p, { best: false });
            found = true;
            return p;
        });
    }

    function soGetExtensionActivePlans() {
        const plans = soPlans.length ? soReadPlansFromDom() : soPlans.slice();
        return soEnsureSingleBestPlan(soSortPlans(plans.filter(p => p.active !== false)));
    }

    function soCollectExtensionWarnings() {
        const warnings = [];
        const plans = soReadPlansFromDom();
        plans.forEach(p => {
            if (p.days === 0 && !p.unlimited_time && !p.plan_kind) {
                warnings.push(`Plan "${p.name}" (${p.id}): days=0 — extension treats this as unlimited time even without the checkbox.`);
            }
            if (p.max_devices === 0 && !p.unlimited_devices) {
                warnings.push(`Plan "${p.name}" (${p.id}): max_devices=0 — extension treats this as unlimited devices.`);
            }
            if (p.billing_mode === 'credits' && !p.included_credits && !p.unlimited_credits && !p.allow_credit_addons) {
                warnings.push(`Plan "${p.name}" (${p.id}): credits billing with 0 included credits and no add-ons — customer gets no credits on activation.`);
            }
        });
        const inlineRows = soReadInlineDemoRowsFromDom();
        inlineRows.forEach(r => {
            if (r.unlimited_time) {
                warnings.push(`Inline demo key "${r.key}": unlimited_time needs extension patch in license.js (days-only works today).`);
            }
        });
        soDemoKeyEditRows.forEach(r => {
            if (r.unlimited_time) {
                warnings.push(`Collection demo key "${r.key}": unlimited_time needs extension patch in license.js.`);
            }
        });
        soReadPlansFromDom().forEach(p => {
            if (p.allow_credit_addons && soGetActivePlanCreditAddons(p).length) {
                warnings.push(`Plan "${p.name}" has credit add-ons — extension must support credit_addons[] in popup (see extension prompt).`);
            }
        });
        return warnings;
    }

    function renderSoExtensionPreview() {
        const container = document.getElementById('so-extension-preview');
        const warnEl = document.getElementById('so-extension-warnings');
        if (!container) return;

        const activePlans = soGetExtensionActivePlans();
        const credits = soCredits || DEFAULT_CREDITS;
        const packs = (soCreditPacks.length ? soReadCreditPacksFromDom() : soCreditPacks).filter(p => p.active !== false);
        let inlineDemo = {};
        try {
            inlineDemo = soReadInlineDemoKeysFromDom();
        } catch (_) {
            inlineDemo = soInlineDemoKeys || {};
        }
        const collectionDemo = soDemoKeys.filter(d => d.active !== false);
        const announcement = String(document.getElementById('so-announcement')?.value || soConfig?.announcement || '').trim();
        const extEnabled = document.getElementById('so-extension-enabled')
            ? document.getElementById('so-extension-enabled').checked
            : soConfig?.extension_enabled !== false;

        const plansHtml = activePlans.length
            ? `<div class="so-ext-preview-grid">${activePlans.map(p => {
                const bestClass = p.best ? ' so-ext-plan--best' : '';
                const durationLabel = soFormatPlanDurationLabel(p);
                const devicesLabel = soFormatPlanDevicesLabel(p);
                const note = p.save || `${durationLabel} · ${devicesLabel}`;
                const addons = soGetActivePlanCreditAddons(p);
                const addonsHtml = addons.length
                    ? `<div class="so-ext-plan-addons">${addons.map(a =>
                        `<span class="so-ext-addon-chip">+${a.credits} cr · ₹${a.price}</span>`
                    ).join('')}</div>`
                    : '';
                return `<div class="so-ext-plan${bestClass}">
                    ${p.best ? '<span class="so-ext-plan-tag">BEST VALUE</span>' : ''}
                    <div class="so-ext-plan-name">${soEsc(p.name)}</div>
                    <div class="so-ext-plan-price">₹${(p.price || 0).toLocaleString('en-IN')}</div>
                    <div class="so-ext-plan-note">${soEsc(note)}</div>
                    <div class="so-ext-plan-meta"><code>${soEsc(p.id)}</code> · ${soEsc(p.billing_mode || 'subscription')}${p.included_credits > 0 ? ` · ${p.included_credits} base cr` : ''}</div>
                    ${addonsHtml}
                </div>`;
            }).join('')}</div>`
            : '<p class="so-admin-muted">No active plans — extension shows default built-in plans.</p>';

        const creditsHtml = credits.enabled !== false
            ? `<div class="so-ext-preview-block">
                <div class="so-ext-preview-label">Credits top-up</div>
                <p class="so-admin-muted">₹${credits.price_per_credit}/credit · min ${credits.min_purchase} · ${credits.cost_per_operation} per operation</p>
                ${packs.length ? `<div class="so-ext-preview-grid so-ext-preview-grid--packs">${packs.map(p =>
                    `<div class="so-ext-plan so-ext-plan--pack">
                        <div class="so-ext-plan-name">${soEsc(p.label || `${p.credits} credits`)}</div>
                        <div class="so-ext-plan-price">₹${p.price}</div>
                        <div class="so-ext-plan-note">${p.credits} credits</div>
                    </div>`
                ).join('')}</div>` : '<p class="so-admin-muted">No active credit packs.</p>'}
            </div>`
            : '<p class="so-admin-muted">Credits disabled — extension hides credit packs section.</p>';

        const imgGen = soReadImageGenerationFromDom();
        const imgGenHtml = imgGen.enabled !== false
            ? `<div class="so-ext-preview-block">
                <div class="so-ext-preview-label">AI image generation</div>
                <p class="so-admin-muted">${imgGen.credits_per_image} credits/run · daily run limit ${imgGen.daily_limit || '∞'} · monthly ${imgGen.monthly_limit || '∞'} · max ${imgGen.max_batch_size || '∞'} variants/run</p>
            </div>`
            : '<p class="so-admin-muted">Image generation disabled in extension.</p>';

        const demoKeys = Object.assign({}, inlineDemo);
        collectionDemo.forEach(d => {
            demoKeys[d.key] = {
                days: d.days,
                label: d.label,
                unlimited_time: d.unlimited_time
            };
        });
        const demoList = Object.keys(demoKeys);
        const demoHtml = demoList.length
            ? `<ul class="so-ext-demo-list">${demoList.map(k => {
                const d = soNormalizeDemoKeyEntry(demoKeys[k]);
                return `<li><code>${soEsc(k)}</code> — ${soEsc(soFormatDemoKeyDuration(d))}${d.label ? ` · ${soEsc(d.label)}` : ''}</li>`;
            }).join('')}</ul><p class="so-admin-muted so-admin-tip">Extension also merges built-in keys from config.js (not removable here).</p>`
            : '<p class="so-admin-muted">No Firebase demo keys — extension uses built-in keys only.</p>';

        container.innerHTML = `
            <div class="so-ext-preview-status ${extEnabled ? 'so-ext-preview-status--on' : 'so-ext-preview-status--off'}">
                Extension licensing: <strong>${extEnabled ? 'Enabled' : 'Disabled'}</strong>
            </div>
            ${announcement ? `<div class="so-ext-announce">${soEsc(announcement)}</div>` : ''}
            <div class="so-ext-preview-block">
                <div class="so-ext-preview-label">Pricing plans (active only, as in popup)</div>
                ${plansHtml}
            </div>
            ${creditsHtml}
            ${imgGenHtml}
            <div class="so-ext-preview-block">
                <div class="so-ext-preview-label">Demo / promo keys (Firebase merged)</div>
                ${demoHtml}
            </div>`;

        if (warnEl) {
            const warnings = soCollectExtensionWarnings();
            warnEl.innerHTML = warnings.length
                ? `<div class="so-ext-warnings"><strong>Compatibility notes</strong><ul>${warnings.map(w => `<li>${soEsc(w)}</li>`).join('')}</ul></div>`
                : '<p class="so-admin-muted">No field mapping issues detected for current form values.</p>';
        }
    }

    function soReadGeneralConfigFromDom() {
        const whatsappRaw = String(document.getElementById('so-whatsapp-number')?.value || '').replace(/\D/g, '');
        if (whatsappRaw.length < 10) throw new Error('WhatsApp number must be at least 10 digits.');
        return {
            whatsapp_number: whatsappRaw,
            whatsapp_message: String(document.getElementById('so-whatsapp-message')?.value || '').trim(),
            extension_enabled: !!document.getElementById('so-extension-enabled')?.checked,
            min_extension_version: String(document.getElementById('so-min-version')?.value || '1.2.0').trim(),
            announcement: String(document.getElementById('so-announcement')?.value || '').trim()
        };
    }

    async function soPersistConfigPatch(patch, successMsg, options) {
        options = options || {};
        if (!soRequireExtensionWrite()) return;
        await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set(Object.assign({}, patch, {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: soAuthEmail()
        }), { merge: true });
        soConfig = Object.assign({}, soConfig, patch);
        if (patch.demo_keys) {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).update({ demo_keys: patch.demo_keys });
            soInlineDemoKeys = patch.demo_keys;
            soSyncInlineDemoRowsFromObject();
            renderSoInlineDemoKeysEditor();
        }
        if (patch.plans) {
            soPlans = soSortPlans(patch.plans.map(soNormalizePlan));
            soPlans.forEach((p, i) => { p.order = i; });
            renderSoPlansEditor();
            soPopulateLicensePlanSelect();
        }
        renderSoExtensionPreview();
        const snap = soTabSnapshots.config
            ? JSON.parse(soTabSnapshots.config)
            : JSON.parse(soSerializeConfigTabState());
        if (options.fullConfig) {
            soCaptureSnapshots(true);
        } else {
            if (patch.plans) {
                snap.plans = soPlans.map((p, i) => soPlanToFirestore(soNormalizePlan(p, i), i));
            }
            if (patch.demo_keys) {
                snap.inlineDemo = Object.assign({}, patch.demo_keys);
                const sorted = {};
                Object.keys(snap.inlineDemo).sort().forEach(k => { sorted[k] = snap.inlineDemo[k]; });
                snap.inlineDemo = sorted;
            }
            if (soPatchTouchesGeneral(patch)) {
                snap.general = soReadGeneralConfigLenient();
            }
            soTabSnapshots.config = JSON.stringify(snap);
            soRecomputeDirtyState();
        }
        if (!soDirtyTabs.config && !soDirtyTabs.credits) soClearDraftStorage();
        else soWriteDraftToStorage();
        soToast(successMsg);
    }

    function soPatchTouchesGeneral(patch) {
        return patch && (
            patch.whatsapp_number != null ||
            patch.whatsapp_message != null ||
            patch.extension_enabled != null ||
            patch.min_extension_version != null ||
            patch.announcement != null
        );
    }

    window.saveShippingOptimizerGeneral = async function() {
        if (!soRequireExtensionWrite()) return;
        let general;
        try {
            general = soReadGeneralConfigFromDom();
        } catch (e) {
            return soToast(e.message || 'Invalid general settings.');
        }
        try {
            await soPersistConfigPatch(general, 'General settings saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerPlans = async function() {
        if (!soRequireExtensionWrite()) return;
        soPlans = soReadPlansFromDom();
        const err = soValidatePlans(soPlans);
        if (err) return soToast(err);
        try {
            const plansPayload = soPlans.map((p, i) => soPlanToFirestore(p, i));
            await soPersistConfigPatch({ plans: plansPayload }, 'Pricing plans saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerInlineDemoKeys = async function() {
        if (!soRequireExtensionWrite()) return;
        soPreserveInlineDemoRowsFromDom();
        let demoKeysPayload;
        try {
            demoKeysPayload = soReadInlineDemoKeysFromDom();
        } catch (e) {
            return soToast(e.message || 'Invalid demo keys.');
        }
        try {
            await soPersistConfigPatch({ demo_keys: demoKeysPayload }, 'Inline demo keys saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerCreditSettings = async function() {
        if (!soRequireExtensionWrite()) return;
        const creditsPayload = Object.assign({}, soCredits || DEFAULT_CREDITS, {
            enabled: !!document.getElementById('so-credits-enabled')?.checked,
            price_per_credit: Math.max(0, parseInt(document.getElementById('so-credits-price-per')?.value, 10) || DEFAULT_CREDITS.price_per_credit),
            min_purchase: Math.max(1, parseInt(document.getElementById('so-credits-min-purchase')?.value, 10) || DEFAULT_CREDITS.min_purchase),
            cost_per_operation: Math.max(1, parseInt(document.getElementById('so-credits-cost-op')?.value, 10) || DEFAULT_CREDITS.cost_per_operation),
            image_generation: soReadImageGenerationFromDom(),
            packs: (soCreditPacks.length ? soReadCreditPacksFromDom() : soCreditPacks).map((p, i) => ({
                id: p.id, credits: p.credits, price: p.price, label: p.label, active: p.active !== false, order: i
            }))
        });
        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                credits: creditsPayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }, { merge: true });
            soCredits = creditsPayload;
            soConfig = Object.assign({}, soConfig, { credits: creditsPayload });
            soTabSnapshots.credits = soSerializeCreditsTabState();
            soRecomputeDirtyState();
            if (!soDirtyTabs.config && !soDirtyTabs.credits) soClearDraftStorage();
            else soWriteDraftToStorage();
            renderSoExtensionPreview();
            soToast('Credit settings saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerCreditPacks = async function() {
        if (!soRequireExtensionWrite()) return;
        soCreditPacks = soReadCreditPacksFromDom();
        const packErr = soValidateCreditPacks(soCreditPacks);
        if (packErr) return soToast(packErr);
        const creditsPayload = Object.assign({}, soCredits || DEFAULT_CREDITS, {
            image_generation: soReadImageGenerationFromDom(),
            packs: soCreditPacks.map((p, i) => ({
                id: p.id, credits: p.credits, price: p.price, label: p.label, active: p.active !== false, order: i
            }))
        });
        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                credits: creditsPayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }, { merge: true });
            soCredits = creditsPayload;
            soConfig = Object.assign({}, soConfig, { credits: creditsPayload });
            renderSoExtensionPreview();
            soToast('Credit packs saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.renderSoExtensionPreview = renderSoExtensionPreview;

    function soPlanMetaChips(plan) {
        const chips = [];
        chips.push(plan.billing_mode || 'subscription');
        if (soIsUnlimitedTime(plan)) chips.push('No expiry');
        else if (plan.duration) chips.push(plan.duration);
        else if (plan.days > 0) chips.push(`${plan.days} days`);
        if (soIsUnlimitedDevices(plan)) chips.push('Unlimited devices');
        else chips.push(`${plan.max_devices != null ? plan.max_devices : 1} device${(plan.max_devices || 1) !== 1 ? 's' : ''}`);
        if (plan.included_credits > 0) chips.push(`${plan.included_credits} base cr`);
        if (plan.allow_credit_addons && (plan.credit_addons || []).length) {
            const activeAddons = (plan.credit_addons || []).filter(a => a.active !== false).length;
            chips.push(`${activeAddons} addon${activeAddons === 1 ? '' : 's'}`);
        }
        if (plan.plan_kind) chips.push(plan.plan_kind);
        return chips.map(c => `<span class="so-meta-chip">${soEsc(c)}</span>`).join('');
    }

    function soUpdatePlansCount() {
        const el = document.getElementById('so-plans-count');
        if (!el) return;
        const n = soPlans.length;
        el.textContent = n === 1 ? '1 plan' : `${n} plans`;
    }

    window.expandAllSoPlans = function() {
        soPlans = soReadPlansFromDom();
        soPlans.forEach(p => soExpandedPlanIds.add(p.id));
        renderSoPlansEditor();
    };

    window.collapseAllSoPlans = function() {
        soExpandedPlanIds.clear();
        renderSoPlansEditor();
    };

    function renderSoPlansEditor() {
        const container = document.getElementById('so-plans-editor');
        if (!container) return;
        soUpdatePlansCount();
        if (!soPlans.length) {
            container.innerHTML = '<div class="so-plans-empty"><i class="fa fa-tags"></i><p>No plans yet</p><span class="so-admin-muted">Use quick-add presets or + Add Plan</span></div>';
            return;
        }
        container.innerHTML = soPlans.map((plan, idx) => {
            const open = soExpandedPlanIds.has(plan.id);
            const priceLabel = '₹' + (plan.price || 0).toLocaleString('en-IN');
            return `
            <div class="so-plan-card so-pricing-plan-row so-collapsible-row ${open ? 'so-collapsible-row--open' : ''}" data-plan-idx="${idx}">
                <div class="so-plan-card-head-wrap">
                    <button type="button" class="so-plan-card-head" onclick="toggleSoPlanRow(${idx})" aria-expanded="${open ? 'true' : 'false'}">
                        <span class="so-plan-order" aria-hidden="true">${idx + 1}</span>
                        <div class="so-plan-card-summary">
                            <div class="so-plan-card-title-row">
                                <strong class="so-plan-card-name">${soEsc(plan.name)}</strong>
                                <span class="so-plan-card-price">${soEsc(priceLabel)}</span>
                            </div>
                            <div class="so-plan-card-meta">
                                <code class="so-plan-id-tag">${soEsc(plan.id)}</code>
                                <div class="so-plan-chips">${soPlanMetaChips(plan)}</div>
                            </div>
                            <div class="so-plan-card-badges">
                                ${plan.best ? '<span class="so-badge so-badge--best">Best value</span>' : ''}
                                ${plan.active ? '<span class="so-badge so-badge--on">Visible</span>' : '<span class="so-badge so-badge--off">Hidden</span>'}
                                ${plan.save ? `<span class="so-meta-chip so-meta-chip--gold">${soEsc(plan.save)}</span>` : ''}
                            </div>
                        </div>
                        <i class="fa fa-chevron-down so-plan-chevron" aria-hidden="true"></i>
                    </button>
                    <div class="so-plan-reorder" onclick="event.stopPropagation()">
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoPlan(${idx}, -1)" title="Move up in list" aria-label="Move plan up">▲</button>
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoPlan(${idx}, 1)" title="Move down in list" aria-label="Move plan down">▼</button>
                    </div>
                </div>
                <div class="so-plan-card-body" onclick="event.stopPropagation()">
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-circle-info"></i> Basic info</div>
                        <div class="so-plan-fields so-plan-fields--basic">
                            <label>${soFieldLabelHtml('Id (slug) — never rename after use', 'plan-id', idx)}<input type="text" data-field="id" value="${soAttr(plan.id)}" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Display name</span><input type="text" data-field="name" value="${soAttr(plan.name)}" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Price (INR)</span><input type="number" min="0" step="1" data-field="price" value="${plan.price}" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Days (0 = unlimited)</span><input type="number" min="0" step="1" data-field="days" value="${plan.days}" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Duration label</span><input type="text" data-field="duration" value="${soAttr(plan.duration || '')}" placeholder="1 Year, Forever" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Save badge</span><input type="text" data-field="save" value="${soAttr(plan.save || '')}" placeholder="Save ₹8000" oninput="soMarkTabDirty('config')"></label>
                        </div>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-sliders"></i> Billing &amp; devices</div>
                        <div class="so-plan-fields so-plan-fields--billing">
                            <label>${soFieldLabelHtml('Billing mode', 'plan-billing-mode', idx)}
                                <select data-field="billing_mode" onchange="soMarkTabDirty('config')">
                                    ${SO_BILLING_MODES.map(m => `<option value="${m}" ${plan.billing_mode === m ? 'selected' : ''}>${m}</option>`).join('')}
                                </select>
                            </label>
                            <label><span>Device tier</span>
                                <select data-field="device_tier" onchange="soMarkTabDirty('config')">
                                    ${SO_DEVICE_TIERS.map(t => `<option value="${t}" ${plan.device_tier === t ? 'selected' : ''}>${t}</option>`).join('')}
                                </select>
                            </label>
                            <label><span>Max devices (0 = unlimited)</span><input type="number" min="0" step="1" data-field="max_devices" value="${plan.max_devices != null ? plan.max_devices : 1}" oninput="soMarkTabDirty('config')"></label>
                            <label>${soFieldLabelHtml('Included credits', 'plan-included-credits', idx)}<input type="number" min="0" step="1" data-field="included_credits" value="${plan.included_credits || 0}" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Plan kind</span><input type="text" data-field="plan_kind" value="${soAttr(plan.plan_kind || '')}" placeholder="lifetime, unlimited" oninput="soMarkTabDirty('config')"></label>
                            <label class="so-field-full"><span>Short description (plan detail screen)</span><textarea rows="2" data-field="description" oninput="soMarkTabDirty('config')">${soEsc(plan.description || '')}</textarea></label>
                        </div>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-mobile-screen"></i> Plan detail screen (extension)</div>
                        <p class="so-field-group-hint">Shown when customer taps a plan in the extension popup — no extension update needed when you edit here.</p>
                        <label class="so-field-full"><span>Highlights (one per line — pills on detail screen)</span>
                            <textarea rows="3" data-field="highlights_text" oninput="soMarkTabDirty('config')">${soEsc((plan.highlights || []).join('\n'))}</textarea></label>
                        <label class="so-field-full"><span>Features (one per line — plain text or <code>icon|title|text</code>)</span>
                            <textarea rows="4" data-field="features_text" oninput="soMarkTabDirty('config')">${soEsc(soFormatPlanFeaturesForEditor(plan.features))}</textarea></label>
                        <div class="so-admin-subhead">Detail sections</div>
                        <div class="so-plan-detail-sections" data-plan-detail-sections="${idx}">
                            ${(plan.detail_sections || []).map((sec, sidx) => soRenderPlanDetailSectionRow(sec, idx, sidx)).join('')}
                        </div>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="addSoPlanDetailSection(${idx})">+ Add detail section</button>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-eye"></i> Visibility &amp; badges</div>
                        <p class="so-field-group-hint">Controls what customers see in the extension popup.</p>
                        <div class="so-plan-flags so-plan-flags--simple">
                            <label class="so-plan-check"><input type="checkbox" data-field="active" ${plan.active ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Show in extension</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="best" ${plan.best ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Best value badge</label>
                        </div>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-coins"></i> Credit add-ons (per plan)</div>
                        <p class="so-field-group-hint">Optional extra credit bundles customers can buy with this plan. Extension shows these under the plan card.</p>
                        <div class="so-plan-flags so-plan-flags--simple">
                            ${soCheckboxInfoHtml('Allow credit add-ons', 'plan-allow-addons', 'allow_credit_addons', plan.allow_credit_addons, idx)}
                        </div>
                        <label>${soFieldLabelHtml('Max add-on selections (0 = unlimited)', 'plan-max-addon-selections', idx)}
                            <input type="number" min="0" step="1" data-field="max_addon_selections" value="${plan.max_addon_selections || 0}" oninput="soMarkTabDirty('config')"></label>
                        <div class="so-plan-addon-list">
                            ${(plan.credit_addons || []).map((addon, aidx) => soRenderPlanCreditAddonRowHtml(addon, idx, aidx)).join('')}
                        </div>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="addSoPlanCreditAddon(${idx})">+ Add credit add-on</button>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-infinity"></i> Unlimited overrides</div>
                        <p class="so-field-group-hint">Optional — only for lifetime / unlimited / enterprise plans.</p>
                        <div class="so-plan-flags so-plan-flags--simple">
                            ${soCheckboxInfoHtml('Never expires', 'plan-unlimited-time', 'unlimited_time', plan.unlimited_time, idx)}
                            ${soCheckboxInfoHtml('Unlimited devices', 'plan-unlimited-devices', 'unlimited_devices', plan.unlimited_devices, idx)}
                            ${soCheckboxInfoHtml('Unlimited credits', 'plan-unlimited-credits', 'unlimited_credits', plan.unlimited_credits, idx)}
                        </div>
                    </div>
                    <div class="so-plan-actions-bar">
                        <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="removeSoPlan(${idx})"><i class="fa fa-trash"></i> Remove plan</button>
                    </div>
                </div>
            </div>`;
        }).join('');
        renderSoExtensionPreview();
    }

    function soReadPlansFromDom() {
        const container = document.getElementById('so-plans-editor');
        if (!container) return [];
        const rows = container.querySelectorAll('.so-pricing-plan-row');
        const plans = [];
        rows.forEach((row, idx) => {
            const get = (field) => {
                const el = row.querySelector(`[data-field="${field}"]`);
                if (!el) return '';
                if (el.type === 'checkbox') return el.checked;
                return el.value;
            };
            plans.push(soNormalizePlan({
                id: get('id'),
                name: get('name'),
                price: get('price'),
                days: get('days'),
                duration: get('duration'),
                save: get('save'),
                plan_kind: get('plan_kind'),
                description: get('description'),
                highlights: soParsePlanFeaturesText(get('highlights_text')),
                features: soParsePlanFeaturesFromText(get('features_text')),
                detail_sections: soParsePlanDetailSectionsFromDom(row),
                device_tier: get('device_tier'),
                max_devices: get('max_devices'),
                billing_mode: get('billing_mode'),
                included_credits: get('included_credits'),
                allow_credit_addons: get('allow_credit_addons'),
                max_addon_selections: get('max_addon_selections'),
                credit_addons: soReadPlanCreditAddonsFromRow(row),
                unlimited_time: get('unlimited_time'),
                unlimited_devices: get('unlimited_devices'),
                unlimited_credits: get('unlimited_credits'),
                active: get('active'),
                best: get('best'),
                order: idx
            }, idx));
        });
        return plans;
    }

    window.addSoPlanCreditAddon = function(planIdx) {
        soPlans = soReadPlansFromDom();
        const plan = soPlans[planIdx];
        if (!plan) return;
        if (!Array.isArray(plan.credit_addons)) plan.credit_addons = [];
        plan.credit_addons.push(soNormalizeCreditAddon({
            id: `addon_${plan.credit_addons.length + 1}`,
            credits: 25,
            price: 40,
            label: '+25 credits',
            active: true,
            default_selected: false
        }, plan.credit_addons.length));
        plan.allow_credit_addons = true;
        renderSoPlansEditor();
        soMarkTabDirty('config');
    };

    window.removeSoPlanCreditAddon = function(planIdx, addonIdx) {
        soPlans = soReadPlansFromDom();
        const plan = soPlans[planIdx];
        if (!plan || !plan.credit_addons) return;
        plan.credit_addons.splice(addonIdx, 1);
        renderSoPlansEditor();
        soMarkTabDirty('config');
    };

    window.addSoPlanDetailSection = function(planIdx) {
        soPlans = soReadPlansFromDom();
        const plan = soPlans[planIdx];
        if (!plan) return;
        if (!Array.isArray(plan.detail_sections)) plan.detail_sections = [];
        plan.detail_sections.push({ title: 'New section', items: [] });
        renderSoPlansEditor();
        soExpandedPlanIds.add(plan.id);
        soMarkTabDirty('config');
    };

    window.removeSoPlanDetailSection = function(planIdx, secIdx) {
        soPlans = soReadPlansFromDom();
        const plan = soPlans[planIdx];
        if (!plan || !plan.detail_sections) return;
        plan.detail_sections.splice(secIdx, 1);
        renderSoPlansEditor();
        soMarkTabDirty('config');
    };

    window.addSoPlanPreset = function(presetKey) {
        const preset = SO_PLAN_PRESETS[presetKey];
        if (!preset) return soToast('Unknown preset.');
        soPlans = soReadPlansFromDom();
        const existing = soPlans.findIndex(p => p.id === preset.id);
        const normalized = soNormalizePlan(Object.assign({}, preset), soPlans.length);
        if (existing >= 0) {
            soPlans[existing] = normalized;
            soToast(`Updated preset "${preset.name}" in list.`);
        } else {
            normalized.order = soPlans.length;
            soPlans.push(normalized);
            soToast(`Added preset "${preset.name}".`);
        }
        soPlans.forEach((p, i) => { p.order = i; });
        soExpandedPlanIds.add(normalized.id);
        renderSoPlansEditor();
        soMarkTabDirty('config');
        toggleSoSectionAccordion('config-plans');
    };

    window.addSoPlan = function() {
        soPlans = soReadPlansFromDom();
        const nextOrder = soPlans.length;
        const newPlan = soNormalizePlan({
            id: `plan_${nextOrder + 1}`,
            name: 'New Plan',
            price: 499,
            days: 30,
            duration: '1 Month',
            device_tier: 'standard',
            max_devices: 1,
            billing_mode: 'subscription',
            included_credits: 0,
            active: true,
            order: nextOrder
        }, nextOrder);
        soPlans.push(newPlan);
        soExpandedPlanIds.add(newPlan.id);
        renderSoPlansEditor();
        soMarkTabDirty('config');
        soToast('New plan added — tap row to edit fields.');
    };

    window.moveSoPlan = function(idx, dir) {
        soPlans = soReadPlansFromDom();
        const next = idx + dir;
        if (next < 0 || next >= soPlans.length) return;
        const tmp = soPlans[idx];
        soPlans[idx] = soPlans[next];
        soPlans[next] = tmp;
        soPlans.forEach((p, i) => { p.order = i; });
        renderSoPlansEditor();
        soMarkTabDirty('config');
    };

    window.removeSoPlan = async function(idx) {
        soPlans = soReadPlansFromDom();
        const plan = soPlans[idx];
        if (!plan) return;
        if (soPlanInUse(plan.id)) {
            return soToast(`Plan "${plan.id}" is used by licenses. Set Show unchecked (active:false) instead of removing.`);
        }
        if (!confirm('Remove this plan from the config?')) return;
        soPlans.splice(idx, 1);
        soPlans.forEach((p, i) => { p.order = i; });
        renderSoPlansEditor();
        soMarkTabDirty('config');
    };

    function soSyncInlineDemoRowsFromObject() {
        soInlineDemoKeyRows = Object.keys(soInlineDemoKeys || {}).map(key => {
            const entry = soNormalizeDemoKeyEntry(soInlineDemoKeys[key] || {});
            return Object.assign({ key }, entry);
        });
    }

    function soReadInlineDemoRowsFromDom() {
        const container = document.getElementById('so-inline-demo-keys');
        if (!container) return soInlineDemoKeyRows.slice();
        const rows = container.querySelectorAll('.so-inline-demo-row');
        if (!rows.length) return soInlineDemoKeyRows.slice();
        return Array.from(rows).map(soReadDemoKeyRowFromEl);
    }

    function soPreserveInlineDemoRowsFromDom() {
        const container = document.getElementById('so-inline-demo-keys');
        if (container && container.querySelector('.so-inline-demo-row')) {
            soInlineDemoKeyRows = soReadInlineDemoRowsFromDom();
        }
    }

    function soReadInlineDemoKeysFromDom() {
        const rows = soReadInlineDemoRowsFromDom();
        const out = {};
        const seen = new Set();
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const key = row.key;
            if (!key) continue;
            if (key.length < 6) {
                throw new Error(`Demo key row #${i + 1}: key must be at least 6 characters.`);
            }
            if (seen.has(key)) {
                throw new Error(`Duplicate demo key "${key}".`);
            }
            seen.add(key);
            out[key] = soDemoKeyEntryToInlineMap(row);
        }
        return out;
    }

    function renderSoInlineDemoKeysEditor() {
        const container = document.getElementById('so-inline-demo-keys');
        const countEl = document.getElementById('so-inline-demo-count');
        if (!container) return;
        if (countEl) {
            const n = soInlineDemoKeyRows.length;
            countEl.textContent = n === 1 ? '1 key' : `${n} keys`;
        }
        if (!soInlineDemoKeyRows.length) {
            container.innerHTML = '<p class="so-admin-muted">No inline demo keys yet. Tap + Add demo key below.</p>';
            return;
        }
        container.innerHTML = soInlineDemoKeyRows.map((row, idx) =>
            soRenderDemoKeyRowHtml(row, idx, { dirtyFn: "soMarkTabDirty('config')" })
        ).join('');
    }

    window.addSoInlineDemoKeyRow = function() {
        soPreserveInlineDemoRowsFromDom();
        soInlineDemoKeyRows.push({ key: '', days: 30, label: '' });
        renderSoInlineDemoKeysEditor();
        soMarkTabDirty('config');
        const section = document.querySelector('.so-section-accordion[data-so-section="config-demo-inline"]');
        if (section) {
            section.classList.add('so-section-accordion--open');
            soOpenSections.add('config-demo-inline');
        }
        soToast('New row added — fill key, days, label, then Save.');
    };

    window.removeSoInlineDemoKeyRow = function(idx) {
        if (!confirm('Remove this demo key row?')) return;
        soPreserveInlineDemoRowsFromDom();
        soInlineDemoKeyRows.splice(idx, 1);
        renderSoInlineDemoKeysEditor();
        soMarkTabDirty('config');
    };

    window.addSoInlineDemoKey = function() {
        addSoInlineDemoKeyRow();
    };

    window.removeSoInlineDemoKey = function(key) {
        soInlineDemoKeyRows = soInlineDemoKeyRows.filter(r => r.key !== key);
        renderSoInlineDemoKeysEditor();
        soMarkTabDirty('config');
    };

    window.saveShippingOptimizerSupport = async function() {
        if (!soRequireExtensionWrite()) return;
        try {
            const supportPayload = soSupportToFirestore(soReadSupportFromDom());
            await soPersistConfigPatch({ support: supportPayload }, 'Support team saved.');
            soSupport = soNormalizeSupport(supportPayload);
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerConfig = async function() {
        if (!soRequireExtensionWrite()) return;
        soPreserveInlineDemoRowsFromDom();
        soPlans = soReadPlansFromDom();
        const err = soValidatePlans(soPlans);
        if (err) return soToast(err);

        let general;
        let demoKeysPayload;
        try {
            general = soReadGeneralConfigFromDom();
            demoKeysPayload = soReadInlineDemoKeysFromDom();
        } catch (e) {
            return soToast(e.message || 'Invalid config.');
        }

        const payload = Object.assign({}, general, {
            plans: soPlans.map((p, i) => soPlanToFirestore(p, i)),
            demo_keys: demoKeysPayload,
            support: soSupportToFirestore(soReadSupportFromDom())
        });

        try {
            await soPersistConfigPatch(payload, 'Config, plans & demo keys saved to Firebase.', { fullConfig: true });
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerCredits = async function() {
        if (!soRequireExtensionWrite()) return;
        soCreditPacks = soReadCreditPacksFromDom();
        const packErr = soValidateCreditPacks(soCreditPacks);
        if (packErr) return soToast(packErr);

        const creditsPayload = {
            enabled: !!document.getElementById('so-credits-enabled')?.checked,
            price_per_credit: Math.max(0, parseInt(document.getElementById('so-credits-price-per')?.value, 10) || DEFAULT_CREDITS.price_per_credit),
            min_purchase: Math.max(1, parseInt(document.getElementById('so-credits-min-purchase')?.value, 10) || DEFAULT_CREDITS.min_purchase),
            cost_per_operation: Math.max(1, parseInt(document.getElementById('so-credits-cost-op')?.value, 10) || DEFAULT_CREDITS.cost_per_operation),
            image_generation: soReadImageGenerationFromDom(),
            packs: soCreditPacks.map((p, i) => ({
                id: p.id,
                credits: p.credits,
                price: p.price,
                label: p.label,
                active: p.active !== false,
                order: i
            }))
        };

        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                credits: creditsPayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }, { merge: true });
            soCredits = creditsPayload;
            soConfig = Object.assign({}, soConfig, { credits: creditsPayload });
            soTabSnapshots.credits = soSerializeCreditsTabState();
            soRecomputeDirtyState();
            if (!soDirtyTabs.config && !soDirtyTabs.credits) soClearDraftStorage();
            else soWriteDraftToStorage();
            soToast('Credits & packs saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    function soSyncDemoEditRowsFromCollection() {
        soDemoKeyEditRows = soDemoKeys.map(d => {
            const entry = soNormalizeDemoKeyEntry(d);
            return Object.assign({ key: d.key }, entry);
        });
    }

    function soPreserveDemoPendingRowsFromDom() {
        const container = document.getElementById('so-demo-pending-keys');
        if (container && container.querySelector('.so-inline-demo-row')) {
            soDemoKeyPendingRows = Array.from(container.querySelectorAll('.so-inline-demo-row')).map(soReadDemoKeyRowFromEl);
        }
    }

    function soPreserveDemoEditRowsFromDom() {
        const container = document.getElementById('so-demo-edit-keys');
        if (container && container.querySelector('.so-demo-edit-row')) {
            soDemoKeyEditRows = Array.from(container.querySelectorAll('.so-demo-edit-row')).map(soReadDemoKeyRowFromEl);
        }
    }

    function renderSoDemoPendingKeysEditor() {
        const container = document.getElementById('so-demo-pending-keys');
        const countEl = document.getElementById('so-demo-pending-count');
        if (!container) return;
        if (countEl) {
            const n = soDemoKeyPendingRows.length;
            countEl.textContent = n === 1 ? '1 new key' : `${n} new keys`;
        }
        if (!soDemoKeyPendingRows.length) {
            container.innerHTML = '<p class="so-admin-muted">No pending keys. Tap + Add demo key to create rows, then Save new keys.</p>';
            return;
        }
        container.innerHTML = soDemoKeyPendingRows.map((row, idx) =>
            soRenderDemoKeyRowHtml(row, idx, {
                rowClass: 'so-inline-demo-row',
                removeFn: `removeSoDemoKeyPendingRow(${idx})`,
                removeLabel: 'Remove row'
            })
        ).join('');
    }

    function renderSoDemoEditKeysEditor() {
        const container = document.getElementById('so-demo-edit-keys');
        const countEl = document.getElementById('so-demo-edit-count');
        if (!container) return;
        if (countEl) {
            const n = soDemoKeyEditRows.length;
            countEl.textContent = n === 1 ? '1 key' : `${n} keys`;
        }
        const q = String(document.getElementById('so-demo-search')?.value || '').trim().toLowerCase();
        const filtered = soDemoKeyEditRows.filter(row => {
            if (!q) return true;
            return row.key.toLowerCase().includes(q) || String(row.label || '').toLowerCase().includes(q);
        });
        if (!filtered.length) {
            container.innerHTML = '<p class="so-admin-muted">No demo keys in collection yet.</p>';
            return;
        }
        container.innerHTML = filtered.map((row, idx) => {
            const realIdx = soDemoKeyEditRows.findIndex(r => r.key === row.key);
            return soRenderDemoKeyRowHtml(row, realIdx >= 0 ? realIdx : idx, {
                rowClass: 'so-inline-demo-row so-demo-edit-row',
                keyReadonly: true,
                showActive: true,
                showSelect: true,
                removeFn: `deleteSoDemoKey('${soAttr(row.key)}')`,
                removeLabel: 'Delete'
            });
        }).join('');
    }

    function renderSoDemoKeysList() {
        renderSoDemoEditKeysEditor();
    }

    window.filterSoDemoKeys = function() {
        renderSoDemoKeysList();
    };

    window.addSoDemoKeyPendingRow = function() {
        soPreserveDemoPendingRowsFromDom();
        soDemoKeyPendingRows.push({ key: '', days: 30, label: '', unlimited_time: false, active: true });
        renderSoDemoPendingKeysEditor();
        const section = document.querySelector('.so-section-accordion[data-so-section="demo-add"]');
        if (section) {
            section.classList.add('so-section-accordion--open');
            soOpenSections.add('demo-add');
        }
        soToast('New row added — fill key, days/unlimited, label, then Save new keys.');
    };

    window.removeSoDemoKeyPendingRow = function(idx) {
        soPreserveDemoPendingRowsFromDom();
        soDemoKeyPendingRows.splice(idx, 1);
        renderSoDemoPendingKeysEditor();
    };

    window.addSoDemoKey = function() {
        addSoDemoKeyPendingRow();
    };

    window.toggleSoDemoKeySelect = function(key, checked) {
        if (checked) soDemoSelectedKeys.add(key);
        else soDemoSelectedKeys.delete(key);
        const selectAll = document.getElementById('so-demo-select-all');
        if (selectAll && soDemoKeyEditRows.length) {
            selectAll.checked = soDemoSelectedKeys.size === soDemoKeyEditRows.length;
        }
    };

    window.toggleSoDemoSelectAll = function() {
        const checked = !!document.getElementById('so-demo-select-all')?.checked;
        soDemoSelectedKeys = new Set();
        if (checked) {
            soDemoKeyEditRows.forEach(r => { if (r.key) soDemoSelectedKeys.add(r.key); });
        }
        renderSoDemoEditKeysEditor();
    };

    window.saveSoDemoKeysBatch = async function() {
        if (!soRequireExtensionWrite()) return;
        soPreserveDemoPendingRowsFromDom();
        if (!soDemoKeyPendingRows.length) return soToast('Add at least one demo key row first.');

        const toWrite = [];
        const seen = new Set();
        for (let i = 0; i < soDemoKeyPendingRows.length; i++) {
            const row = soDemoKeyPendingRows[i];
            const key = row.key;
            if (!key) return soToast(`Row #${i + 1}: enter a demo key.`);
            if (key.length < 6) return soToast(`Row #${i + 1}: key must be at least 6 characters.`);
            if (seen.has(key)) return soToast(`Duplicate key "${key}" in pending rows.`);
            seen.add(key);
            if (await soKeyExists(key)) return soToast(`Key "${key}" already exists (inline or collection).`);
            toWrite.push({ key, payload: soDemoKeyEntryToFirestore(row) });
        }

        try {
            const batch = soDb().batch();
            toWrite.forEach(item => {
                const ref = soDb().collection(SO_DEMO_COL).doc(item.key);
                batch.set(ref, Object.assign({}, item.payload, {
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }));
            });
            await batch.commit();
            soDemoKeyPendingRows = [];
            renderSoDemoPendingKeysEditor();
            await soLoadDemoKeys();
            renderSoDemoKeysList();
            soToast(`${toWrite.length} demo key(s) added to Firebase.`);
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveSoDemoKeysChanges = async function() {
        if (!soRequireExtensionWrite()) return;
        soPreserveDemoEditRowsFromDom();
        if (!soDemoKeyEditRows.length) return soToast('No demo keys to save.');

        try {
            const batch = soDb().batch();
            soDemoKeyEditRows.forEach(row => {
                if (!row.key) return;
                const ref = soDb().collection(SO_DEMO_COL).doc(row.key);
                batch.set(ref, Object.assign({}, soDemoKeyEntryToFirestore(row), {
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: soAuthEmail()
                }), { merge: true });
            });
            await batch.commit();
            await soLoadDemoKeys();
            renderSoDemoKeysList();
            soToast('Demo key changes saved.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.deleteSelectedSoDemoKeys = async function() {
        if (!soRequireExtensionWrite()) return;
        if (!soDemoSelectedKeys.size) return soToast('Select keys to delete.');
        if (!confirm(`Delete ${soDemoSelectedKeys.size} selected demo key(s)?`)) return;
        try {
            const batch = soDb().batch();
            soDemoSelectedKeys.forEach(key => {
                batch.delete(soDb().collection(SO_DEMO_COL).doc(key));
            });
            await batch.commit();
            soDemoSelectedKeys = new Set();
            await soLoadDemoKeys();
            renderSoDemoKeysList();
            soToast('Selected demo keys deleted.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.toggleSoDemoKey = async function(key, currentlyActive) {
        if (!soRequireExtensionWrite()) return;
        try {
            await soDb().collection(SO_DEMO_COL).doc(key).set({ active: !currentlyActive }, { merge: true });
            await soLoadDemoKeys();
            renderSoDemoKeysList();
            soToast(currentlyActive ? 'Demo key disabled.' : 'Demo key enabled.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.deleteSoDemoKey = async function(key) {
        if (!soRequireExtensionWrite()) return;
        if (!confirm(`Delete demo key ${key}?`)) return;
        try {
            await soDb().collection(SO_DEMO_COL).doc(key).delete();
            soDemoSelectedKeys.delete(key);
            await soLoadDemoKeys();
            renderSoDemoKeysList();
            soToast('Demo key deleted.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    function soGetAllPlansForSelect() {
        return soSortPlans(soPlans.length ? soPlans : DEFAULT_PLANS);
    }

    function soGetActivePlansForSelect() {
        return soGetAllPlansForSelect().filter(p => p.active !== false);
    }

    function soPopulateLicensePlanSelect() {
        const sel = document.getElementById('so-license-plan');
        if (!sel) return;
        const plans = soGetAllPlansForSelect();
        sel.innerHTML = plans.map(p => {
            const inactive = p.active === false ? ' [hidden]' : '';
            const daysLabel = p.unlimited_time ? '∞' : `${p.days}d`;
            return `<option value="${soAttr(p.id)}" data-days="${p.days}">${soEsc(p.name)} — ₹${p.price} (${daysLabel})${inactive}</option>`;
        }).join('');
        soUpdateLicensePlanHint();
    }

    function soSetLicenseFormMode(editingKey) {
        soEditingLicenseKey = editingKey || null;
        const btn = document.querySelector('#so-tab-licenses .so-btn-save');
        if (btn) {
            btn.textContent = soEditingLicenseKey ? 'Update license' : 'Create license';
            btn.onclick = soEditingLicenseKey ? () => updateSoLicense() : () => createSoLicense();
        }
        const titleEl = document.getElementById('so-license-form-title');
        if (titleEl) titleEl.textContent = soEditingLicenseKey ? `Edit license ${soEditingLicenseKey}` : 'Create license';
        const cancelBtn = document.getElementById('so-license-cancel-edit');
        if (cancelBtn) cancelBtn.style.display = soEditingLicenseKey ? 'block' : 'none';
        const keyEl = document.getElementById('so-license-key-input');
        if (keyEl) keyEl.readOnly = !!soEditingLicenseKey;
    }

    function soReadLicenseFormFields() {
        const billingMode = String(document.getElementById('so-license-billing-mode')?.value || 'subscription').trim();
        const maxDevicesRaw = document.getElementById('so-license-max-devices')?.value;
        let maxDevices = null;
        if (maxDevicesRaw !== '' && maxDevicesRaw != null) {
            maxDevices = Math.max(0, parseInt(maxDevicesRaw, 10));
            if (!Number.isFinite(maxDevices)) maxDevices = 1;
        }
        return {
            billing_mode: SO_BILLING_MODES.includes(billingMode) ? billingMode : 'subscription',
            max_devices: maxDevices,
            credits_balance: Math.max(0, parseInt(document.getElementById('so-license-credits-balance')?.value, 10) || 0),
            credits_used: Math.max(0, parseInt(document.getElementById('so-license-credits-used')?.value, 10) || 0),
            unlimited_time: !!document.getElementById('so-license-unlimited-time')?.checked,
            unlimited_devices: !!document.getElementById('so-license-unlimited-devices')?.checked,
            unlimited_credits: !!document.getElementById('so-license-unlimited-credits')?.checked,
            addon_credit_ids: soReadSelectedLicenseAddonIds()
        };
    }

    function soBuildLicenseCreditFields(plan, formFields) {
        const selectedIds = formFields.addon_credit_ids || [];
        const calc = plan ? soCalculatePlanCredits(plan, selectedIds) : { included: 0, addon: 0, total: formFields.credits_balance };
        const out = {
            included_credits: calc.included,
            addon_credits: calc.addon,
            addon_credit_ids: selectedIds
        };
        if (!soIsUnlimitedCredits(plan) && !soIsUnlimitedCredits(formFields)) {
            out.credits_balance = formFields.credits_balance != null ? formFields.credits_balance : calc.total;
        }
        return out;
    }

    function soSetLicenseUnlimitedCheckboxes(licOrPlan) {
        const src = licOrPlan || {};
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };
        set('so-license-unlimited-time', src.unlimited_time || soIsUnlimitedTime(src));
        set('so-license-unlimited-devices', src.unlimited_devices || soIsUnlimitedDevices(src));
        set('so-license-unlimited-credits', src.unlimited_credits || soIsUnlimitedCredits(src));
    }

    function soApplyPlanDefaultsToLicenseForm(plan) {
        if (!plan) return;
        const billingEl = document.getElementById('so-license-billing-mode');
        if (billingEl && plan.billing_mode) billingEl.value = plan.billing_mode;
        const maxEl = document.getElementById('so-license-max-devices');
        if (maxEl) maxEl.value = plan.max_devices != null ? plan.max_devices : '';
        const balEl = document.getElementById('so-license-credits-balance');
        if (balEl) {
            if (plan.billing_mode === 'credits') {
                balEl.value = plan.included_credits > 0 ? plan.included_credits : 50;
            } else if (plan.billing_mode === 'hybrid' && plan.included_credits > 0) {
                balEl.value = plan.included_credits;
            } else if (plan.included_credits > 0) {
                balEl.value = plan.included_credits;
            }
        }
        soSetLicenseUnlimitedCheckboxes(plan);
        const preselected = (plan.credit_addons || []).filter(a => a.default_selected).map(a => a.id);
        soRenderLicenseAddonPicks(plan, preselected);
    }

    window.soUpdateLicensePlanHint = function() {
        const sel = document.getElementById('so-license-plan');
        const hint = document.getElementById('so-license-plan-hint');
        if (!sel || !hint) return;
        const planId = sel.value;
        const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
        const unlimitedTime = plan ? soIsUnlimitedTime(plan) : false;
        const days = plan ? plan.days : (parseInt(sel.options[sel.selectedIndex]?.getAttribute('data-days'), 10) || 30);
        const tier = plan ? (plan.device_tier || 'standard') : 'standard';
        const maxDev = plan ? (soIsUnlimitedDevices(plan) ? 'Unlimited' : (plan.max_devices || 1)) : 1;
        const billing = plan ? (plan.billing_mode || 'subscription') : 'subscription';
        hint.textContent = unlimitedTime
            ? `Unlimited — no expiry · tier ${tier} · max ${maxDev} device(s) · billing ${billing}.`
            : `Expiry starts on activation: ${days} days · tier ${tier} · max ${maxDev} device(s) · billing ${billing}.`;
        if (!soEditingLicenseKey) {
            soApplyPlanDefaultsToLicenseForm(plan);
        }
    };

    window.cancelSoLicenseEdit = function() {
        soSetLicenseFormMode(null);
        document.getElementById('so-license-key-input').value = '';
        document.getElementById('so-license-customer-name').value = '';
        document.getElementById('so-license-customer-phone').value = '';
        document.getElementById('so-license-customer-email').value = '';
        document.getElementById('so-license-support-notes').value = '';
        document.getElementById('so-license-max-devices').value = '';
        document.getElementById('so-license-credits-balance').value = '0';
        document.getElementById('so-license-credits-used').value = '0';
        document.getElementById('so-license-billing-mode').value = 'subscription';
        soSetLicenseUnlimitedCheckboxes({});
        soRenderLicenseAddonPicks(null, []);
        soUpdateLicensePlanHint();
    };

    window.editSoLicense = function(key) {
        const lic = soLicenses.find(l => l.key === key);
        if (!lic) return soToast('License not found.');
        soSetLicenseFormMode(key);
        document.getElementById('so-license-key-input').value = lic.key;
        const planSel = document.getElementById('so-license-plan');
        if (planSel && (lic.planId || lic.planType)) planSel.value = lic.planId || lic.planType;
        document.getElementById('so-license-billing-mode').value = lic.billing_mode || 'subscription';
        document.getElementById('so-license-max-devices').value = lic.max_devices != null ? lic.max_devices : '';
        document.getElementById('so-license-credits-balance').value = lic.credits_balance != null ? lic.credits_balance : 0;
        document.getElementById('so-license-credits-used').value = lic.credits_used != null ? lic.credits_used : 0;
        soSetLicenseUnlimitedCheckboxes(lic);
        const addonIds = Array.isArray(lic.addon_credit_ids) ? lic.addon_credit_ids
            : (Array.isArray(lic.addonCreditIds) ? lic.addonCreditIds : []);
        const plan = soPlans.find(p => p.id === (lic.planId || lic.planType));
        soRenderLicenseAddonPicks(plan, addonIds);
        document.getElementById('so-license-customer-name').value = lic.customer_name || '';
        document.getElementById('so-license-customer-phone').value = lic.customer_phone || '';
        document.getElementById('so-license-customer-email').value = lic.customer_email || '';
        document.getElementById('so-license-support-notes').value = lic.support_notes || '';
        soUpdateLicensePlanHint();
        switchShippingOptimizerTab('licenses');
        toggleSoSectionAccordion('license-create');
        document.getElementById('so-license-key-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        soToast(`Editing ${key} — update fields and tap Update license.`);
    };

    window.generateSoLicenseKey = async function() {
        if (!soRequireSuperAdmin()) return;
        try {
            await soLoadConfig();
            const key = await soGenerateUniqueLicenseKey();
            const el = document.getElementById('so-license-key-input');
            if (el) el.value = key;
            soToast('Unique key generated.');
        } catch (e) {
            soToast(e.message || 'Generation failed.');
        }
    };

    window.createSoLicense = async function() {
        if (!soRequireExtensionWrite()) return;
        const key = String(document.getElementById('so-license-key-input')?.value || '').trim().toUpperCase();
        const planId = String(document.getElementById('so-license-plan')?.value || '').trim();
        if (!/^MEESHO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
            return soToast('License key must match MEESHO-XXXX-XXXX-XXXX.');
        }
        if (await soKeyExists(key)) return soToast('Key already exists.');
        const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
        if (!plan) return soToast('Select a valid plan.');
        const formFields = soReadLicenseFormFields();
        let maxDevices = formFields.max_devices;
        if (maxDevices == null) {
            maxDevices = soIsUnlimitedDevices(plan) ? 0 : (plan.max_devices != null ? plan.max_devices : (SO_DEVICE_TIER_MAX[plan.device_tier] != null ? SO_DEVICE_TIER_MAX[plan.device_tier] : 1));
        }
        if (formFields.unlimited_devices) maxDevices = 0;
        const payload = Object.assign({
            active: true,
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
            billing_mode: formFields.billing_mode || plan.billing_mode || 'subscription',
            max_devices: maxDevices,
            credits_used: formFields.credits_used,
            unlimited_time: formFields.unlimited_time || soIsUnlimitedTime(plan),
            unlimited_devices: formFields.unlimited_devices || soIsUnlimitedDevices(plan),
            unlimited_credits: formFields.unlimited_credits || soIsUnlimitedCredits(plan),
            device_ids: [],
            expiry_starts_on_activation: true,
            expiresAt: '',
            machineId: '',
            activatedAt: '',
            images_generated_total: 0,
            images_generated_today: 0,
            images_generated_today_date: '',
            images_generated_month: 0,
            images_generated_month_key: '',
            customer_name: String(document.getElementById('so-license-customer-name')?.value || '').trim(),
            customer_phone: String(document.getElementById('so-license-customer-phone')?.value || '').replace(/\D/g, ''),
            customer_email: String(document.getElementById('so-license-customer-email')?.value || '').trim(),
            support_notes: String(document.getElementById('so-license-support-notes')?.value || '').trim(),
            issued_at: firebase.firestore.FieldValue.serverTimestamp(),
            shared_at: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: soAuthEmail()
        }, soBuildLicenseCreditFields(plan, formFields));
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set(payload);
            cancelSoLicenseEdit();
            await soLoadLicenses();
            renderSoLicensesList();
            renderSoCustomerRegistry();
            soToast(`License ${key} created. Send to customer on WhatsApp.`);
        } catch (e) {
            soToast('Create failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.updateSoLicense = async function() {
        if (!soRequireExtensionWrite()) return;
        const key = soEditingLicenseKey;
        if (!key) return createSoLicense();
        const planId = String(document.getElementById('so-license-plan')?.value || '').trim();
        const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
        if (!plan) return soToast('Select a valid plan.');
        const formFields = soReadLicenseFormFields();
        let maxDevices = formFields.max_devices;
        if (maxDevices == null) {
            maxDevices = soIsUnlimitedDevices(plan) ? 0 : (plan.max_devices != null ? plan.max_devices : 1);
        }
        if (formFields.unlimited_devices) maxDevices = 0;
        const payload = Object.assign({
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
            billing_mode: formFields.billing_mode,
            max_devices: maxDevices,
            credits_used: formFields.credits_used,
            unlimited_time: formFields.unlimited_time,
            unlimited_devices: formFields.unlimited_devices,
            unlimited_credits: formFields.unlimited_credits,
            customer_name: String(document.getElementById('so-license-customer-name')?.value || '').trim(),
            customer_phone: String(document.getElementById('so-license-customer-phone')?.value || '').replace(/\D/g, ''),
            customer_email: String(document.getElementById('so-license-customer-email')?.value || '').trim(),
            support_notes: String(document.getElementById('so-license-support-notes')?.value || '').trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: soAuthEmail()
        }, soBuildLicenseCreditFields(plan, formFields));
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set(payload, { merge: true });
            cancelSoLicenseEdit();
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(`License ${key} updated.`);
        } catch (e) {
            soToast('Update failed: ' + (e.message || 'Unknown error'));
        }
    };

    function soLicenseMatchesFilter(lic, filter) {
        const status = soGetLicenseRegistryStatus(lic);
        switch (filter) {
            case 'active': return status === 'active' || status === 'credits_low';
            case 'expired': return status === 'expired';
            case 'lifetime': return status === 'lifetime';
            case 'credits_low': return status === 'credits_low';
            case 'unused': return status === 'unused' || status === 'unused_shared';
            case 'not_shared': return !soIsLicenseShared(lic) && !soIsLicenseActivated(lic);
            case 'revoked': return status === 'revoked';
            default: return true;
        }
    }

    window.setSoLicenseFilter = function(filter) {
        soLicenseFilter = filter || 'all';
        document.querySelectorAll('[data-so-license-filter]').forEach(btn => {
            btn.classList.toggle('so-tab-chip--active', btn.getAttribute('data-so-license-filter') === soLicenseFilter);
        });
        const sel = document.getElementById('so-license-filter');
        if (sel) sel.value = soLicenseFilter;
        renderSoLicensesList();
    };

    function renderSoLicensesList() {
        const container = document.getElementById('so-licenses-list');
        if (!container) return;
        const q = String(document.getElementById('so-license-search')?.value || '').trim().toLowerCase();
        const filtered = soLicenses.filter(lic => {
            if (!soLicenseMatchesFilter(lic, soLicenseFilter)) return false;
            if (!q) return true;
            const deviceIds = soGetLicenseDeviceIds(lic).join(' ');
            const hay = [lic.key, lic.machineId, deviceIds, lic.planId, lic.planType, lic.billing_mode,
                lic.customer_name, lic.customer_phone, lic.customer_email,
                lic.credits_balance, lic.credits_used, soFormatValidity(lic)]
                .filter(v => v != null && v !== '').join(' ').toLowerCase();
            return hay.includes(q);
        });
        if (!filtered.length) {
            container.innerHTML = '<p class="so-admin-muted">No licenses found.</p>';
            return;
        }
        container.innerHTML = filtered.map(lic => {
            const active = lic.active !== false;
            const deviceIds = soGetLicenseDeviceIds(lic);
            const devicesLabel = soFormatDevicesLabel(lic);
            const activated = soIsLicenseActivated(lic);
            const expired = soIsLicenseExpired(lic);
            const billingMode = lic.billing_mode || 'subscription';
            const creditsLabel = soFormatCreditsLabel(lic);
            const runsToday = parseInt(lic.images_generated_today, 10) || 0;
            const runsMonth = parseInt(lic.images_generated_month, 10) || 0;
            const runsTotal = parseInt(lic.images_generated_total, 10) || 0;
            const validityLabel = soFormatValidity(lic);
            const registryStatus = soGetLicenseRegistryStatus(lic);
            const activatedLabel = activated
                ? `Activated: ${soEsc(soFormatTs(lic.activatedAt))}`
                : 'Not activated yet';
            const sharedLabel = soIsLicenseShared(lic)
                ? `Shared: ${soEsc(soFormatTs(lic.shared_at || lic.sharedAt))}`
                : 'Not shared with customer yet';
            const deviceListHtml = deviceIds.length
                ? `<div class="so-device-list">${deviceIds.map(id =>
                    `<div class="so-device-chip"><code>${soEsc(id)}</code>
                        <button type="button" class="so-btn-icon so-btn-icon--danger" onclick="removeSoLicenseDeviceId('${soAttr(lic.key)}', '${soAttr(id)}')" title="Remove device">✕</button>
                    </div>`
                ).join('')}</div>`
                : '<span class="so-admin-muted">No devices bound</span>';
            const open = soExpandedLicenseKeys.has(lic.key);
            const summaryPhone = lic.customer_phone ? soEsc(lic.customer_phone) : '';
            const summaryName = lic.customer_name ? soEsc(lic.customer_name) : '';
            return `<div class="so-license-row so-collapsible-row ${open ? 'so-collapsible-row--open' : ''}">
                <div class="so-license-head" onclick="toggleSoLicenseRow('${soAttr(lic.key)}')" style="cursor:pointer;">
                    <code>${soEsc(lic.key)}</code>
                    <span class="so-badge ${active ? 'so-badge--on' : 'so-badge--off'}">${active ? 'Active' : 'Revoked'}</span>
                    <span class="so-badge so-badge--meta">${soEsc(soRegistryStatusLabel(registryStatus))}</span>
                    ${expired ? '<span class="so-badge so-badge--off">Expired</span>' : ''}
                    ${soLicenseNeverExpires(lic) ? '<span class="so-badge so-badge--best">Lifetime</span>' : ''}
                    <span class="so-collapsible-toggle"></span>
                </div>
                <div class="so-license-body" onclick="event.stopPropagation()">
                    <div class="so-license-meta so-admin-muted">
                        ${summaryName}${summaryName && summaryPhone ? ' · ' : ''}${summaryPhone}
                        · Plan: ${soEsc(lic.planId || lic.planType || '—')}
                        · Devices: ${soEsc(devicesLabel)}
                        · Credits: ${soEsc(creditsLabel)}
                    </div>
                    <div class="so-license-meta so-admin-muted">
                        Validity: <strong>${soEsc(validityLabel)}</strong>
                        · Runs today: ${runsToday} · this month: ${runsMonth} · total: ${runsTotal}
                    </div>
                    <div class="so-license-meta so-admin-muted">
                        ${activatedLabel} · ${sharedLabel} · ${soEsc(billingMode)}
                    </div>
                    <div class="so-license-meta">${deviceListHtml}</div>
                    ${lic.support_notes ? `<div class="so-license-notes">${soEsc(lic.support_notes)}</div>` : ''}
                    <div class="so-list-actions so-list-actions--grid">
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="editSoLicense('${soAttr(lic.key)}')">Edit</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="openSoLicenseOverrides('${soAttr(lic.key)}')">Overrides</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="addSoLicenseCredits('${soAttr(lic.key)}')">Add credits</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="toggleSoLicenseActive('${soAttr(lic.key)}', ${active})">${active ? 'Revoke' : 'Activate'}</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="resetSoLicenseAllDevices('${soAttr(lic.key)}')" ${deviceIds.length ? '' : 'disabled'}>Reset devices</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="resetSoLicenseTodayRuns('${soAttr(lic.key)}')">Reset today's runs</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="resetSoLicenseImageCounts('${soAttr(lic.key)}')">Reset all run counts</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="markSoLicenseShared('${soAttr(lic.key)}')" ${soIsLicenseShared(lic) ? 'disabled' : ''}>Mark shared</button>
                        <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="deleteSoLicense('${soAttr(lic.key)}')">Delete</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    window.filterSoLicenses = function() {
        renderSoLicensesList();
    };

    window.toggleSoLicenseActive = async function(key, currentlyActive) {
        if (!soRequireExtensionWrite()) return;
        if (currentlyActive) {
            if (!confirm(`Revoke license ${key}? Extension will reject this key.`)) return;
        }
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({ active: !currentlyActive }, { merge: true });
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(currentlyActive ? 'License revoked.' : 'License activated.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.resetSoLicenseDevice = async function(key) {
        return resetSoLicenseAllDevices(key);
    };

    window.resetSoLicenseAllDevices = async function(key) {
        if (!soRequireExtensionWrite()) return;
        if (!confirm(`Reset all device bindings for ${key}? Customer can activate on new device(s).`)) return;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({
                machineId: '',
                device_ids: [],
                activatedAt: ''
            }, { merge: true });
            await soLoadLicenses();
            renderSoLicensesList();
            soToast('All devices reset.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.resetSoLicenseTodayRuns = async function(key) {
        if (!soRequireExtensionWrite()) return;
        if (!confirm(`Reset today's generation runs for ${key}? Monthly/total counters stay unchanged.`)) return;
        const today = new Date().toISOString().slice(0, 10);
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({
                images_generated_today: 0,
                images_generated_today_date: today
            }, { merge: true });
            await soLoadLicenses();
            renderSoLicensesList();
            renderSoCustomerRegistry();
            soToast("Today's run count reset.");
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.resetSoLicenseImageCounts = async function(key) {
        if (!soRequireExtensionWrite()) return;
        if (!confirm(`Reset all generation run counters for ${key}? Usage history will be cleared.`)) return;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({
                images_generated_total: 0,
                images_generated_today: 0,
                images_generated_today_date: '',
                images_generated_month: 0,
                images_generated_month_key: ''
            }, { merge: true });
            await soLoadLicenses();
            renderSoLicensesList();
            renderSoCustomerRegistry();
            soToast('Generation run counts reset.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.removeSoLicenseDeviceId = async function(key, deviceId) {
        if (!soRequireExtensionWrite()) return;
        const lic = soLicenses.find(l => l.key === key);
        if (!lic) return soToast('License not found.');
        if (!confirm(`Remove device ${deviceId} from ${key}?`)) return;
        const ids = soGetLicenseDeviceIds(lic).filter(id => id !== deviceId);
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({
                device_ids: ids,
                machineId: ids[0] || ''
            }, { merge: true });
            await soLoadLicenses();
            renderSoLicensesList();
            soToast('Device removed.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.addSoLicenseCredits = function(key) {
        if (!soRequireSuperAdmin()) return;
        const lic = soLicenses.find(l => l.key === key);
        if (!lic) return soToast('License not found.');
        soAddCreditsLicenseKey = key;
        const label = document.getElementById('so-add-credits-key-label');
        const balLabel = document.getElementById('so-add-credits-balance-label');
        if (label) label.textContent = `License: ${key}`;
        if (balLabel) balLabel.textContent = `Current balance: ${parseInt(lic.credits_balance, 10) || 0} credits`;
        const amountEl = document.getElementById('so-add-credits-amount');
        if (amountEl) amountEl.value = '';
        const activePacks = soSortCreditPacks(soCreditPacks.length ? soCreditPacks : DEFAULT_CREDIT_PACKS)
            .filter(p => p.active !== false);
        const packsEl = document.getElementById('so-add-credits-packs');
        if (packsEl) {
            packsEl.innerHTML = activePacks.length
                ? activePacks.map(p =>
                    `<button type="button" class="so-pack-quick-btn" onclick="soSelectAddCreditsPack(${p.credits})">${soEsc(p.label || p.id)}<br><span class="so-admin-muted">+${p.credits} · ₹${p.price}</span></button>`
                ).join('')
                : '<p class="so-admin-muted">No packs configured — enter custom amount below.</p>';
        }
        const modal = document.getElementById('so-add-credits-modal');
        if (modal) modal.style.display = 'flex';
    };

    window.soSelectAddCreditsPack = function(credits) {
        const el = document.getElementById('so-add-credits-amount');
        if (el) el.value = credits;
    };

    window.closeSoAddCreditsModal = function() {
        soAddCreditsLicenseKey = null;
        const modal = document.getElementById('so-add-credits-modal');
        if (modal) modal.style.display = 'none';
    };

    window.confirmSoAddCredits = async function() {
        if (!soRequireExtensionWrite()) return;
        const key = soAddCreditsLicenseKey;
        if (!key) return;
        const lic = soLicenses.find(l => l.key === key);
        if (!lic) return soToast('License not found.');
        const addCredits = parseInt(document.getElementById('so-add-credits-amount')?.value, 10);
        if (!Number.isFinite(addCredits) || addCredits < 1) {
            return soToast('Enter credits to add (minimum 1).');
        }
        const current = parseInt(lic.credits_balance, 10) || 0;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({
                credits_balance: current + addCredits
            }, { merge: true });
            closeSoAddCreditsModal();
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(`Added ${addCredits} credits. New balance: ${current + addCredits}.`);
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.openSoLicenseOverrides = function(key) {
        const lic = soLicenses.find(l => l.key === key);
        if (!lic) return soToast('License not found.');
        soOverridesLicenseKey = key;
        const label = document.getElementById('so-overrides-key-label');
        if (label) label.textContent = `License: ${key}`;
        document.getElementById('so-overrides-billing-mode').value = lic.billing_mode || 'subscription';
        document.getElementById('so-overrides-max-devices').value = lic.max_devices != null ? lic.max_devices : '';
        document.getElementById('so-overrides-unlimited-time').checked = soIsUnlimitedTime(lic);
        document.getElementById('so-overrides-unlimited-devices').checked = soIsUnlimitedDevices(lic);
        document.getElementById('so-overrides-unlimited-credits').checked = soIsUnlimitedCredits(lic);
        const modal = document.getElementById('so-license-overrides-modal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeSoLicenseOverrides = function() {
        soOverridesLicenseKey = null;
        const modal = document.getElementById('so-license-overrides-modal');
        if (modal) modal.style.display = 'none';
    };

    window.saveSoLicenseOverrides = async function() {
        if (!soRequireExtensionWrite()) return;
        const key = soOverridesLicenseKey;
        if (!key) return;
        let maxDevices = document.getElementById('so-overrides-max-devices')?.value;
        maxDevices = maxDevices === '' || maxDevices == null
            ? null
            : Math.max(0, parseInt(maxDevices, 10));
        const payload = {
            billing_mode: document.getElementById('so-overrides-billing-mode')?.value || 'subscription',
            unlimited_time: !!document.getElementById('so-overrides-unlimited-time')?.checked,
            unlimited_devices: !!document.getElementById('so-overrides-unlimited-devices')?.checked,
            unlimited_credits: !!document.getElementById('so-overrides-unlimited-credits')?.checked
        };
        if (maxDevices != null) payload.max_devices = maxDevices;
        if (payload.unlimited_devices) payload.max_devices = 0;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set(payload, { merge: true });
            closeSoLicenseOverrides();
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(`Overrides saved for ${key}.`);
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.deleteSoLicense = async function(key) {
        if (!soRequireExtensionWrite()) return;
        const typed = prompt(`Type DELETE to permanently remove license ${key}:`);
        if (typed !== 'DELETE') return soToast('Delete cancelled.');
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).delete();
            await soLoadLicenses();
            renderSoLicensesList();
            soToast('License deleted.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.markSoLicenseShared = async function(key) {
        if (!soRequireExtensionWrite()) return;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({
                shared_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            await soLoadLicenses();
            renderSoLicensesList();
            renderSoCustomerRegistry();
            soToast(`Marked ${key} as shared with customer.`);
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    let soCustomerFilter = 'all';

    function soCustomerMatchesFilter(lic, filter) {
        return soLicenseMatchesFilter(lic, filter === 'all' ? 'all' : filter);
    }

    function renderSoCustomerRegistry() {
        const container = document.getElementById('so-customer-registry-list');
        const statsEl = document.getElementById('so-customer-registry-stats');
        if (!container) return;
        const q = String(document.getElementById('so-customer-search')?.value || '').trim().toLowerCase();
        const filtered = soLicenses.filter(lic => {
            if (!soCustomerMatchesFilter(lic, soCustomerFilter)) return false;
            if (!q) return true;
            const hay = [lic.key, lic.customer_name, lic.customer_phone, lic.customer_email, lic.planId, lic.planType]
                .filter(v => v != null && v !== '').join(' ').toLowerCase();
            return hay.includes(q);
        });
        const counts = { all: soLicenses.length, unused: 0, unused_shared: 0, active: 0, expired: 0, lifetime: 0, not_shared: 0, revoked: 0 };
        soLicenses.forEach(lic => {
            const s = soGetLicenseRegistryStatus(lic);
            if (counts[s] != null) counts[s]++;
            if (!soIsLicenseShared(lic) && !soIsLicenseActivated(lic)) counts.not_shared++;
        });
        if (statsEl) {
            statsEl.innerHTML = `
                <span class="so-meta-chip">${counts.all} total</span>
                <span class="so-meta-chip">${counts.unused + counts.unused_shared} unused</span>
                <span class="so-meta-chip">${counts.not_shared} not shared</span>
                <span class="so-meta-chip">${counts.active} active</span>
                <span class="so-meta-chip">${counts.expired} expired</span>
                <span class="so-meta-chip">${counts.lifetime} lifetime</span>`;
        }
        if (!filtered.length) {
            container.innerHTML = '<p class="so-admin-muted">No customer records match this filter.</p>';
            return;
        }
        container.innerHTML = filtered.map(lic => {
            const status = soGetLicenseRegistryStatus(lic);
            const name = lic.customer_name ? soEsc(lic.customer_name) : '<span class="so-admin-muted">No name</span>';
            const phone = lic.customer_phone ? soEsc(lic.customer_phone) : '—';
            const email = lic.customer_email ? soEsc(lic.customer_email) : '—';
            const shared = soIsLicenseShared(lic);
            const activated = soIsLicenseActivated(lic);
            return `<div class="so-customer-row">
                <div class="so-customer-row-head">
                    <div>
                        <strong>${name}</strong>
                        <div class="so-admin-muted">${phone}${email !== '—' ? ` · ${email}` : ''}</div>
                    </div>
                    <span class="so-badge so-badge--meta">${soEsc(soRegistryStatusLabel(status))}</span>
                </div>
                <div class="so-license-meta so-admin-muted">
                    License <code>${soEsc(lic.key)}</code> · ${soEsc(lic.planId || lic.planType || '—')}
                    · ${soEsc(soFormatValidity(lic))}
                </div>
                <div class="so-license-meta so-admin-muted">
                    ${shared ? `Shared ${soEsc(soFormatTs(lic.shared_at || lic.sharedAt))}` : 'Not shared yet'}
                    · ${activated ? `Activated ${soEsc(soFormatTs(lic.activatedAt))}` : 'Awaiting activation'}
                </div>
                ${lic.support_notes ? `<div class="so-license-notes">${soEsc(lic.support_notes)}</div>` : ''}
                <div class="so-list-actions so-list-actions--grid">
                    <button type="button" class="so-btn-sm so-btn-touch" onclick="editSoLicense('${soAttr(lic.key)}')">Edit license</button>
                    <button type="button" class="so-btn-sm so-btn-touch" onclick="markSoLicenseShared('${soAttr(lic.key)}')" ${shared ? 'disabled' : ''}>Mark shared</button>
                    <button type="button" class="so-btn-sm so-btn-touch" onclick="switchShippingOptimizerTab('licenses'); editSoLicense('${soAttr(lic.key)}')">Open in Licenses</button>
                </div>
            </div>`;
        }).join('');
    }

    window.filterSoCustomers = function() {
        renderSoCustomerRegistry();
    };

    window.setSoCustomerFilter = function(filter) {
        soCustomerFilter = filter || 'all';
        document.querySelectorAll('[data-so-customer-filter]').forEach(btn => {
            btn.classList.toggle('so-tab-chip--active', btn.getAttribute('data-so-customer-filter') === soCustomerFilter);
        });
        const sel = document.getElementById('so-customer-filter');
        if (sel) sel.value = soCustomerFilter;
        renderSoCustomerRegistry();
    };

    window.toggleSoCustomerRegistryAccordion = function() {
        const content = document.getElementById('so-customer-registry-content');
        const icon = document.getElementById('so-customer-registry-icon');
        if (!content) return;
        const open = content.style.display === 'none' || !content.style.display;
        content.style.display = open ? 'flex' : 'none';
        if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
        if (open) {
            if (typeof loadShippingOptimizerAdmin === 'function' && !soLoaded) {
                loadShippingOptimizerAdmin();
            } else {
                renderSoCustomerRegistry();
            }
        }
    };

    window.loadShippingOptimizerAdmin = async function() {
        if (!soRequireSuperAdmin()) return;
        if (typeof soGetExtensionDb !== 'function' || !soGetExtensionDb()) {
            soToast('Extension Firebase (extension-e6e32) not ready.');
            return;
        }
        if (typeof soEnsureExtensionFirebaseReady === 'function') {
            await soEnsureExtensionFirebaseReady();
        }
        soSnapshotsReady = false;
        soResetUserEditGate();
        soDirtyTabs = { config: false, credits: false };
        clearTimeout(soDirtyCheckTimer);
        clearTimeout(soDraftSaveTimer);
        soUpdateUnsavedBanner();
        try {
            await soLoadConfig();
            await soLoadDemoKeys();
            await soLoadLicenses();
            soHydrating = true;
            soPopulateLicensePlanSelect();
            soSetLicenseFormMode(null);
            soUpdateCustomCreditCalc();
            soRestoreSectionAccordions();
            renderSoDemoPendingKeysEditor();
            renderSoDemoKeysList();
            renderSoExtensionPreview();
            renderSoLicensesList();
            renderSoCustomerRegistry();
            soHydrating = false;
            soBindUserEditGate();
            soBindFieldInfoDismiss();
            soFinalizeAdminLoadState();
            soLoaded = true;
        } catch (e) {
            soToast('Load failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.addEventListener('beforeunload', (e) => {
        if (typeof soHasUnsavedChanges === 'function' && soHasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
})();
