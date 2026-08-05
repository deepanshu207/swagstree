// ==========================================
// SWAG STREE | SHIPPING OPTIMIZER EXTENSION ADMIN
// Firestore: shipping_optimizer_* collections only
// Access: superadmin@swagstree.com only
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
            billing_mode: 'credits', included_credits: 50, plan_kind: 'custom', max_devices: 1, active: true
        }
    };

    let soConfig = null;
    let soPlans = [];
    let soCredits = null;
    let soCreditPacks = [];
    let soInlineDemoKeys = {};
    let soDemoKeys = [];
    let soLicenses = [];
    let soActiveTab = 'config';
    let soLoaded = false;
    let soEditingLicenseKey = null;
    let soOverridesLicenseKey = null;
    let soAddCreditsLicenseKey = null;
    let soDirtyTabs = { config: false, credits: false };
    let soExpandedPlanIds = new Set();
    let soExpandedPackIds = new Set();
    let soExpandedLicenseKeys = new Set();
    let soOpenSections = new Set(['config-general', 'credits-settings', 'credits-packs', 'demo-add', 'demo-list', 'license-create', 'license-list']);

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

    function soToast(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }

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
        p.unlimited_time = !!p.unlimited_time || p.days === 0;
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
        }
        p.device_tier = SO_DEVICE_TIERS.includes(p.device_tier) ? p.device_tier : 'standard';
        const tierDefault = SO_DEVICE_TIER_MAX[p.device_tier];
        const rawMax = parseInt(p.max_devices, 10);
        if (p.unlimited_devices || p.device_tier === 'unlimited') {
            p.max_devices = 0;
            p.unlimited_devices = true;
        } else if (Number.isFinite(rawMax) && rawMax >= 0) {
            p.max_devices = rawMax;
        } else {
            p.max_devices = tierDefault != null ? tierDefault : 1;
        }
        p.billing_mode = SO_BILLING_MODES.includes(p.billing_mode) ? p.billing_mode : 'subscription';
        p.included_credits = Math.max(0, parseInt(p.included_credits, 10) || 0);
        return p;
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
        if (p.unlimited_time) out.unlimited_time = true;
        if (p.unlimited_devices) out.unlimited_devices = true;
        if (p.unlimited_credits) out.unlimited_credits = true;
        return out;
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

    function soFormatCreditsLabel(lic) {
        if (soIsUnlimitedCredits(lic)) return 'Unlimited';
        const bal = parseInt(lic.credits_balance, 10) || 0;
        const used = parseInt(lic.credits_used, 10) || 0;
        return `${bal} balance · ${used} used`;
    }

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
        const lic = await db.collection(SO_LICENSE_COL).doc(upper).get();
        if (lic.exists) return true;
        const demo = await db.collection(SO_DEMO_COL).doc(upper).get();
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
        if (soIsUnlimitedTime(lic)) return false;
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
        if (tab === 'config' || tab === 'credits') {
            soDirtyTabs[tab] = true;
            soUpdateUnsavedBanner();
        }
    };

    function soClearTabDirty(tab) {
        if (tab === 'config' || tab === 'credits') {
            soDirtyTabs[tab] = false;
            soUpdateUnsavedBanner();
        }
    }

    function soUpdateUnsavedBanner() {
        const banner = document.getElementById('so-unsaved-banner');
        if (!banner) return;
        const dirty = soDirtyTabs[soActiveTab];
        banner.hidden = !dirty;
    }

    window.soSaveCurrentTab = function() {
        if (soActiveTab === 'config') saveShippingOptimizerConfig();
        else if (soActiveTab === 'credits') saveShippingOptimizerCredits();
    };

    function soConfirmLeaveTab(nextTab) {
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
        if (soExpandedPackIds.has(pack.id)) soExpandedPackIds.delete(pack.id);
        else soExpandedPackIds.add(pack.id);
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
        document.querySelectorAll('.so-admin-tab-panel').forEach(panel => {
            panel.style.display = panel.id === `so-tab-${soActiveTab}` ? 'block' : 'none';
        });
        soUpdateUnsavedBanner();
        soRestoreSectionAccordions();
        if (soActiveTab === 'credits') {
            soBindCreditsForm();
            soUpdateCustomCreditCalc();
        }
        if (soActiveTab === 'demo') renderSoDemoKeysList();
        if (soActiveTab === 'licenses') renderSoLicensesList();
    };

    async function soLoadConfig() {
        const snap = await db.collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).get();
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
        soInlineDemoKeys = Object.assign({}, DEFAULT_INLINE_DEMO_KEYS, soConfig.demo_keys || {});
        soBindConfigForm();
        soBindCreditsForm();
        renderSoCreditPacksEditor();
        renderSoPlansEditor();
        renderSoInlineDemoKeysEditor();
    }

    async function soLoadDemoKeys() {
        const snap = await db.collection(SO_DEMO_COL).limit(100).get();
        soDemoKeys = [];
        snap.forEach(doc => {
            soDemoKeys.push(Object.assign({ key: doc.id }, doc.data()));
        });
        soDemoKeys.sort((a, b) => {
            const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
    }

    async function soLoadLicenses() {
        let snap;
        try {
            snap = await db.collection(SO_LICENSE_COL).orderBy('expiresAt', 'desc').limit(SO_LICENSE_MAX).get();
        } catch (_) {
            try {
                snap = await db.collection(SO_LICENSE_COL).orderBy('createdAt', 'desc').limit(SO_LICENSE_MAX).get();
            } catch (_e) {
                snap = await db.collection(SO_LICENSE_COL).limit(SO_LICENSE_MAX).get();
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

    function renderSoCreditPacksEditor() {
        const container = document.getElementById('so-credit-packs-editor');
        if (!container) return;
        if (!soCreditPacks.length) {
            container.innerHTML = '<p class="so-admin-muted">No credit packs yet. Tap + Add credit pack.</p>';
            return;
        }
        container.innerHTML = soCreditPacks.map((pack, idx) => {
            const open = soExpandedPackIds.has(pack.id);
            return `
            <div class="so-plan-row so-credit-pack-row so-collapsible-row ${open ? 'so-collapsible-row--open' : ''}" data-pack-idx="${idx}">
                <div class="so-plan-row-head" onclick="toggleSoPackRow(${idx})">
                    <strong>${soEsc(pack.label || pack.id)}</strong>
                    <span class="so-admin-muted">${pack.credits} cr · ₹${pack.price}</span>
                    ${pack.active ? '' : '<span class="so-badge so-badge--off">Hidden</span>'}
                    <span class="so-collapsible-toggle"></span>
                </div>
                <div class="so-plan-fields" onclick="event.stopPropagation()">
                    <label><span>Id (slug)</span><input type="text" data-field="id" value="${soAttr(pack.id)}" oninput="soMarkTabDirty('credits')"></label>
                    <label><span>Credits</span><input type="number" min="1" step="1" data-field="credits" value="${pack.credits}" oninput="soMarkTabDirty('credits')"></label>
                    <label><span>Price ₹</span><input type="number" min="0" step="1" data-field="price" value="${pack.price}" oninput="soMarkTabDirty('credits')"></label>
                    <label><span>Label</span><input type="text" data-field="label" value="${soAttr(pack.label || '')}" oninput="soMarkTabDirty('credits')"></label>
                    <label class="so-plan-check"><input type="checkbox" data-field="active" ${pack.active ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Show in extension</label>
                </div>
                <div class="so-plan-actions" onclick="event.stopPropagation()">
                    <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoCreditPack(${idx}, -1)" title="Move up">▲</button>
                    <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoCreditPack(${idx}, 1)" title="Move down">▼</button>
                    <button type="button" class="so-btn-icon so-btn-icon--danger so-btn-touch" onclick="removeSoCreditPack(${idx})" title="Remove">✕</button>
                </div>
            </div>`;
        }).join('');
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

    function soPlanMetaChips(plan) {
        const chips = [];
        chips.push(plan.billing_mode || 'subscription');
        if (soIsUnlimitedTime(plan)) chips.push('No expiry');
        else if (plan.duration) chips.push(plan.duration);
        else if (plan.days > 0) chips.push(`${plan.days} days`);
        if (soIsUnlimitedDevices(plan)) chips.push('Unlimited devices');
        else chips.push(`${plan.max_devices != null ? plan.max_devices : 1} device${(plan.max_devices || 1) !== 1 ? 's' : ''}`);
        if (plan.included_credits > 0) chips.push(`${plan.included_credits} credits`);
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
                <div class="so-plan-card-body" onclick="event.stopPropagation()">
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-circle-info"></i> Basic info</div>
                        <div class="so-plan-fields so-plan-fields--basic">
                            <label><span>Id (slug) — never rename after use</span><input type="text" data-field="id" value="${soAttr(plan.id)}" oninput="soMarkTabDirty('config')"></label>
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
                            <label><span>Billing mode</span>
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
                            <label><span>Included credits</span><input type="number" min="0" step="1" data-field="included_credits" value="${plan.included_credits || 0}" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Plan kind</span><input type="text" data-field="plan_kind" value="${soAttr(plan.plan_kind || '')}" placeholder="lifetime, unlimited" oninput="soMarkTabDirty('config')"></label>
                            <label class="so-field-full"><span>Admin note</span><input type="text" data-field="description" value="${soAttr(plan.description || '')}" oninput="soMarkTabDirty('config')"></label>
                        </div>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-infinity"></i> Limits &amp; visibility</div>
                        <div class="so-plan-flags">
                            <label class="so-plan-check"><input type="checkbox" data-field="unlimited_time" ${plan.unlimited_time ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Unlimited time</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="unlimited_devices" ${plan.unlimited_devices ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Unlimited devices</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="unlimited_credits" ${plan.unlimited_credits ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Unlimited credits</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="active" ${plan.active ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Show in extension</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="best" ${plan.best ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Best value badge</label>
                        </div>
                    </div>
                    <div class="so-plan-actions-bar">
                        <button type="button" class="so-btn-sm" onclick="moveSoPlan(${idx}, -1)" title="Move up"><i class="fa fa-arrow-up"></i> Up</button>
                        <button type="button" class="so-btn-sm" onclick="moveSoPlan(${idx}, 1)" title="Move down"><i class="fa fa-arrow-down"></i> Down</button>
                        <button type="button" class="so-btn-sm so-btn-sm--danger" onclick="removeSoPlan(${idx})"><i class="fa fa-trash"></i> Remove</button>
                    </div>
                </div>
            </div>`;
        }).join('');
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
                device_tier: get('device_tier'),
                max_devices: get('max_devices'),
                billing_mode: get('billing_mode'),
                included_credits: get('included_credits'),
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

    function renderSoInlineDemoKeysEditor() {
        const container = document.getElementById('so-inline-demo-keys');
        if (!container) return;
        const keys = Object.keys(soInlineDemoKeys || {});
        if (!keys.length) {
            container.innerHTML = '<p class="so-admin-muted">No inline demo keys in config. Add below or use Demo Keys tab.</p>';
            return;
        }
        container.innerHTML = keys.map(key => {
            const entry = soInlineDemoKeys[key] || {};
            return `<div class="so-inline-key-row">
                <code>${soEsc(key)}</code>
                <span>${entry.days || 0} days · ${soEsc(entry.label || '')}</span>
                <button type="button" class="so-btn-icon so-btn-icon--danger" onclick="removeSoInlineDemoKey('${soAttr(key)}')">✕</button>
            </div>`;
        }).join('');
    }

    window.addSoInlineDemoKey = function() {
        const keyEl = document.getElementById('so-inline-demo-key-input');
        const daysEl = document.getElementById('so-inline-demo-days-input');
        const labelEl = document.getElementById('so-inline-demo-label-input');
        const key = String(keyEl && keyEl.value || '').trim().toUpperCase();
        const days = Math.max(1, parseInt(daysEl && daysEl.value, 10) || 30);
        const label = String(labelEl && labelEl.value || '').trim();
        if (!key || key.length < 6) return soToast('Demo key must be at least 6 characters.');
        soInlineDemoKeys[key] = { days, label: label || `${days}-day promo` };
        if (keyEl) keyEl.value = '';
        if (labelEl) labelEl.value = '';
        renderSoInlineDemoKeysEditor();
        soMarkTabDirty('config');
    };

    window.removeSoInlineDemoKey = function(key) {
        if (!confirm(`Remove inline demo key ${key}?`)) return;
        delete soInlineDemoKeys[key];
        renderSoInlineDemoKeysEditor();
        soMarkTabDirty('config');
    };

    window.saveShippingOptimizerConfig = async function() {
        if (!soRequireSuperAdmin()) return;
        soPlans = soReadPlansFromDom();
        const err = soValidatePlans(soPlans);
        if (err) return soToast(err);

        const whatsappRaw = String(document.getElementById('so-whatsapp-number')?.value || '').replace(/\D/g, '');
        if (whatsappRaw.length < 10) return soToast('WhatsApp number must be at least 10 digits.');

        const payload = {
            whatsapp_number: whatsappRaw,
            whatsapp_message: String(document.getElementById('so-whatsapp-message')?.value || '').trim(),
            extension_enabled: !!document.getElementById('so-extension-enabled')?.checked,
            min_extension_version: String(document.getElementById('so-min-version')?.value || '1.2.0').trim(),
            announcement: String(document.getElementById('so-announcement')?.value || '').trim(),
            plans: soPlans.map((p, i) => soPlanToFirestore(p, i)),
            demo_keys: soInlineDemoKeys,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: soAuthEmail()
        };

        try {
            await db.collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set(payload, { merge: true });
            soConfig = Object.assign({}, soConfig, payload);
            soPopulateLicensePlanSelect();
            soClearTabDirty('config');
            soToast('Config & plans saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerCredits = async function() {
        if (!soRequireSuperAdmin()) return;
        soCreditPacks = soReadCreditPacksFromDom();
        const packErr = soValidateCreditPacks(soCreditPacks);
        if (packErr) return soToast(packErr);

        const creditsPayload = {
            enabled: !!document.getElementById('so-credits-enabled')?.checked,
            price_per_credit: Math.max(0, parseInt(document.getElementById('so-credits-price-per')?.value, 10) || DEFAULT_CREDITS.price_per_credit),
            min_purchase: Math.max(1, parseInt(document.getElementById('so-credits-min-purchase')?.value, 10) || DEFAULT_CREDITS.min_purchase),
            cost_per_operation: Math.max(1, parseInt(document.getElementById('so-credits-cost-op')?.value, 10) || DEFAULT_CREDITS.cost_per_operation),
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
            await db.collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                credits: creditsPayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }, { merge: true });
            soCredits = creditsPayload;
            soConfig = Object.assign({}, soConfig, { credits: creditsPayload });
            soClearTabDirty('credits');
            soToast('Credits & packs saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    function renderSoDemoKeysList() {
        const container = document.getElementById('so-demo-keys-list');
        if (!container) return;
        const q = String(document.getElementById('so-demo-search')?.value || '').trim().toLowerCase();
        const filtered = soDemoKeys.filter(d => {
            if (!q) return true;
            return d.key.toLowerCase().includes(q) || String(d.label || '').toLowerCase().includes(q);
        });
        if (!filtered.length) {
            container.innerHTML = '<p class="so-admin-muted">No demo keys found.</p>';
            return;
        }
        container.innerHTML = filtered.map(d => {
            const active = d.active !== false;
            return `<div class="so-list-row">
                <div class="so-list-main">
                    <code>${soEsc(d.key)}</code>
                    <span class="so-admin-muted">${d.days || 0} days · ${soEsc(d.label || '')}</span>
                    <span class="so-badge ${active ? 'so-badge--on' : 'so-badge--off'}">${active ? 'Active' : 'Disabled'}</span>
                </div>
                <div class="so-list-actions">
                    <button type="button" class="so-btn-sm" onclick="toggleSoDemoKey('${soAttr(d.key)}', ${active})">${active ? 'Disable' : 'Enable'}</button>
                    <button type="button" class="so-btn-sm so-btn-sm--danger" onclick="deleteSoDemoKey('${soAttr(d.key)}')">Delete</button>
                </div>
            </div>`;
        }).join('');
    }

    window.filterSoDemoKeys = function() {
        renderSoDemoKeysList();
    };

    window.addSoDemoKey = async function() {
        if (!soRequireSuperAdmin()) return;
        const key = String(document.getElementById('so-demo-key-input')?.value || '').trim().toUpperCase();
        const days = Math.max(1, parseInt(document.getElementById('so-demo-days-input')?.value, 10) || 30);
        const label = String(document.getElementById('so-demo-label-input')?.value || '').trim();
        if (!key) return soToast('Enter a demo key.');
        if (key.length < 6) return soToast('Demo key must be at least 6 characters.');
        if (await soKeyExists(key)) return soToast('Key already exists.');
        try {
            await db.collection(SO_DEMO_COL).doc(key).set({
                days,
                label: label || `${days}-day promo`,
                active: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            document.getElementById('so-demo-key-input').value = '';
            await soLoadDemoKeys();
            renderSoDemoKeysList();
            soToast('Demo key added.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.toggleSoDemoKey = async function(key, currentlyActive) {
        if (!soRequireSuperAdmin()) return;
        try {
            await db.collection(SO_DEMO_COL).doc(key).set({ active: !currentlyActive }, { merge: true });
            await soLoadDemoKeys();
            renderSoDemoKeysList();
            soToast(currentlyActive ? 'Demo key disabled.' : 'Demo key enabled.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.deleteSoDemoKey = async function(key) {
        if (!soRequireSuperAdmin()) return;
        if (!confirm(`Delete demo key ${key}?`)) return;
        try {
            await db.collection(SO_DEMO_COL).doc(key).delete();
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
            unlimited_credits: !!document.getElementById('so-license-unlimited-credits')?.checked
        };
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
        if (!soEditingLicenseKey) soApplyPlanDefaultsToLicenseForm(plan);
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
        if (!soRequireSuperAdmin()) return;
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
        const payload = {
            active: true,
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
            billing_mode: formFields.billing_mode || plan.billing_mode || 'subscription',
            max_devices: maxDevices,
            credits_balance: formFields.credits_balance,
            credits_used: formFields.credits_used,
            unlimited_time: formFields.unlimited_time || soIsUnlimitedTime(plan),
            unlimited_devices: formFields.unlimited_devices || soIsUnlimitedDevices(plan),
            unlimited_credits: formFields.unlimited_credits || soIsUnlimitedCredits(plan),
            device_ids: [],
            expiry_starts_on_activation: true,
            expiresAt: '',
            machineId: '',
            activatedAt: '',
            customer_name: String(document.getElementById('so-license-customer-name')?.value || '').trim(),
            customer_phone: String(document.getElementById('so-license-customer-phone')?.value || '').replace(/\D/g, ''),
            customer_email: String(document.getElementById('so-license-customer-email')?.value || '').trim(),
            support_notes: String(document.getElementById('so-license-support-notes')?.value || '').trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: soAuthEmail()
        };
        try {
            await db.collection(SO_LICENSE_COL).doc(key).set(payload);
            cancelSoLicenseEdit();
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(`License ${key} created. Send to customer on WhatsApp.`);
        } catch (e) {
            soToast('Create failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.updateSoLicense = async function() {
        if (!soRequireSuperAdmin()) return;
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
        const payload = {
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
            billing_mode: formFields.billing_mode,
            max_devices: maxDevices,
            credits_balance: formFields.credits_balance,
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
        };
        try {
            await db.collection(SO_LICENSE_COL).doc(key).set(payload, { merge: true });
            cancelSoLicenseEdit();
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(`License ${key} updated.`);
        } catch (e) {
            soToast('Update failed: ' + (e.message || 'Unknown error'));
        }
    };

    function renderSoLicensesList() {
        const container = document.getElementById('so-licenses-list');
        if (!container) return;
        const q = String(document.getElementById('so-license-search')?.value || '').trim().toLowerCase();
        const filtered = soLicenses.filter(lic => {
            if (!q) return true;
            const deviceIds = soGetLicenseDeviceIds(lic).join(' ');
            const hay = [lic.key, lic.machineId, deviceIds, lic.planId, lic.planType, lic.billing_mode,
                lic.customer_name, lic.customer_phone, lic.customer_email,
                lic.credits_balance, lic.credits_used]
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
            const activated = deviceIds.length > 0
                || !!(lic.activatedAt && String(lic.activatedAt).trim())
                || !!(lic.machineId && String(lic.machineId).trim());
            const expired = soIsLicenseExpired(lic);
            const billingMode = lic.billing_mode || 'subscription';
            const creditsLabel = soFormatCreditsLabel(lic);
            const expiryLabel = soFormatExpiry(lic);
            const activatedLabel = activated
                ? `Activated: ${soEsc(soFormatTs(lic.activatedAt))}`
                : 'Not activated yet';
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
                    ${expired ? '<span class="so-badge so-badge--off">Expired</span>' : ''}
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
                        ${activatedLabel} · Expires: ${soEsc(expiryLabel)} · ${soEsc(billingMode)}
                    </div>
                    <div class="so-license-meta">${deviceListHtml}</div>
                    ${lic.support_notes ? `<div class="so-license-notes">${soEsc(lic.support_notes)}</div>` : ''}
                    <div class="so-list-actions so-list-actions--grid">
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="editSoLicense('${soAttr(lic.key)}')">Edit</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="openSoLicenseOverrides('${soAttr(lic.key)}')">Overrides</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="addSoLicenseCredits('${soAttr(lic.key)}')">Add credits</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="toggleSoLicenseActive('${soAttr(lic.key)}', ${active})">${active ? 'Revoke' : 'Activate'}</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="resetSoLicenseAllDevices('${soAttr(lic.key)}')" ${deviceIds.length ? '' : 'disabled'}>Reset devices</button>
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
        if (!soRequireSuperAdmin()) return;
        if (currentlyActive) {
            if (!confirm(`Revoke license ${key}? Extension will reject this key.`)) return;
        }
        try {
            await db.collection(SO_LICENSE_COL).doc(key).set({ active: !currentlyActive }, { merge: true });
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
        if (!soRequireSuperAdmin()) return;
        if (!confirm(`Reset all device bindings for ${key}? Customer can activate on new device(s).`)) return;
        try {
            await db.collection(SO_LICENSE_COL).doc(key).set({
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

    window.removeSoLicenseDeviceId = async function(key, deviceId) {
        if (!soRequireSuperAdmin()) return;
        const lic = soLicenses.find(l => l.key === key);
        if (!lic) return soToast('License not found.');
        if (!confirm(`Remove device ${deviceId} from ${key}?`)) return;
        const ids = soGetLicenseDeviceIds(lic).filter(id => id !== deviceId);
        try {
            await db.collection(SO_LICENSE_COL).doc(key).set({
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
        if (!soRequireSuperAdmin()) return;
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
            await db.collection(SO_LICENSE_COL).doc(key).set({
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
        if (!soRequireSuperAdmin()) return;
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
            await db.collection(SO_LICENSE_COL).doc(key).set(payload, { merge: true });
            closeSoLicenseOverrides();
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(`Overrides saved for ${key}.`);
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.deleteSoLicense = async function(key) {
        if (!soRequireSuperAdmin()) return;
        const typed = prompt(`Type DELETE to permanently remove license ${key}:`);
        if (typed !== 'DELETE') return soToast('Delete cancelled.');
        try {
            await db.collection(SO_LICENSE_COL).doc(key).delete();
            await soLoadLicenses();
            renderSoLicensesList();
            soToast('License deleted.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.loadShippingOptimizerAdmin = async function() {
        if (!soRequireSuperAdmin()) return;
        if (typeof db === 'undefined' || !db) {
            soToast('Firestore not ready.');
            return;
        }
        try {
            await soLoadConfig();
            await soLoadDemoKeys();
            await soLoadLicenses();
            soPopulateLicensePlanSelect();
            soSetLicenseFormMode(null);
            soUpdateUnsavedBanner();
            soUpdateCustomCreditCalc();
            soRestoreSectionAccordions();
            renderSoDemoKeysList();
            renderSoLicensesList();
            switchShippingOptimizerTab(soActiveTab);
            soLoaded = true;
        } catch (e) {
            soToast('Load failed: ' + (e.message || 'Unknown error'));
        }
    };
})();
