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

    let soConfig = null;
    let soPlans = [];
    let soInlineDemoKeys = {};
    let soDemoKeys = [];
    let soLicenses = [];
    let soActiveTab = 'config';
    let soLoaded = false;

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
        return p;
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
        soInlineDemoKeys = Object.assign({}, DEFAULT_INLINE_DEMO_KEYS, soConfig.demo_keys || {});
        soBindConfigForm();
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
                    <span class="so-admin-muted">${soEsc(plan.id)} · ₹${plan.price} · ${plan.days}d</span>
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
        const err = soValidatePlans(soPlans);
        if (err) return soToast(err);

        const whatsappRaw = String(document.getElementById('so-whatsapp-number')?.value || '').replace(/\D/g, '');
        if (whatsappRaw.length < 10) return soToast('WhatsApp number must be at least 10 digits.');

        const payload = {
            whatsapp_number: whatsappRaw,
            whatsapp_message: String(document.getElementById('so-whatsapp-message')?.value || '').trim(),
            extension_enabled: !!document.getElementById('so-extension-enabled')?.checked,
            min_extension_version: String(document.getElementById('so-min-version')?.value || '1.0.0').trim(),
            announcement: String(document.getElementById('so-announcement')?.value || '').trim(),
            plans: soPlans.map((p, i) => {
                const out = {
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    days: p.days,
                    active: p.active !== false,
                    order: i
                };
                if (p.duration) out.duration = p.duration;
                if (p.save) out.save = p.save;
                if (p.best) out.best = true;
                return out;
            }),
            demo_keys: soInlineDemoKeys,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: soAuthEmail()
        };

        try {
            await db.collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set(payload, { merge: true });
            soConfig = Object.assign({}, soConfig, payload);
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

    window.soUpdateLicensePlanHint = function() {
        const sel = document.getElementById('so-license-plan');
        const hint = document.getElementById('so-license-plan-hint');
        if (!sel || !hint) return;
        const opt = sel.options[sel.selectedIndex];
        const days = opt ? parseInt(opt.getAttribute('data-days'), 10) || 30 : 30;
        hint.textContent = `Expiry starts when customer activates: ${days} days from activation date.`;
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
        const payload = {
            active: true,
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
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
            document.getElementById('so-license-key-input').value = '';
            document.getElementById('so-license-customer-name').value = '';
            document.getElementById('so-license-customer-phone').value = '';
            document.getElementById('so-license-customer-email').value = '';
            document.getElementById('so-license-support-notes').value = '';
            await soLoadLicenses();
            renderSoLicensesList();
            soToast(`License ${key} created. Send to customer on WhatsApp.`);
        } catch (e) {
            soToast('Create failed: ' + (e.message || 'Unknown error'));
        }
    };

    function renderSoLicensesList() {
        const container = document.getElementById('so-licenses-list');
        if (!container) return;
        const q = String(document.getElementById('so-license-search')?.value || '').trim().toLowerCase();
        const filtered = soLicenses.filter(lic => {
            if (!q) return true;
            const hay = [lic.key, lic.machineId, lic.planId, lic.planType, lic.customer_name, lic.customer_phone, lic.customer_email]
                .filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
        if (!filtered.length) {
            container.innerHTML = '<p class="so-admin-muted">No licenses found.</p>';
            return;
        }
        container.innerHTML = filtered.map(lic => {
            const active = lic.active !== false;
            const activated = !!(lic.activatedAt && String(lic.activatedAt).trim()) || !!(lic.machineId && String(lic.machineId).trim());
            const expired = soIsLicenseExpired(lic);
            const activatedLabel = activated
                ? `Activated: ${soEsc(soFormatTs(lic.activatedAt))}`
                : 'Not activated yet';
            return `<div class="so-license-row">
                <div class="so-license-head">
                    <code>${soEsc(lic.key)}</code>
                    <span class="so-badge ${active ? 'so-badge--on' : 'so-badge--off'}">${active ? 'Active' : 'Revoked'}</span>
                    <span class="so-badge ${activated ? 'so-badge--on' : ''}">${activated ? 'Activated' : 'Pending'}</span>
                    ${expired ? '<span class="so-badge so-badge--off">Expired</span>' : ''}
                </div>
                <div class="so-license-meta so-admin-muted">
                    Plan: ${soEsc(lic.planId || lic.planType || '—')} (${lic.planDays || '?'}d)
                    · ${activatedLabel}
                    · Expires: ${soEsc(soFormatExpiry(lic))}
                    · Device: ${soEsc(lic.machineId || '—')}
                </div>
                <div class="so-license-meta so-admin-muted">
                    ${lic.customer_name ? soEsc(lic.customer_name) + ' · ' : ''}${lic.customer_phone ? soEsc(lic.customer_phone) + ' · ' : ''}${lic.customer_email ? soEsc(lic.customer_email) : ''}
                </div>
                ${lic.support_notes ? `<div class="so-license-notes">${soEsc(lic.support_notes)}</div>` : ''}
                <div class="so-list-actions">
                    <button type="button" class="so-btn-sm" onclick="toggleSoLicenseActive('${soAttr(lic.key)}', ${active})">${active ? 'Revoke' : 'Activate'}</button>
                    <button type="button" class="so-btn-sm" onclick="resetSoLicenseDevice('${soAttr(lic.key)}')" ${activated ? '' : 'disabled'}>Reset device</button>
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
        if (!soRequireSuperAdmin()) return;
        if (!confirm(`Reset device binding for ${key}? Customer can activate on a new PC.`)) return;
        try {
            await db.collection(SO_LICENSE_COL).doc(key).set({
                machineId: '',
                activatedAt: ''
            }, { merge: true });
            await soLoadLicenses();
            renderSoLicensesList();
            soToast('Device reset. Expiry will restart on next activation if not yet activated.');
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
            renderSoDemoKeysList();
            renderSoLicensesList();
            switchShippingOptimizerTab(soActiveTab);
            soLoaded = true;
        } catch (e) {
            soToast('Load failed: ' + (e.message || 'Unknown error'));
        }
    };
})();
