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

    const SO_DEVICE_TIER_MAX = { standard: 1, family: 3, friends: 5 };
    const SO_BILLING_MODES = ['subscription', 'credits', 'hybrid'];
    const SO_DEVICE_TIERS = ['standard', 'family', 'friends'];

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
        p.days = Math.max(1, parseInt(p.days, 10) || 30);
        p.duration = String(p.duration || '').trim();
        p.save = String(p.save || '').trim();
        p.active = p.active !== false;
        p.best = !!p.best;
        p.order = Number.isFinite(Number(p.order)) ? Number(p.order) : index;
        if (!p.duration && p.days) {
            if (p.days === 30) p.duration = '1 Month';
            else if (p.days === 90) p.duration = '3 Months';
            else if (p.days === 180) p.duration = '6 Months';
            else if (p.days === 365) p.duration = '1 Year';
            else p.duration = `${p.days} days`;
        }
        p.device_tier = SO_DEVICE_TIERS.includes(p.device_tier) ? p.device_tier : 'standard';
        const tierDefault = SO_DEVICE_TIER_MAX[p.device_tier] || 1;
        p.max_devices = Math.max(1, parseInt(p.max_devices, 10) || tierDefault);
        p.billing_mode = SO_BILLING_MODES.includes(p.billing_mode) ? p.billing_mode : 'subscription';
        p.included_credits = Math.max(0, parseInt(p.included_credits, 10) || 0);
        return p;
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
        const override = parseInt(lic.max_devices, 10);
        if (override >= 1) return override;
        const planId = lic.planId || lic.planType;
        const plan = soPlans.find(p => p.id === planId);
        if (plan && parseInt(plan.max_devices, 10) >= 1) return parseInt(plan.max_devices, 10);
        return 1;
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
            if (p.days < 1) return `Plan "${p.id}": days must be ≥ 1.`;
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
        const exp = soLicenseExpiryDate(lic);
        return !!(exp && exp.getTime() < Date.now());
    }

    function soPlanInUse(planId) {
        if (!planId) return false;
        return soLicenses.some(lic => lic.planId === planId || lic.planType === planId);
    }

    function soFormatExpiry(lic) {
        if (lic.expiresAt && typeof lic.expiresAt === 'string' && lic.expiresAt.trim()) return lic.expiresAt;
        if (lic.expiresAt && lic.expiresAt.toDate) return soFormatTs(lic.expiresAt);
        if (!lic.activatedAt && lic.expiry_starts_on_activation !== false) {
            return `Starts on activation (${lic.planDays || '?'} days)`;
        }
        return '—';
    }

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
        soActiveTab = tab || 'config';
        document.querySelectorAll('.so-admin-tab-btn').forEach(btn => {
            btn.classList.toggle('so-admin-tab-btn--active', btn.getAttribute('data-so-tab') === soActiveTab);
        });
        document.querySelectorAll('.so-admin-tab-panel').forEach(panel => {
            panel.style.display = panel.id === `so-tab-${soActiveTab}` ? 'block' : 'none';
        });
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
        setVal('so-credits-price-per', soCredits ? soCredits.price_per_credit : DEFAULT_CREDITS.price_per_credit);
        setVal('so-credits-min-purchase', soCredits ? soCredits.min_purchase : DEFAULT_CREDITS.min_purchase);
        setVal('so-credits-cost-op', soCredits ? soCredits.cost_per_operation : DEFAULT_CREDITS.cost_per_operation);
    }

    function renderSoCreditPacksEditor() {
        const container = document.getElementById('so-credit-packs-editor');
        if (!container) return;
        if (!soCreditPacks.length) {
            container.innerHTML = '<p class="so-admin-muted">No credit packs yet. Tap + Add credit pack.</p>';
            return;
        }
        container.innerHTML = soCreditPacks.map((pack, idx) => `
            <div class="so-plan-row so-credit-pack-row" data-pack-idx="${idx}">
                <div class="so-plan-row-head">
                    <strong>${soEsc(pack.label || pack.id)}</strong>
                    <span class="so-admin-muted">${soEsc(pack.id)} · ${pack.credits} cr · ₹${pack.price}</span>
                    ${pack.active ? '' : '<span class="so-badge so-badge--off">Hidden</span>'}
                </div>
                <div class="so-plan-fields">
                    <label><span>Id (slug)</span><input type="text" data-field="id" value="${soAttr(pack.id)}"></label>
                    <label><span>Credits</span><input type="number" min="1" step="1" data-field="credits" value="${pack.credits}"></label>
                    <label><span>Price ₹</span><input type="number" min="0" step="1" data-field="price" value="${pack.price}"></label>
                    <label><span>Label</span><input type="text" data-field="label" value="${soAttr(pack.label || '')}"></label>
                    <label class="so-plan-check"><input type="checkbox" data-field="active" ${pack.active ? 'checked' : ''}> Show in extension</label>
                </div>
                <div class="so-plan-actions">
                    <button type="button" class="so-btn-icon" onclick="moveSoCreditPack(${idx}, -1)" title="Move up">▲</button>
                    <button type="button" class="so-btn-icon" onclick="moveSoCreditPack(${idx}, 1)" title="Move down">▼</button>
                    <button type="button" class="so-btn-icon so-btn-icon--danger" onclick="removeSoCreditPack(${idx})" title="Remove">✕</button>
                </div>
            </div>
        `).join('');
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
        renderSoCreditPacksEditor();
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
    };

    window.removeSoCreditPack = function(idx) {
        soCreditPacks = soReadCreditPacksFromDom();
        if (!confirm('Remove this credit pack from config?')) return;
        soCreditPacks.splice(idx, 1);
        soCreditPacks.forEach((p, i) => { p.order = i; });
        renderSoCreditPacksEditor();
    };

    function renderSoPlansEditor() {
        const container = document.getElementById('so-plans-editor');
        if (!container) return;
        if (!soPlans.length) {
            container.innerHTML = '<p class="so-admin-muted">No plans yet. Tap + Add Plan.</p>';
            return;
        }
        container.innerHTML = soPlans.map((plan, idx) => `
            <div class="so-plan-row" data-plan-idx="${idx}">
                <div class="so-plan-row-head">
                    <strong>${soEsc(plan.name)}</strong>
                    <span class="so-admin-muted">${soEsc(plan.id)} · ₹${plan.price} · ${plan.days}d · ${soEsc(plan.billing_mode || 'subscription')}</span>
                    ${plan.best ? '<span class="so-badge so-badge--best">BEST</span>' : ''}
                    ${plan.active ? '' : '<span class="so-badge so-badge--off">Hidden</span>'}
                </div>
                <div class="so-plan-fields">
                    <label><span>Id (slug)</span><input type="text" data-field="id" value="${soAttr(plan.id)}" ${idx < soPlans.length ? '' : ''}></label>
                    <label><span>Name</span><input type="text" data-field="name" value="${soAttr(plan.name)}"></label>
                    <label><span>Price ₹</span><input type="number" min="0" step="1" data-field="price" value="${plan.price}"></label>
                    <label><span>Days</span><input type="number" min="1" step="1" data-field="days" value="${plan.days}"></label>
                    <label><span>Duration label</span><input type="text" data-field="duration" value="${soAttr(plan.duration || '')}"></label>
                    <label><span>Save badge</span><input type="text" data-field="save" value="${soAttr(plan.save || '')}"></label>
                    <label><span>Device tier</span>
                        <select data-field="device_tier">
                            ${SO_DEVICE_TIERS.map(t => `<option value="${t}" ${plan.device_tier === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </label>
                    <label><span>Max devices</span><input type="number" min="1" step="1" data-field="max_devices" value="${plan.max_devices || 1}"></label>
                    <label><span>Billing mode</span>
                        <select data-field="billing_mode">
                            ${SO_BILLING_MODES.map(m => `<option value="${m}" ${plan.billing_mode === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </label>
                    <label><span>Included credits</span><input type="number" min="0" step="1" data-field="included_credits" value="${plan.included_credits || 0}" title="For credits/hybrid plans"></label>
                    <label class="so-plan-check"><input type="checkbox" data-field="active" ${plan.active ? 'checked' : ''}> Show in extension</label>
                    <label class="so-plan-check"><input type="checkbox" data-field="best" ${plan.best ? 'checked' : ''}> Best value</label>
                </div>
                <div class="so-plan-actions">
                    <button type="button" class="so-btn-icon" onclick="moveSoPlan(${idx}, -1)" title="Move up">▲</button>
                    <button type="button" class="so-btn-icon" onclick="moveSoPlan(${idx}, 1)" title="Move down">▼</button>
                    <button type="button" class="so-btn-icon so-btn-icon--danger" onclick="removeSoPlan(${idx})" title="Remove">✕</button>
                </div>
            </div>
        `).join('');
    }

    function soReadPlansFromDom() {
        const container = document.getElementById('so-plans-editor');
        if (!container) return [];
        const rows = container.querySelectorAll('.so-plan-row');
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
                device_tier: get('device_tier'),
                max_devices: get('max_devices'),
                billing_mode: get('billing_mode'),
                included_credits: get('included_credits'),
                active: get('active'),
                best: get('best'),
                order: idx
            }, idx));
        });
        return plans;
    }

    window.addSoPlan = function() {
        soPlans = soReadPlansFromDom();
        const nextOrder = soPlans.length;
        soPlans.push(soNormalizePlan({
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
        }, nextOrder));
        renderSoPlansEditor();
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
    };

    window.removeSoInlineDemoKey = function(key) {
        delete soInlineDemoKeys[key];
        renderSoInlineDemoKeysEditor();
    };

    window.saveShippingOptimizerConfig = async function() {
        if (!soRequireSuperAdmin()) return;
        soPlans = soReadPlansFromDom();
        soCreditPacks = soReadCreditPacksFromDom();
        const err = soValidatePlans(soPlans);
        if (err) return soToast(err);
        const packErr = soValidateCreditPacks(soCreditPacks);
        if (packErr) return soToast(packErr);

        const whatsappRaw = String(document.getElementById('so-whatsapp-number')?.value || '').replace(/\D/g, '');
        if (whatsappRaw.length < 10) return soToast('WhatsApp number must be at least 10 digits.');

        const creditsPayload = {
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

        const payload = {
            whatsapp_number: whatsappRaw,
            whatsapp_message: String(document.getElementById('so-whatsapp-message')?.value || '').trim(),
            extension_enabled: !!document.getElementById('so-extension-enabled')?.checked,
            min_extension_version: String(document.getElementById('so-min-version')?.value || '1.0.0').trim(),
            announcement: String(document.getElementById('so-announcement')?.value || '').trim(),
            credits: creditsPayload,
            plans: soPlans.map((p, i) => {
                const out = {
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    days: p.days,
                    active: p.active !== false,
                    order: i,
                    device_tier: p.device_tier || 'standard',
                    max_devices: p.max_devices || 1,
                    billing_mode: p.billing_mode || 'subscription'
                };
                if (p.duration) out.duration = p.duration;
                if (p.save) out.save = p.save;
                if (p.best) out.best = true;
                if (p.included_credits > 0) out.included_credits = p.included_credits;
                return out;
            }),
            demo_keys: soInlineDemoKeys,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: soAuthEmail()
        };

        try {
            await db.collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set(payload, { merge: true });
            soConfig = Object.assign({}, soConfig, payload);
            soCredits = creditsPayload;
            soToast('Shipping Optimizer config saved.');
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

    function soGetActivePlansForSelect() {
        return soSortPlans(soPlans.length ? soPlans : DEFAULT_PLANS).filter(p => p.active !== false);
    }

    function soPopulateLicensePlanSelect() {
        const sel = document.getElementById('so-license-plan');
        if (!sel) return;
        const plans = soGetActivePlansForSelect();
        sel.innerHTML = plans.map(p =>
            `<option value="${soAttr(p.id)}" data-days="${p.days}">${soEsc(p.name)} — ₹${p.price} (${p.days} days)</option>`
        ).join('');
        soUpdateLicensePlanHint();
    }

    function soSetLicenseFormMode(editingKey) {
        soEditingLicenseKey = editingKey || null;
        const btn = document.querySelector('#so-tab-licenses .btn-gold');
        if (btn) {
            btn.textContent = soEditingLicenseKey ? 'Update license' : 'Create license';
            btn.onclick = soEditingLicenseKey ? () => updateSoLicense() : () => createSoLicense();
        }
        const cancelBtn = document.getElementById('so-license-cancel-edit');
        if (cancelBtn) cancelBtn.style.display = soEditingLicenseKey ? 'block' : 'none';
        const keyEl = document.getElementById('so-license-key-input');
        if (keyEl) keyEl.readOnly = !!soEditingLicenseKey;
    }

    function soReadLicenseFormFields() {
        const billingMode = String(document.getElementById('so-license-billing-mode')?.value || 'subscription').trim();
        const maxDevicesRaw = document.getElementById('so-license-max-devices')?.value;
        const maxDevices = maxDevicesRaw === '' || maxDevicesRaw == null
            ? null
            : Math.max(1, parseInt(maxDevicesRaw, 10) || 1);
        return {
            billing_mode: SO_BILLING_MODES.includes(billingMode) ? billingMode : 'subscription',
            max_devices: maxDevices,
            credits_balance: Math.max(0, parseInt(document.getElementById('so-license-credits-balance')?.value, 10) || 0),
            credits_used: Math.max(0, parseInt(document.getElementById('so-license-credits-used')?.value, 10) || 0)
        };
    }

    function soApplyPlanDefaultsToLicenseForm(plan) {
        if (!plan) return;
        const billingEl = document.getElementById('so-license-billing-mode');
        if (billingEl && plan.billing_mode) billingEl.value = plan.billing_mode;
        const maxEl = document.getElementById('so-license-max-devices');
        if (maxEl) maxEl.value = plan.max_devices != null ? plan.max_devices : '';
        const balEl = document.getElementById('so-license-credits-balance');
        if (balEl && plan.billing_mode === 'credits') {
            balEl.value = plan.included_credits > 0 ? plan.included_credits : 50;
        } else if (balEl && plan.billing_mode === 'hybrid' && plan.included_credits > 0) {
            balEl.value = plan.included_credits;
        }
    }

    window.soUpdateLicensePlanHint = function() {
        const sel = document.getElementById('so-license-plan');
        const hint = document.getElementById('so-license-plan-hint');
        if (!sel || !hint) return;
        const planId = sel.value;
        const plan = soPlans.find(p => p.id === planId) || soGetActivePlansForSelect().find(p => p.id === planId);
        const days = plan ? plan.days : (parseInt(sel.options[sel.selectedIndex]?.getAttribute('data-days'), 10) || 30);
        const tier = plan ? (plan.device_tier || 'standard') : 'standard';
        const maxDev = plan ? (plan.max_devices || 1) : 1;
        const billing = plan ? (plan.billing_mode || 'subscription') : 'subscription';
        hint.textContent = `Expiry starts on activation: ${days} days · tier ${tier} · max ${maxDev} device(s) · billing ${billing}.`;
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
        document.getElementById('so-license-customer-name').value = lic.customer_name || '';
        document.getElementById('so-license-customer-phone').value = lic.customer_phone || '';
        document.getElementById('so-license-customer-email').value = lic.customer_email || '';
        document.getElementById('so-license-support-notes').value = lic.support_notes || '';
        soUpdateLicensePlanHint();
        document.getElementById('so-tab-licenses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        soToast(`Editing ${key}. Update fields and tap Update license.`);
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
        const plan = soPlans.find(p => p.id === planId) || soGetActivePlansForSelect().find(p => p.id === planId);
        if (!plan) return soToast('Select a valid plan.');
        const formFields = soReadLicenseFormFields();
        const maxDevices = formFields.max_devices != null
            ? formFields.max_devices
            : (plan.max_devices || SO_DEVICE_TIER_MAX[plan.device_tier] || 1);
        const payload = {
            active: true,
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
            billing_mode: formFields.billing_mode || plan.billing_mode || 'subscription',
            max_devices: maxDevices,
            credits_balance: formFields.credits_balance,
            credits_used: formFields.credits_used,
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
        const plan = soPlans.find(p => p.id === planId) || soGetActivePlansForSelect().find(p => p.id === planId);
        if (!plan) return soToast('Select a valid plan.');
        const formFields = soReadLicenseFormFields();
        const maxDevices = formFields.max_devices != null
            ? formFields.max_devices
            : (plan.max_devices || SO_DEVICE_TIER_MAX[plan.device_tier] || 1);
        const payload = {
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
            billing_mode: formFields.billing_mode,
            max_devices: maxDevices,
            credits_balance: formFields.credits_balance,
            credits_used: formFields.credits_used,
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
            const maxDevices = soGetLicenseMaxDevices(lic);
            const activated = deviceIds.length > 0
                || !!(lic.activatedAt && String(lic.activatedAt).trim())
                || !!(lic.machineId && String(lic.machineId).trim());
            const expired = soIsLicenseExpired(lic);
            const billingMode = lic.billing_mode || 'subscription';
            const creditsBal = parseInt(lic.credits_balance, 10) || 0;
            const creditsUsed = parseInt(lic.credits_used, 10) || 0;
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
            return `<div class="so-license-row">
                <div class="so-license-head">
                    <code>${soEsc(lic.key)}</code>
                    <span class="so-badge ${active ? 'so-badge--on' : 'so-badge--off'}">${active ? 'Active' : 'Revoked'}</span>
                    <span class="so-badge ${activated ? 'so-badge--on' : ''}">${activated ? 'Activated' : 'Pending'}</span>
                    ${expired ? '<span class="so-badge so-badge--off">Expired</span>' : ''}
                    <span class="so-badge">${soEsc(billingMode)}</span>
                </div>
                <div class="so-license-meta so-admin-muted">
                    Plan: ${soEsc(lic.planId || lic.planType || '—')} (${lic.planDays || '?'}d)
                    · ${activatedLabel}
                    · Expires: ${soEsc(soFormatExpiry(lic))}
                    · Devices: ${deviceIds.length}/${maxDevices}
                </div>
                <div class="so-license-meta so-admin-muted">
                    Credits: ${creditsBal} balance · ${creditsUsed} used
                    · Max devices: ${maxDevices}
                </div>
                <div class="so-license-meta">${deviceListHtml}</div>
                <div class="so-license-meta so-admin-muted">
                    ${lic.customer_name ? soEsc(lic.customer_name) + ' · ' : ''}${lic.customer_phone ? soEsc(lic.customer_phone) + ' · ' : ''}${lic.customer_email ? soEsc(lic.customer_email) : ''}
                </div>
                ${lic.support_notes ? `<div class="so-license-notes">${soEsc(lic.support_notes)}</div>` : ''}
                <div class="so-list-actions">
                    <button type="button" class="so-btn-sm" onclick="editSoLicense('${soAttr(lic.key)}')">Edit</button>
                    <button type="button" class="so-btn-sm" onclick="toggleSoLicenseActive('${soAttr(lic.key)}', ${active})">${active ? 'Revoke' : 'Activate'}</button>
                    <button type="button" class="so-btn-sm" onclick="addSoLicenseCredits('${soAttr(lic.key)}')">Add credits</button>
                    <button type="button" class="so-btn-sm" onclick="resetSoLicenseAllDevices('${soAttr(lic.key)}')" ${deviceIds.length ? '' : 'disabled'}>Reset all devices</button>
                    <button type="button" class="so-btn-sm so-btn-sm--danger" onclick="deleteSoLicense('${soAttr(lic.key)}')">Delete</button>
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

    window.addSoLicenseCredits = async function(key) {
        if (!soRequireSuperAdmin()) return;
        const lic = soLicenses.find(l => l.key === key);
        if (!lic) return soToast('License not found.');
        const activePacks = soSortCreditPacks(soCreditPacks.length ? soCreditPacks : DEFAULT_CREDIT_PACKS)
            .filter(p => p.active !== false);
        let lines = activePacks.map(p => `${p.id}: +${p.credits} credits (₹${p.price})`).join('\n');
        if (!lines) lines = '(no packs in config — enter custom amount below)';
        const input = prompt(
            `Add credits to ${key}\nCurrent balance: ${parseInt(lic.credits_balance, 10) || 0}\n\nPacks:\n${lines}\n\nEnter pack id (e.g. pack_20) or credit amount:`
        );
        if (input == null || !String(input).trim()) return;
        const raw = String(input).trim();
        let addCredits = 0;
        const pack = activePacks.find(p => p.id === raw || p.id === soSlugifyId(raw));
        if (pack) {
            addCredits = pack.credits;
        } else {
            addCredits = parseInt(raw, 10);
            if (!Number.isFinite(addCredits) || addCredits < 1) {
                return soToast('Enter a valid pack id or credit amount.');
            }
        }
        const current = parseInt(lic.credits_balance, 10) || 0;
        try {
            await db.collection(SO_LICENSE_COL).doc(key).set({
                credits_balance: current + addCredits
            }, { merge: true });
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(`Added ${addCredits} credits. New balance: ${current + addCredits}.`);
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
            renderSoDemoKeysList();
            renderSoLicensesList();
            switchShippingOptimizerTab(soActiveTab);
            soLoaded = true;
        } catch (e) {
            soToast('Load failed: ' + (e.message || 'Unknown error'));
        }
    };
})();
