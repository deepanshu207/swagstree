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
    const SO_GOOGLE_TRIALS_COL = 'shipping_optimizer_google_trials';
    const SO_GOOGLE_TRIALS_LEGACY_COL = 'google_trials';
    const SO_LICENSE_MAX = 200;
    const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    const DEFAULT_MIN_VERSION = '1.7.2';

    /** Pinned extension ID (manifest key in meesho-shipping-optimizer-extension) — stable across sideload updates. */
    const SO_PINNED_EXTENSION_ID = 'ibeijdggldhedpioahdjkhpcpmgieoch';
    const SO_OAUTH_CHROME_CLIENT_ID = '860976240598-lfncv478meb0hel45vr3elf8fu5muv17.apps.googleusercontent.com';
    const SO_OAUTH_WEB_CLIENT_ID = '860976240598-9djjnlud57s4fv0aul9eqdi2o8a11vr0.apps.googleusercontent.com';

    /** Default monthly plan price (INR). */
    const SO_DEFAULT_MONTHLY_PRICE = 199;
    /** Base credits per month — monthly grant and multi-month volume rate. */
    const SO_CREDIT_VOLUME_RATE = 200;
    /** Included credits on the monthly plan (= SO_CREDIT_VOLUME_RATE). */
    const SO_CREDIT_MONTHLY_GRANT = 200;
    /** Base ₹/credit for add-on % off badges and standalone credit packs (must be defined before default plan builders). */
    const SO_BASE_CREDIT_PRICE = 2;

    /**
     * Price discounts per tier (credits stay at 200×months unless creditsPct is set).
     * Quarterly: ₹199×3−₹48 = ₹549 (~8% off ₹597). Credits: 200×3 = 600.
     */
    const SO_PLAN_TIER_DISCOUNTS = {
        monthly: { pricePct: 0, creditsPct: 0, flatPriceOff: 0 },
        quarterly: { pricePct: 0, creditsPct: 0, flatPriceOff: 48 },
        halfyearly: { pricePct: 12.5, creditsPct: 0, flatPriceOff: 0 },
        yearly: { pricePct: 17, creditsPct: 0, flatPriceOff: 0 }
    };

    function soPlanMonths(planId, days) {
        const id = String(planId || '').toLowerCase();
        const d = Math.max(0, parseInt(days, 10) || 0);
        if (id === 'monthly' || d === 30) return 1;
        if (id === 'quarterly' || d === 90) return 3;
        if (id === 'halfyearly' || d === 180) return 6;
        if (id === 'yearly' || d === 365) return 12;
        return d > 0 ? d / 30 : 1;
    }

    function soPlanTierKey(planId, days) {
        const id = String(planId || '').toLowerCase();
        const d = parseInt(days, 10) || 0;
        if (id === 'monthly' || d === 30) return 'monthly';
        if (id === 'quarterly' || d === 90) return 'quarterly';
        if (id === 'halfyearly' || d === 180) return 'halfyearly';
        if (id === 'yearly' || d === 365) return 'yearly';
        return '';
    }

    function soFullPrice(months) {
        return SO_DEFAULT_MONTHLY_PRICE * months;
    }

    function soFullCredits(months) {
        return SO_CREDIT_VOLUME_RATE * months;
    }

    function soCalcDefaultPlanPrice(planId, days) {
        const tier = soPlanTierKey(planId, days);
        const months = soPlanMonths(planId, days);
        if (tier && SO_PLAN_TIER_DISCOUNTS[tier]) {
            const t = SO_PLAN_TIER_DISCOUNTS[tier];
            if (t.flatPriceOff > 0) return soFullPrice(months) - t.flatPriceOff;
            if (t.pricePct > 0) {
                const raw = soFullPrice(months) * (1 - t.pricePct / 100);
                return tier === 'yearly' ? Math.round(raw / 10) * 10 : Math.round(raw);
            }
            return SO_DEFAULT_MONTHLY_PRICE;
        }
        const discountPct = Math.min(20, Math.max(0, Math.round((months - 1) * 5)));
        return Math.max(SO_DEFAULT_MONTHLY_PRICE, Math.round(soFullPrice(months) * (1 - discountPct / 100)));
    }

    function soPlanPriceDiscount(planId, days, price) {
        const months = soPlanMonths(planId, days);
        if (months <= 1) return { full: SO_DEFAULT_MONTHLY_PRICE, actual: SO_DEFAULT_MONTHLY_PRICE, save: 0, pct: 0 };
        const full = soFullPrice(months);
        const actual = parseInt(price, 10);
        const resolved = Number.isFinite(actual) && actual > 0 ? actual : soCalcDefaultPlanPrice(planId, days);
        const save = Math.max(0, full - resolved);
        const pct = full > 0 && save > 0 ? Math.round((save / full) * 1000) / 10 : 0;
        return { full, actual: resolved, save, pct };
    }

    function soDefaultPlanSaveBadge(planId, days, price) {
        return soFormatSaveBadge(planId, days, price);
    }

    function soExplainPlanDiscount(planId, days, price) {
        const { full, actual, save, pct } = soPlanPriceDiscount(planId, days, price);
        if (save <= 0) return '';
        return `${pct}% off ₹${full.toLocaleString('en-IN')} → ₹${actual.toLocaleString('en-IN')} (save ₹${save.toLocaleString('en-IN')})`;
    }

    function soExplainPlanPriceFormula(planId, days) {
        const tier = soPlanTierKey(planId, days);
        const d = parseInt(days, 10) || 0;
        const price = soCalcDefaultPlanPrice(planId, d);
        if (tier === 'monthly' || d === 30) return `₹${SO_DEFAULT_MONTHLY_PRICE} / month`;
        if (tier === 'quarterly' || d === 90) {
            const disc = soExplainPlanDiscount('quarterly', 90, price);
            return `₹${SO_DEFAULT_MONTHLY_PRICE}×3−₹48 = ₹${price}${disc ? ` · ${disc}` : ''}`;
        }
        if (tier === 'halfyearly' || d === 180) {
            const disc = soExplainPlanDiscount('halfyearly', 180, price);
            return `₹${SO_DEFAULT_MONTHLY_PRICE}×6×(1−12.5%) = ₹${price}${disc ? ` · ${disc}` : ''}`;
        }
        if (tier === 'yearly' || d === 365) {
            const disc = soExplainPlanDiscount('yearly', 365, price);
            return `₹${SO_DEFAULT_MONTHLY_PRICE}×12×(1−17%) ≈ ₹${price}${disc ? ` · ${disc}` : ''}`;
        }
        return `₹${price}`;
    }

    function soCalcDefaultPlanCredits(planId, days) {
        const months = soPlanMonths(planId, days);
        const tier = soPlanTierKey(planId, days);
        if (months <= 1) return SO_CREDIT_MONTHLY_GRANT;
        const tierDisc = tier && SO_PLAN_TIER_DISCOUNTS[tier] ? SO_PLAN_TIER_DISCOUNTS[tier].creditsPct : 0;
        if (tierDisc > 0) return Math.round(soFullCredits(months) * (1 - tierDisc / 100));
        return Math.round(soFullCredits(months));
    }

    function soExplainPlanCreditsFormula(planId, days) {
        const months = soPlanMonths(planId, days);
        const credits = soCalcDefaultPlanCredits(planId, days);
        if (months <= 1) return `${SO_CREDIT_MONTHLY_GRANT} credits (${SO_CREDIT_VOLUME_RATE}/mo monthly grant)`;
        const tier = soPlanTierKey(planId, days);
        const tierDisc = tier && SO_PLAN_TIER_DISCOUNTS[tier] ? SO_PLAN_TIER_DISCOUNTS[tier].creditsPct : 0;
        if (tierDisc > 0) {
            return `${SO_CREDIT_VOLUME_RATE}×${months}×(1−${tierDisc}%) = ${credits} credits`;
        }
        return `${SO_CREDIT_VOLUME_RATE}×${months} = ${credits} credits`;
    }

    /** Customer-facing plan card line (price is shown separately on the card). */
    function soPlanCardSubtitle(_price, days, credits) {
        const c = parseInt(credits, 10) || 0;
        const d = parseInt(days, 10) || 0;
        let duration = '';
        if (d === 30) duration = '30 days';
        else if (d === 90) duration = '90 days';
        else if (d === 180) duration = '180 days';
        else if (d === 365) duration = '1 year';
        else if (d > 0) duration = `${d} days`;
        return `${duration} · ${c.toLocaleString('en-IN')} credits`;
    }

    /** Customer-facing detail subtitle (price shown separately on card). */
    function soPlanDetailSubtitle(days, credits) {
        const c = parseInt(credits, 10) || 0;
        const d = parseInt(days, 10) || 0;
        let duration = '';
        if (d === 30) duration = '30 days';
        else if (d === 90) duration = '90 days';
        else if (d === 180) duration = '180 days';
        else if (d === 365) duration = '1 year';
        else if (d > 0) duration = `${d} days`;
        return `${duration} · ${c.toLocaleString('en-IN')} credits`;
    }

    function soFormatSaveBadge(planId, days, price) {
        const { save, pct } = soPlanPriceDiscount(planId, days, price);
        const roundedSave = Math.round(save);
        if (roundedSave <= 0) return '';
        return pct > 0
            ? `Save ₹${roundedSave.toLocaleString('en-IN')} (${pct}% off)`
            : `Save ₹${roundedSave.toLocaleString('en-IN')}`;
    }

    /** % off vs ₹2/credit base for add-on badge defaults. */
    function soAddonPctOffLabel(credits, price, basePpc) {
        const cr = Math.max(1, parseInt(credits, 10) || 1);
        const pr = Math.max(0, parseInt(price, 10) || 0);
        const base = Number(basePpc) || SO_BASE_CREDIT_PRICE;
        if (!pr || !cr) return '';
        const ppc = pr / cr;
        if (ppc < base * 0.99) {
            const pct = Math.round((1 - ppc / base) * 100);
            if (pct > 0) return `${pct}% off`;
        }
        return '';
    }

    /** Built-in credit add-on with customer-facing subtitle (shown under plan in extension). */
    function soDefaultCreditAddon(id, credits, price, extra) {
        const ex = extra || {};
        const cr = Math.max(1, parseInt(credits, 10) || 1);
        const pr = Math.max(0, parseInt(price, 10) || 0);
        const perCredit = pr > 0 && cr > 0 ? (pr / cr).toFixed(2) : '';
        const pctBadge = soAddonPctOffLabel(cr, pr);
        const defaultBadges = ex.offer_badges || [
            ...(pctBadge ? [pctBadge] : []),
            `+${cr}`
        ].filter(Boolean);
        return soNormalizeCreditAddon({
            id,
            credits: cr,
            price: pr,
            label: ex.label || `+${cr} credits`,
            card_subtitle: ex.card_subtitle || `${cr} credits · ₹${pr}`,
            description: ex.description || (perCredit
                ? `Add ${cr} credits at checkout — ₹${pr} total (₹${perCredit}/credit). Stacks on your plan included credits.`
                : `Add ${cr} credits at checkout — stacks on plan included credits.`),
            offer_badges: defaultBadges,
            save: ex.save,
            best: ex.best,
            name: ex.name,
            active: ex.active !== false,
            default_selected: ex.default_selected === true,
            order: ex.order != null ? ex.order : 0
        }, ex.order || 0);
    }

    const DEFAULT_ADDON_CATALOG = [
        soDefaultCreditAddon('addon_10', 10, 20, {
            order: 0,
            offer_badges: ['+10'],
            description: 'Quick boost — 10 extra generation runs added at checkout. Stacks on plan included credits.',
            card_subtitle: '10 credits · ₹20'
        }),
        soDefaultCreditAddon('addon_25', 25, 40, {
            order: 1,
            offer_badges: ['Popular', '20% off', '+25'],
            description: 'Better value — 25 extra credits at checkout (₹1.60/credit vs ₹2 base).',
            card_subtitle: '25 credits · ₹40'
        }),
        soDefaultCreditAddon('addon_50', 50, 70, {
            order: 2,
            offer_badges: ['30% off', '+50'],
            save: 'Save ₹30 vs 5×10',
            description: 'Add 50 credits at checkout — best mid-tier value (₹1.40/credit).',
            card_subtitle: '50 credits · ₹70'
        }),
        soDefaultCreditAddon('addon_100', 100, 170, {
            order: 3,
            offer_badges: ['Best value', '15% off', '+100'],
            save: 'Save ₹30 vs pack rate',
            best: true,
            description: 'Largest add-on pack — lowest ₹/credit for subscription checkout top-ups.',
            card_subtitle: '100 credits · best value'
        })
    ];

    function soCloneDefaultPlanAddons() {
        return soDeepClone(DEFAULT_ADDON_CATALOG);
    }

    function soBuildDefaultPlans() {
        const mk = (plan) => Object.assign({ active: true, show_whatsapp_icon: true, show_details_icon: true, cta_text: 'Buy via WhatsApp', card_hint: 'Tap ℹ️ for details · Tap card for WhatsApp' }, plan);
        const qPrice = soCalcDefaultPlanPrice('quarterly', 90);
        const hPrice = soCalcDefaultPlanPrice('halfyearly', 180);
        const yPrice = soCalcDefaultPlanPrice('yearly', 365);
        const qCredits = soCalcDefaultPlanCredits('quarterly', 90);
        const hCredits = soCalcDefaultPlanCredits('halfyearly', 180);
        const yCredits = soCalcDefaultPlanCredits('yearly', 365);
        const qDisc = soExplainPlanDiscount('quarterly', 90, qPrice);
        const hDisc = soExplainPlanDiscount('halfyearly', 180, hPrice);
        const yDisc = soExplainPlanDiscount('yearly', 365, yPrice);
        return [
            mk({
                id: 'monthly', name: 'Monthly', price: SO_DEFAULT_MONTHLY_PRICE, days: 30, duration: '1 Month',
                unlimited_devices: true, max_devices: 0, device_tier: 'standard', billing_mode: 'hybrid',
                included_credits: soCalcDefaultPlanCredits('monthly', 30),
                allow_credit_addons: true,
                max_addon_selections: 0,
                credit_addons: soCloneDefaultPlanAddons(),
                offer_badges: ['Starter'],
                description: 'Try Smart Mode with live Meesho shipping checks — ideal for new sellers testing AI variant previews.',
                detail_subtitle: soPlanDetailSubtitle(30, soCalcDefaultPlanCredits('monthly', 30)),
                highlights: ['200 credits included', '30 days access', 'Smart Mode on Meesho'],
                features: [
                    { icon: '📅', title: '30 days access', text: 'Renews every month' },
                    { icon: '⚡', title: '200 credits', text: 'One credit = one AI generation run' },
                    { icon: '🚚', title: 'Smart Mode', text: 'Preview up to 200 variants per run' }
                ],
                detail_sections: [{
                    title: "What's included",
                    items: ['Smart Mode on Meesho catalog', 'Apply lowest-shipping variant to listing', 'Top up anytime with credit packs while your plan is active']
                }, {
                    title: 'Already on Monthly?',
                    body: 'Existing monthly customers can buy credit packs (⚡ BUY CREDITS) in the extension popup without changing plan.',
                    items: ['Credit packs stack on your license', 'Optional credit add-ons are in each plan\'s details (ℹ️)']
                }],
                card_subtitle: soPlanCardSubtitle(SO_DEFAULT_MONTHLY_PRICE, 30, soCalcDefaultPlanCredits('monthly', 30)),
                detail_footer: 'Credits deduct per generation run. Buy credit packs anytime from the popup while your plan is active.',
                order: 0
            }),
            mk({
                id: 'quarterly', name: '3 Months', price: qPrice, days: 90, duration: '3 Months',
                save: soFormatSaveBadge('quarterly', 90, qPrice), offer_badges: ['Popular', '8% off'],
                unlimited_devices: true, max_devices: 0, device_tier: 'standard', billing_mode: 'hybrid',
                included_credits: qCredits,
                allow_credit_addons: true,
                max_addon_selections: 0,
                credit_addons: soCloneDefaultPlanAddons(),
                description: 'Three months of Smart Mode — 600 credits with a lower price than paying monthly three times.',
                detail_subtitle: soPlanDetailSubtitle(90, qCredits),
                highlights: [`${qCredits.toLocaleString('en-IN')} credits`, '90 days access', 'Lower price vs monthly'],
                features: [
                    { icon: '📅', title: '90 days access', text: 'One payment, three months' },
                    { icon: '⚡', title: `${qCredits.toLocaleString('en-IN')} credits`, text: '200 credits per month equivalent' },
                    { icon: '💰', title: soFormatSaveBadge('quarterly', 90, qPrice) || 'Volume pricing', text: qDisc || `vs ₹${SO_DEFAULT_MONTHLY_PRICE}×3 = ₹${SO_DEFAULT_MONTHLY_PRICE * 3}` }
                ],
                detail_sections: [{
                    title: 'Plan summary',
                    body: `₹${qPrice.toLocaleString('en-IN')} for 90 days · ${qCredits.toLocaleString('en-IN')} credits included.${qDisc ? ` ${qDisc}.` : ''}`,
                    items: ['Unused credits stay until used', 'Credit packs available anytime']
                }],
                card_subtitle: soPlanCardSubtitle(qPrice, 90, qCredits),
                detail_footer: 'Full 600-credit pack. Price discount applies to rupees only — credits stay at 200/month × 3.',
                order: 1
            }),
            mk({
                id: 'halfyearly', name: '6 Months', price: hPrice, days: 180, duration: '6 Months',
                save: soFormatSaveBadge('halfyearly', 180, hPrice), offer_badges: ['12.5% off'],
                unlimited_devices: true, max_devices: 0, device_tier: 'standard', billing_mode: 'hybrid',
                included_credits: hCredits,
                allow_credit_addons: true,
                max_addon_selections: 1,
                credit_addons: soCloneDefaultPlanAddons(),
                description: `Half-year access for serious Meesho sellers — ${hCredits.toLocaleString('en-IN')} credits with 12.5% price discount.`,
                detail_subtitle: soPlanDetailSubtitle(180, hCredits),
                highlights: [`${hCredits.toLocaleString('en-IN')} credits`, '180 days access', '12.5% off price'],
                features: [
                    { icon: '📅', title: '180 days access', text: 'Six months in one payment' },
                    { icon: '⚡', title: `${hCredits.toLocaleString('en-IN')} credits`, text: '200 credits per month equivalent' },
                    { icon: '📈', title: 'Best value', text: hDisc || 'Lower cost per credit than quarterly' }
                ],
                detail_sections: [{
                    title: 'Plan summary',
                    body: `₹${hPrice.toLocaleString('en-IN')} for 180 days · ${hCredits.toLocaleString('en-IN')} credits included.${hDisc ? ` ${hDisc}.` : ''}`,
                    items: ['Smart Mode up to 200 variants per run', 'Credit top-ups available']
                }],
                detail_footer: 'Price discount applies to rupees only — credits stay at 200/month × 6.',
                card_subtitle: soPlanCardSubtitle(hPrice, 180, hCredits),
                order: 2
            }),
            mk({
                id: 'yearly', name: 'Yearly', price: yPrice, days: 365, duration: '1 Year',
                save: soFormatSaveBadge('yearly', 365, yPrice), best: true, offer_badges: ['Best deal', '17% off'],
                unlimited_devices: true, max_devices: 0, device_tier: 'standard', billing_mode: 'hybrid',
                included_credits: yCredits,
                allow_credit_addons: true, max_addon_selections: 2,
                credit_addons: soCloneDefaultPlanAddons(),
                description: `Best for full-time Meesho sellers — one year access with ${yCredits.toLocaleString('en-IN')} credits.`,
                detail_subtitle: soPlanDetailSubtitle(365, yCredits),
                highlights: [`${yCredits.toLocaleString('en-IN')} credits`, '1 year access', 'BEST VALUE'],
                features: [
                    { icon: '📅', title: '1 year access', text: 'Single annual payment' },
                    { icon: '⚡', title: `${yCredits.toLocaleString('en-IN')} credits`, text: '200 credits per month equivalent' },
                    { icon: '🚚', title: 'Smart Mode', text: 'Use credits across the full year' }
                ],
                detail_sections: [
                    { title: "What's included", items: ['Live Meesho shipping on all variants', 'Apply best image to catalog', 'Credit packs anytime'] },
                    { title: 'Plan summary', body: `₹${yPrice.toLocaleString('en-IN')} for 1 year · ${yCredits.toLocaleString('en-IN')} credits included.${yDisc ? ` ${yDisc}.` : ''}`, items: [] }
                ],
                card_subtitle: soPlanCardSubtitle(yPrice, 365, yCredits),
                detail_footer: 'Optional add-ons are selected in plan details before WhatsApp checkout.',
                order: 3
            })
        ];
    }

    function soSafeBuildDefaultPlans() {
        try {
            return soBuildDefaultPlans();
        } catch (err) {
            console.error('[Shipping Optimizer] Default plans init failed:', err);
            return [
                { id: 'monthly', name: 'Monthly', price: SO_DEFAULT_MONTHLY_PRICE, days: 30, duration: '1 Month', included_credits: SO_CREDIT_MONTHLY_GRANT, active: true, order: 0 },
                { id: 'quarterly', name: '3 Months', price: 549, days: 90, duration: '3 Months', included_credits: 600, active: true, order: 1 },
                { id: 'halfyearly', name: '6 Months', price: 1045, days: 180, duration: '6 Months', included_credits: 1200, active: true, order: 2 },
                { id: 'yearly', name: 'Yearly', price: 1980, days: 365, duration: '1 Year', included_credits: 2400, best: true, active: true, order: 3 }
            ];
        }
    }

    function soGetDefaultPlansCopy() {
        const src = DEFAULT_PLANS.length ? DEFAULT_PLANS : soSafeBuildDefaultPlans();
        return soDeepClone(src);
    }

    const DEFAULT_PLANS = soSafeBuildDefaultPlans();

    const SO_DEFAULT_LICENSE_PLAN_ID = 'monthly';

    /** Fallback included credits when plan doc omits included_credits (extension reads plan + license). */
    const PLAN_DEFAULT_INCLUDED_CREDITS = {
        monthly: 200,
        quarterly: 600,
        halfyearly: 1200,
        yearly: 2400,
        family_yearly: 3600,
        friends_yearly: 4800,
        lifetime: 5000,
        credits_starter: 50
    };

    /** @deprecated Use soCalcDefaultPlanCredits — kept for custom-day fallback. */
    function soSuggestCreditsForPlanDays(days) {
        return soCalcDefaultPlanCredits('', days);
    }

    const DEFAULT_INLINE_DEMO_KEYS = {
        'MEESHO-DEMOFREE': { days: 30, label: 'Free trial' }
    };

    const DEFAULT_CREDITS = {
        enabled: true,
        price_per_credit: SO_BASE_CREDIT_PRICE,
        min_purchase: 10,
        cost_per_operation: 1
    };

    const DEFAULT_IMAGE_GENERATION = {
        enabled: true,
        credits_per_image: 1,
        daily_limit: 0,
        monthly_limit: 0,
        max_batch_size: 200,
        stop_billing_mode: 'full',
        stop_billing_min_charge: 0,
        stop_billing_round_decimals: 2,
        stop_billing_full_on_complete: true
    };

    const SO_STOP_BILLING_MODES = ['full', 'proportional'];

    const DEFAULT_SMART_MODE = {
        variant_options: [
            { value: 20, label: '20 variants', active: true, order: 0 },
            { value: 50, label: '50 variants', active: true, order: 1 },
            { value: 100, label: '100 variants', active: true, order: 2 },
            { value: 200, label: '200 variants', active: true, order: 3 }
        ],
        default_variant: 20,
        max_variants_cap: 200,
        label: 'Max Variants',
        hint: 'Live Meesho shipping checks — finds the lowest ₹ from generated variants'
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
        {
            id: 'pack_10', credits: 10, price: 20, label: '10 Credits', active: true, order: 0,
            description: 'Quick top-up for a few Smart Mode runs — instant delivery after payment.',
            detail_subtitle: '10 generation runs',
            highlights: ['Instant delivery', 'No expiry'],
            features: [
                { icon: '⚡', title: '10 credits', text: '≈10 upload → variant runs' },
                { icon: '💬', title: 'WhatsApp checkout', text: 'Pay via UPI and get key' }
            ],
            detail_sections: [{ title: 'How it works', items: ['Credits stack on your license', 'Deducted per generation run', 'Works with hybrid plans'] }],
            card_subtitle: '10 credits · ₹20',
            cta_text: 'Buy via WhatsApp'
        },
        {
            id: 'pack_20', credits: 20, price: 38, label: '20 Credits', active: true, order: 1,
            description: 'Slightly better ₹/credit than the 10-pack — good for a busy week of listings.',
            detail_subtitle: '20 generation runs · Save ₹2',
            highlights: ['5% savings', 'No expiry'],
            features: [{ icon: '⚡', title: '20 credits', text: 'Best for weekly sellers' }],
            card_subtitle: '20 credits · ₹38',
            cta_text: 'Buy 20 credits on WhatsApp'
        },
        {
            id: 'pack_50', credits: 50, price: 90, label: '50 Credits', active: true, order: 2,
            description: 'Mid-size pack for regular catalog updates — lower per-credit cost.',
            detail_subtitle: '50 runs · ₹1.80/credit',
            highlights: ['10% off vs 10-pack', 'Popular'],
            features: [{ icon: '📦', title: '50 credits', text: 'Enough for a month of active listing' }],
            card_subtitle: '50 credits · ₹90',
            cta_text: 'Buy via WhatsApp'
        },
        {
            id: 'pack_100', credits: 100, price: 170, label: '100 Credits', active: true, order: 3,
            description: 'Bulk top-up for power sellers — best value per credit in preset packs.',
            detail_subtitle: '100 runs · ₹1.70/credit',
            highlights: ['Best pack value', 'Stack with yearly plan'],
            features: [
                { icon: '🏆', title: '100 credits', text: 'Lowest ₹/credit in packs' },
                { icon: '➕', title: 'Stacks', text: 'Activate as second license key on same device' }
            ],
            detail_sections: [{ title: 'Tip', body: 'Yearly plan customers often buy this as a separate credit-top-up key.', items: [] }],
            card_subtitle: '100 credits · ₹170',
            cta_text: 'Buy 100 credits on WhatsApp',
            offer_badges: ['Best value']
        }
    ];

    const SO_EXPORT_VERSION = 1;

    function soDeepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function soGetDefaultAppSeed() {
        return {
            whatsapp_number: '919654414891',
            whatsapp_message: 'Hi! I want to purchase Shipping Optimizer license.',
            extension_enabled: true,
            min_extension_version: DEFAULT_MIN_VERSION,
            announcement: '',
            plans: soDeepClone(DEFAULT_PLANS),
            support: soDeepClone(DEFAULT_SUPPORT),
            demo_keys: soDeepClone(DEFAULT_INLINE_DEMO_KEYS),
            credits: Object.assign({}, DEFAULT_CREDITS, {
                packs: soDeepClone(DEFAULT_CREDIT_PACKS),
                addon_catalog: soDeepClone(DEFAULT_ADDON_CATALOG),
                image_generation: soDeepClone(DEFAULT_IMAGE_GENERATION)
            }),
            smart_mode: soDeepClone(DEFAULT_SMART_MODE),
            google_trial: soDeepClone(DEFAULT_GOOGLE_TRIAL)
        };
    }

    const DEFAULT_GOOGLE_TRIAL = {
        google_login_enabled: true,
        enabled: true,
        unlimited_time: true,
        days: 0,
        trial_credits: 3,
        image_run_limit: 3,
        max_increment_per_run: 10,
        max_devices: 1,
        label: 'Google free trial',
        oauth_client_id: SO_OAUTH_CHROME_CLIENT_ID,
        oauth_web_client_id: SO_OAUTH_WEB_CLIENT_ID,
        chrome_extension_id: SO_PINNED_EXTENSION_ID
    };

    const SO_GOOGLE_TRIAL_LEGACY_FIELDS = ['function_url', 'credits'];

    function soGoogleTrialExtensionId(trial) {
        const id = String(trial?.chrome_extension_id || trial?.chromeExtensionId || DEFAULT_GOOGLE_TRIAL.chrome_extension_id || '').trim();
        return id || DEFAULT_GOOGLE_TRIAL.chrome_extension_id;
    }

    function soGoogleTrialRedirectUri(trial) {
        return `https://${soGoogleTrialExtensionId(trial)}.chromiumapp.org/`;
    }

    function soResolveTrialCredits(src) {
        const raw = src && typeof src === 'object' ? src : {};
        const trialCredits = parseInt(raw.trial_credits ?? raw.trialCredits, 10);
        if (Number.isFinite(trialCredits) && trialCredits >= 0) return trialCredits;
        const imageRun = parseInt(raw.image_run_limit ?? raw.imageRunLimit, 10);
        if (Number.isFinite(imageRun) && imageRun >= 0) return imageRun;
        const credits = parseInt(raw.credits, 10);
        if (Number.isFinite(credits) && credits >= 0) return credits;
        return DEFAULT_GOOGLE_TRIAL.trial_credits;
    }

    const SO_DEVICE_TIER_MAX = { standard: 0, family: 3, friends: 5, unlimited: 0 };
    const SO_BILLING_MODES = ['subscription', 'credits', 'hybrid'];
    const SO_DEVICE_TIERS = ['standard', 'family', 'friends', 'unlimited'];

    const SO_PLAN_PRESETS = {
        monthly: {
            id: 'monthly', name: 'Monthly', price: SO_DEFAULT_MONTHLY_PRICE, days: 30, duration: '1 Month',
            max_devices: 0, device_tier: 'standard', billing_mode: 'hybrid', included_credits: 200,
            unlimited_devices: true, allow_credit_addons: true, active: true
        },
        family_yearly: {
            id: 'family_yearly', name: 'Family Yearly', price: 4999, days: 365, duration: '1 Year',
            max_devices: 3, device_tier: 'family', billing_mode: 'hybrid', included_credits: 3600, active: true
        },
        friends_yearly: {
            id: 'friends_yearly', name: 'Friends Yearly', price: 6999, days: 365, duration: '1 Year',
            max_devices: 5, device_tier: 'friends', billing_mode: 'hybrid', included_credits: 4800, active: true
        },
        lifetime: {
            id: 'lifetime', name: 'Lifetime', price: 9999, days: 0, duration: 'Forever',
            unlimited_time: true, plan_kind: 'lifetime', max_devices: 1, billing_mode: 'hybrid',
            included_credits: 5000, active: true
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

    function soIsConfigEmpty(cfg) {
        if (!cfg || typeof cfg !== 'object') return true;
        const keys = Object.keys(cfg).filter(k => !['updatedAt', 'updatedBy'].includes(k));
        if (!keys.length) return true;
        const hasPlans = Array.isArray(cfg.plans) && cfg.plans.length > 0;
        const hasGeneral = !!(cfg.whatsapp_number || cfg.min_extension_version || cfg.extension_enabled != null);
        const hasCredits = cfg.credits && typeof cfg.credits === 'object' && Object.keys(cfg.credits).length > 0;
        const hasGoogleTrial = cfg.google_trial && typeof cfg.google_trial === 'object' && Object.keys(cfg.google_trial).length > 0;
        return !hasPlans && !hasGeneral && !hasCredits && !hasGoogleTrial;
    }

    function soApplySeedSectionToState(seed, section) {
        const s = seed || soGetDefaultAppSeed();
        if (section === 'config' || section === 'all') {
            soConfig = Object.assign({}, soConfig || {}, {
                whatsapp_number: s.whatsapp_number,
                whatsapp_message: s.whatsapp_message,
                extension_enabled: s.extension_enabled,
                min_extension_version: s.min_extension_version,
                announcement: s.announcement,
                plans: soDeepClone(s.plans),
                support: soDeepClone(s.support),
                demo_keys: soDeepClone(s.demo_keys)
            });
            soPlans = soSortPlans(soConfig.plans.map(soNormalizePlan));
            soPlans.forEach((p, i) => { p.order = i; });
            soInlineDemoKeys = Object.assign({}, soConfig.demo_keys);
            soSyncInlineDemoRowsFromObject();
            soSupport = soNormalizeSupport(soConfig.support);
        }
        if (section === 'credits' || section === 'all') {
            const rawCredits = s.credits && typeof s.credits === 'object' ? s.credits : {};
            soCredits = Object.assign({}, DEFAULT_CREDITS, rawCredits);
            const rawCatalog = Array.isArray(rawCredits.addon_catalog) && rawCredits.addon_catalog.length
                ? rawCredits.addon_catalog
                : DEFAULT_ADDON_CATALOG.slice();
            soCredits.addon_catalog = soSortCreditAddons(rawCatalog.map(soNormalizeCreditAddon));
            const rawPacks = soResolveCreditPacksFromConfig(rawCredits, DEFAULT_CREDIT_PACKS);
            soCreditPacks = soSortCreditPacks(rawPacks.map(soNormalizeCreditPack));
            soCreditPacks.forEach((p, i) => { p.order = i; });
            soSmartMode = soNormalizeSmartMode(s.smart_mode || DEFAULT_SMART_MODE);
            soConfig = Object.assign({}, soConfig || {}, {
                credits: Object.assign({}, soCredits, { packs: soCreditPacks.slice() }),
                smart_mode: soSmartMode
            });
        }
        if (section === 'google-trial' || section === 'all') {
            const trial = soGoogleTrialToFirestore(s.google_trial || DEFAULT_GOOGLE_TRIAL);
            soConfig = Object.assign({}, soConfig || {}, { google_trial: trial });
        }
    }

    function soRefreshFormsAfterSeed(section) {
        soHydrating = true;
        if (section === 'config' || section === 'all') {
            soBindConfigForm();
            soBindSupportForm();
            renderSoPlansEditor();
            renderSoInlineDemoKeysEditor();
            soPopulateLicensePlanSelect();
        }
        if (section === 'credits' || section === 'all') {
            soBindCreditsForm();
            soBindImageGenerationForm();
            soBindSmartModeForm();
            renderSoCreditPacksEditor();
            renderSoAddonCatalogEditor();
            soUpdateCustomCreditCalc();
        }
        if (section === 'google-trial' || section === 'all') {
            soBindGoogleTrialForm();
        }
        if (section === 'config' || section === 'credits' || section === 'all') {
            renderSoExtensionPreview();
        }
        soHydrating = false;
        if (section === 'config' || section === 'all') soMarkTabDirty('config');
        if (section === 'credits' || section === 'all') soMarkTabDirty('credits');
    }

    window.soLoadDefaultsForTab = async function(tab) {
        const shortLicenseReset = tab === 'licenses';
        const ok = await soConfirmActionPreviewModal({
            title: shortLicenseReset ? 'Reset license form' : 'Load built-in defaults → form only',
            bodyHtml: shortLicenseReset
                ? '<p>Clear the create/edit form and start fresh.</p><p class="so-admin-muted"><strong>Safe:</strong> Does not write Firebase. Saved licenses are not changed.</p>'
                : soBuildLoadDefaultsPreviewHtml(tab),
            confirmLabel: shortLicenseReset ? 'Reset form' : 'Load into form (no Firebase)',
            dangerous: false
        });
        if (!ok) return;
        soApplyLoadDefaultsForTab(tab);
        if (shortLicenseReset) openSoLicenseCreateForm({ reset: false });
    };

    window.openSoLicenseCreateForm = function(options) {
        const opts = options || {};
        switchShippingOptimizerTab('licenses');
        if (opts.reset) cancelSoLicenseEdit();
        soOpenLicenseCreateAccordion({ scroll: true });
        if (opts.toast !== false) {
            soToast(soEditingLicenseKey ? 'License form open — scroll up to edit.' : 'Create license form open.');
        }
    };

    window.soViewAllDefaults = function() {
        switchShippingOptimizerTab('defaults');
        renderSoDefaultsSummary();
        const panel = document.getElementById('so-default-seed-json');
        if (panel) {
            panel.hidden = false;
            panel.textContent = JSON.stringify(soGetDefaultAppSeed(), null, 2);
        }
    };

    window.renderSoDefaultsSummary = function() {
        const root = document.getElementById('so-defaults-summary-root');
        if (!root) return;
        const seed = soGetDefaultAppSeed();
        const plans = (seed.plans || []).map((p, i) => soNormalizePlan(p, i));
        const packs = (seed.credits?.packs || []).map((p, i) => soNormalizeCreditPack(p, i));
        const addonCatalog = (seed.credits?.addon_catalog || DEFAULT_ADDON_CATALOG).map((a, i) => soNormalizeCreditAddon(a, i));
        const trial = soNormalizeGoogleTrial(seed.google_trial || DEFAULT_GOOGLE_TRIAL);

        const plansHtml = plans.map(p => {
            const badges = [...(p.offer_badges || []), p.best ? 'BEST VALUE' : '', p.save || ''].filter(Boolean);
            const badgeHtml = badges.length
                ? `<div class="so-defaults-badges">${badges.map(b => `<span class="so-defaults-badge">${soEsc(b)}</span>`).join('')}</div>`
                : '';
            const featCount = (p.features || []).length;
            const secCount = (p.detail_sections || []).length;
            return `<div class="so-defaults-plan-card">
                <div class="so-defaults-plan-head">
                    <strong>${soEsc(p.name)}</strong>
                    <span class="so-defaults-price">₹${(p.price || 0).toLocaleString('en-IN')}</span>
                </div>
                ${badgeHtml}
                <div class="so-defaults-plan-meta">
                    <span><code>${soEsc(p.id)}</code></span>
                    <span>${soEsc(p.duration || p.days + 'd')}</span>
                    <span>${soEsc(p.billing_mode)}</span>
                </div>
                <div class="so-defaults-credits-formula"><strong>₹${(p.price || 0).toLocaleString('en-IN')}</strong> · <strong>${p.included_credits || 0} credits</strong> — ${soEsc(soExplainPlanPriceFormula(p.id, p.days))} · ${soEsc(soExplainPlanCreditsFormula(p.id, p.days))}${p.days > 30 ? ` · ${soEsc(soExplainPlanDiscount(p.id, p.days, p.price) || '')}` : ''}</div>
                <div class="so-defaults-mini"><strong>Card:</strong> ${soEsc(p.card_subtitle || '')}</div>
                <p class="so-admin-muted">${soEsc(p.description || '')}</p>
                <div class="so-defaults-field-counts">${featCount} features · ${(p.highlights || []).length} highlights · ${secCount} detail sections</div>
            </div>`;
        }).join('');

        const catalogHtml = addonCatalog.map(a => {
            const badges = (a.offer_badges || []).map(b => `<span class="so-defaults-badge">${soEsc(b)}</span>`).join(' ');
            return `<div class="so-defaults-addon-row"><strong>${soEsc(a.label)}</strong> · ${soEsc(a.card_subtitle || `${a.credits} credits · ₹${a.price}`)}${badges ? ` · ${badges}` : ''}</div>`;
        }).join('');

        const planAddonsSummary = addonCatalog.length
            ? `<div class="so-defaults-section">
                <h5><i class="fa fa-plus-circle"></i> Shared add-on catalog (<code>credits.addon_catalog</code>)</h5>
                <p class="so-admin-muted">Per-plan <code>credit_addons[]</code> shown in plan detail (ℹ️). If empty, extension falls back to <code>credits.addon_catalog</code>. Bottom add-ons section uses the same resolved list.</p>
                <div class="so-defaults-addon-list">${catalogHtml}</div>
            </div>`
            : '';

        const packsHtml = packs.map(p => `
            <div class="so-defaults-pack-row">
                <strong>${soEsc(p.label)}</strong>
                <span>₹${p.price} · ${p.credits} cr</span>
                <span class="so-admin-muted">${soEsc(p.card_subtitle || '')}</span>
            </div>`).join('');

        root.innerHTML = `
            <div class="so-defaults-actions-help so-admin-muted so-admin-tip">
                <p><strong>Example — Load defaults on Config tab:</strong> You currently have custom plan text in Firebase. Tap <em>Load defaults</em> → forms show the cards below (nothing live yet) → review → <em>Save to Firebase</em> when ready.</p>
                <p><strong>Example — Seed all defaults:</strong> Immediately overwrites <code>shipping_optimizer_config/app</code> with everything below — use for first-time setup or factory reset. <em>Does not delete licenses or Google users.</em></p>
            </div>

            <div class="so-defaults-section">
                <h5><i class="fa fa-calculator"></i> Price &amp; credit formulas (built-in)</h5>
                <div class="so-defaults-formula-box">
                    <div><strong>Monthly:</strong> ₹${SO_DEFAULT_MONTHLY_PRICE} · <strong>${SO_CREDIT_MONTHLY_GRANT} credits</strong> (${SO_CREDIT_VOLUME_RATE}/mo)</div>
                    <div><strong>3 months:</strong> ${soExplainPlanPriceFormula('quarterly', 90)} · <strong>${soExplainPlanCreditsFormula('quarterly', 90)}</strong></div>
                    <div><strong>6 months:</strong> ${soExplainPlanPriceFormula('halfyearly', 180)} · <strong>${soExplainPlanCreditsFormula('halfyearly', 180)}</strong></div>
                    <div><strong>Yearly:</strong> ${soExplainPlanPriceFormula('yearly', 365)} · <strong>${soExplainPlanCreditsFormula('yearly', 365)}</strong></div>
                    <div class="so-admin-muted" style="margin-top:6px;">Price discounts are % off (monthly price × months). Credits = ${SO_CREDIT_VOLUME_RATE}×months unless you set <code>creditsPct</code> in tier config. Quarterly example: ₹549 vs ₹597 = ${soPlanPriceDiscount('quarterly', 90, soCalcDefaultPlanPrice('quarterly', 90)).pct}% off.</div>
                    <div class="so-admin-muted">Plans ship with per-plan add-ons (same as catalog by default). Customize each plan or use <strong>Copy from shared catalog</strong> on Config tab. Bottom add-ons section uses plan add-ons, then catalog fallback.</div>
                </div>
            </div>

            <div class="so-defaults-section">
                <h5><i class="fa fa-tags"></i> Plans (${plans.length}) — extension card + detail screen</h5>
                <div class="so-defaults-plans-grid">${plansHtml}</div>
            </div>

            ${planAddonsSummary ? `<div class="so-defaults-section">
                <h5><i class="fa fa-plus-circle"></i> Plan credit add-ons (checkout)</h5>
                <p class="so-admin-muted">Selected add-ons grant extra credits on license activation (<code>included_credits</code> + <code>addon_credits</code>). Customer name/phone/email stay on the license doc — not changed by plan defaults.</p>
                ${planAddonsSummary}
            </div>` : ''}

            <div class="so-defaults-section">
                <h5><i class="fa fa-id-card"></i> License ↔ customer mapping</h5>
                <p class="so-admin-muted">Create a license <strong>without</strong> customer details — it appears in <strong>License Customers</strong> as &quot;Unassigned&quot;. Add <code>customer_name</code>, <code>customer_phone</code>, <code>customer_email</code>, <code>customer_location</code>, and <code>customer_ip</code> anytime on <strong>Paid Licenses</strong>. Also tracks <code>shared_at</code> and <code>activatedAt</code>. Config/credits saves never delete license or customer records.</p>
            </div>

            <div class="so-defaults-section">
                <h5><i class="fa fa-clipboard-check"></i> Save review (Config &amp; Credits tabs)</h5>
                <p class="so-admin-muted">When you change plans, WhatsApp number, credit packs, etc., the yellow <strong>Unsaved changes</strong> banner appears. Tap <strong>Review</strong> to see a before/after summary in a modal, then <strong>Confirm &amp; save</strong> to write Firebase — or <strong>Cancel</strong> to go back. <strong>Save to Firebase</strong> also opens review when there are changes. License keys and Google users are <em>never</em> changed by this flow.</p>
            </div>

            <div class="so-defaults-section">
                <h5><i class="fa fa-coins"></i> Credits &amp; packs</h5>
                <p>₹${seed.credits?.price_per_credit}/credit · min ${seed.credits?.min_purchase} · ${seed.credits?.cost_per_operation} per operation · image gen ${seed.credits?.image_generation?.credits_per_image} credit/run</p>
                <div class="so-defaults-packs-list">${packsHtml}</div>
            </div>

            <div class="so-defaults-section">
                <h5><i class="fa fa-google"></i> Google trial defaults</h5>
                <p>${trial.trial_credits} trial credits · ${trial.unlimited_time ? 'no calendar expiry' : trial.days + ' days'} · ${trial.max_devices} device(s) · login ${trial.google_login_enabled ? 'on' : 'off'}</p>
            </div>

            <div class="so-defaults-section">
                <h5><i class="fa fa-key"></i> Demo key</h5>
                <p><code>MEESHO-DEMOFREE</code> — 30 days, label “Free trial”</p>
            </div>

            <details class="so-details-block" style="margin-top:12px;">
                <summary>Full seed JSON (read-only)</summary>
                <pre id="so-default-seed-json-inline" class="so-default-seed-json"></pre>
            </details>`;

        const jsonEl = document.getElementById('so-default-seed-json-inline');
        if (jsonEl) jsonEl.textContent = JSON.stringify(seed, null, 2);
    };

    window.soCopyAllDefaults = function() {
        const seed = soGetDefaultAppSeed();
        const text = JSON.stringify(seed, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => soToast('Default seed JSON copied.')).catch(() => soToast('Copy failed.'));
        } else {
            soToast('Clipboard not available.');
        }
    };

    function soGetAddonCatalogState() {
        const raw = (soCredits && soCredits.addon_catalog) || (soConfig?.credits && soConfig.credits.addon_catalog);
        if (Array.isArray(raw) && raw.length) {
            return soSortCreditAddons(raw.map((a, i) => soNormalizeCreditAddon(a, i)));
        }
        return soDeepClone(DEFAULT_ADDON_CATALOG);
    }

    function soSerializeAddonCatalog(fromDom) {
        const source = fromDom ? soReadAddonCatalogFromDom() : soGetAddonCatalogState();
        return source.map((a, i) => soCreditAddonToFirestore(a, i));
    }

    function soBuildCreditsPayloadFromDom(packOverrides) {
        const packsSource = soReadCreditPacksForSave(packOverrides);
        return Object.assign({}, soCredits || DEFAULT_CREDITS, {
            enabled: !!document.getElementById('so-credits-enabled')?.checked,
            price_per_credit: Math.max(0, parseInt(document.getElementById('so-credits-price-per')?.value, 10) || DEFAULT_CREDITS.price_per_credit),
            min_purchase: Math.max(1, parseInt(document.getElementById('so-credits-min-purchase')?.value, 10) || DEFAULT_CREDITS.min_purchase),
            cost_per_operation: Math.max(1, parseInt(document.getElementById('so-credits-cost-op')?.value, 10) || DEFAULT_CREDITS.cost_per_operation),
            image_generation: soReadImageGenerationFromDom(),
            pack_scopes_enabled: !!document.getElementById('so-pack-scopes-enabled')?.checked,
            addon_scopes_enabled: !!document.getElementById('so-addon-scopes-enabled')?.checked,
            packs: packsSource.map((p, i) => soCreditPackToFirestore(p, i)),
            addon_catalog: soSerializeAddonCatalog(true)
        });
    }

    function soCreditAddonToFirestore(addon, index) {
        const a = soNormalizeCreditAddon(addon, index);
        const row = {
            id: a.id,
            credits: a.credits,
            price: a.price,
            label: a.label,
            active: a.active !== false,
            order: a.order != null ? a.order : index
        };
        if (a.card_subtitle) row.card_subtitle = a.card_subtitle;
        if (a.description) row.description = a.description;
        if (a.offer_badges && a.offer_badges.length) row.offer_badges = a.offer_badges.slice();
        if (a.save) row.save = a.save;
        if (a.best) row.best = true;
        if (a.name) row.name = a.name;
        if (a.default_selected) row.default_selected = true;
        if (a.scope === 'plan') {
            row.scope = 'plan';
            if (a.plan_ids && a.plan_ids.length) row.plan_ids = a.plan_ids.slice();
        } else if (a.scope === 'global') {
            row.scope = 'global';
        }
        return row;
    }

    function soBuildConfigExportData(fromDom) {
        return {
            whatsapp_number: fromDom
                ? String(document.getElementById('so-whatsapp-number')?.value || '').replace(/\D/g, '')
                : String(soConfig?.whatsapp_number || '').replace(/\D/g, ''),
            whatsapp_message: fromDom
                ? String(document.getElementById('so-whatsapp-message')?.value || '').trim()
                : String(soConfig?.whatsapp_message || '').trim(),
            extension_enabled: fromDom
                ? !!document.getElementById('so-extension-enabled')?.checked
                : soConfig?.extension_enabled !== false,
            min_extension_version: fromDom
                ? String(document.getElementById('so-min-version')?.value || DEFAULT_MIN_VERSION).trim()
                : String(soConfig?.min_extension_version || DEFAULT_MIN_VERSION).trim(),
            announcement: fromDom
                ? String(document.getElementById('so-announcement')?.value || '').trim()
                : String(soConfig?.announcement || '').trim(),
            plans: soBuildPlansCanonical(fromDom),
            support: soBuildSupportCanonical(fromDom),
            demo_keys: soBuildInlineDemoCanonical(fromDom)
        };
    }

    function soBuildCreditsExportData(fromDom) {
        const canonical = soBuildCreditsCanonicalObject(fromDom);
        return {
            credits: Object.assign({}, canonical, {
                addon_catalog: soSerializeAddonCatalog(fromDom)
            }),
            smart_mode: fromDom
                ? soSmartModeToFirestore(soReadSmartModeFromDom())
                : soSmartModeToFirestore(soSmartMode || soConfig?.smart_mode || DEFAULT_SMART_MODE)
        };
    }

    function soBuildFullExportData(fromDom) {
        const cfg = soBuildConfigExportData(fromDom);
        const cred = soBuildCreditsExportData(fromDom);
        return Object.assign({}, cfg, {
            credits: cred.credits,
            smart_mode: cred.smart_mode,
            google_trial: soGoogleTrialToFirestore(
                fromDom ? soReadGoogleTrialFromDom() : soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL)
            )
        });
    }

    function soWrapExportEnvelope(scope, data) {
        return {
            so_export_version: SO_EXPORT_VERSION,
            scope,
            exported_at: new Date().toISOString(),
            exported_by: soAuthEmail() || 'unknown',
            project: 'extension-e6e32',
            collection: `${SO_CONFIG_DOC}/${SO_CONFIG_ID}`,
            note: 'Shipping Optimizer admin backup — does not include licenses, Google users, or demo_keys collection docs.',
            data
        };
    }

    function soDownloadJsonFile(filename, obj) {
        const text = JSON.stringify(obj, null, 2);
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 0);
    }

    function soExportFilename(scope) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `shipping-optimizer-${scope}-${stamp}.json`;
    }

    window.soExportShippingOptimizer = function(scope, fromDom) {
        if (!soRequireSuperAdmin()) return;
        const useDom = fromDom !== false;
        let data;
        let fileScope = scope;
        if (scope === 'config') {
            data = soBuildConfigExportData(useDom);
        } else if (scope === 'credits') {
            data = soBuildCreditsExportData(useDom);
        } else if (scope === 'full') {
            data = soBuildFullExportData(useDom);
            fileScope = 'full-app-config';
        } else {
            return soToast('Unknown export scope.');
        }
        const envelope = soWrapExportEnvelope(scope, data);
        soDownloadJsonFile(soExportFilename(fileScope), envelope);
        soToast(`Exported ${scope} backup (${useDom ? 'current forms' : 'loaded state'}).`);
    };

    function soUnwrapImportPayload(parsed, expectedScope) {
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid JSON — expected an object.');
        }
        let scope = String(parsed.scope || parsed.so_scope || '').toLowerCase();
        let data = parsed.data;
        if (!data && (parsed.plans || parsed.credits || parsed.whatsapp_number)) {
            data = parsed;
            if (!scope) {
                if (expectedScope) scope = expectedScope;
                else if (parsed.credits || parsed.smart_mode) scope = 'credits';
                else scope = 'config';
            }
        }
        if (!data || typeof data !== 'object') {
            throw new Error('Backup file has no data object.');
        }
        if (expectedScope && scope && scope !== expectedScope && scope !== 'full') {
            throw new Error(`This file is for "${scope}" but you chose "${expectedScope}".`);
        }
        return { scope: scope || expectedScope || 'config', data };
    }

    function soApplyImportedConfigData(data) {
        const seed = Object.assign({}, soGetDefaultAppSeed(), {
            whatsapp_number: data.whatsapp_number,
            whatsapp_message: data.whatsapp_message,
            extension_enabled: data.extension_enabled,
            min_extension_version: data.min_extension_version,
            announcement: data.announcement,
            plans: data.plans,
            support: data.support,
            demo_keys: data.demo_keys
        });
        soApplySeedSectionToState(seed, 'config');
        soRefreshFormsAfterSeed('config');
    }

    function soApplyImportedCreditsData(data) {
        const credits = data.credits && typeof data.credits === 'object' ? data.credits : data;
        const seed = Object.assign({}, soGetDefaultAppSeed(), {
            credits,
            smart_mode: data.smart_mode || credits.smart_mode || DEFAULT_SMART_MODE
        });
        soApplySeedSectionToState(seed, 'credits');
        soRefreshFormsAfterSeed('credits');
    }

    function soApplyImportedFullData(data) {
        const seed = Object.assign({}, soGetDefaultAppSeed(), data);
        soApplySeedSectionToState(seed, 'all');
        if (data.google_trial) {
            soConfig = Object.assign({}, soConfig || {}, {
                google_trial: soGoogleTrialToFirestore(soNormalizeGoogleTrial(data.google_trial))
            });
        }
        soRefreshFormsAfterSeed('all');
        soBindGoogleTrialForm();
    }

    window.soTriggerImportShippingOptimizer = function(scope, mode) {
        if (!soRequireSuperAdmin()) return;
        const input = document.getElementById('so-import-backup-file');
        if (!input) return soToast('Import input not found.');
        input.dataset.soImportScope = scope || 'full';
        input.dataset.soImportMode = mode || 'form';
        input.value = '';
        input.click();
    };

    window.soHandleImportShippingOptimizerFile = async function(input) {
        if (!input || !input.files || !input.files[0]) return;
        if (!soRequireSuperAdmin()) return;
        const scope = input.dataset.soImportScope || 'full';
        const mode = input.dataset.soImportMode || 'form';
        const file = input.files[0];
        let parsed;
        try {
            const text = await file.text();
            parsed = JSON.parse(text);
        } catch (e) {
            return soToast('Import failed: ' + (e.message || 'Invalid JSON file.'));
        }
        let unwrapped;
        try {
            unwrapped = soUnwrapImportPayload(parsed, scope === 'full' ? '' : scope);
        } catch (e) {
            return soToast(e.message || 'Invalid backup file.');
        }
        const importScope = unwrapped.scope;
        const label = importScope === 'full' ? 'full app config' : importScope;
        const modeLabel = mode === 'firebase'
            ? 'write directly to Firebase (merge)'
            : 'load into admin forms only (review before Save)';
        const previewOk = await soConfirmActionPreviewModal({
            title: mode === 'firebase' ? 'Import backup → Firebase' : 'Import backup → form only',
            bodyHtml: `<p><strong>File:</strong> ${soEsc(file.name)}</p>
                <p><strong>Scope:</strong> ${soEsc(label)}</p>
                <p><strong>Mode:</strong> ${soEsc(modeLabel)}</p>
                <p class="so-admin-muted">Licenses, Google users, and demo_keys collection are never changed by import.</p>
                ${mode === 'firebase' ? '<p class="so-admin-muted" style="color:#f59e0b;">Import + Firebase mode will merge backup into live config after this confirm.</p>' : '<p class="so-admin-muted">Form-only mode — nothing is written until you Save to Firebase.</p>'}`,
            confirmLabel: mode === 'firebase' ? 'Import & write Firebase' : 'Load into forms',
            dangerous: mode === 'firebase'
        });
        if (!previewOk) return;

        try {
            if (importScope === 'config') {
                soApplyImportedConfigData(unwrapped.data);
            } else if (importScope === 'credits') {
                soApplyImportedCreditsData(unwrapped.data);
            } else if (importScope === 'full') {
                soApplyImportedFullData(unwrapped.data);
            } else {
                throw new Error('Unknown import scope: ' + importScope);
            }

            if (mode === 'firebase') {
                if (!soRequireExtensionWrite()) return;
                if (importScope === 'config') {
                    await saveShippingOptimizerConfig();
                } else if (importScope === 'credits') {
                    await saveShippingOptimizerCredits();
                } else if (importScope === 'full') {
                    await soSaveAllCurrentAsDefaults();
                }
                soToast('Import applied and saved to Firebase.');
            } else {
                if (importScope === 'full') {
                    soMarkTabDirty('config');
                    soMarkTabDirty('credits');
                } else {
                    soMarkTabDirty(importScope);
                }
                soToast('Import loaded into forms — review, then Save to Firebase.');
            }
        } catch (e) {
            soToast('Import failed: ' + (e.message || 'Unknown error'));
        } finally {
            input.value = '';
        }
    };

    window.soSeedAllDefaults = async function() {
        const ok = await soConfirmActionPreviewModal({
            title: 'Seed built-in defaults → Firebase',
            bodyHtml: soBuildSeedDefaultsPreviewHtml(),
            confirmLabel: 'Write seed to Firebase',
            dangerous: true,
            onConfirm: () => soExecuteSeedAllDefaults()
        });
        if (!ok) return;
    };

    window.soSaveTabToFirebase = async function(tab) {
        const active = tab || soActiveTab;
        if (active === 'config') return saveShippingOptimizerConfig();
        if (active === 'credits') return saveShippingOptimizerCredits();
        if (active === 'demo') {
            if (soDemoKeyPendingRows.length) return saveSoDemoKeysBatch();
            return saveSoDemoKeysChanges();
        }
        if (active === 'google-trial') return saveShippingOptimizerGoogleTrial();
        if (active === 'licenses') {
            const key = document.getElementById('so-license-key-input')?.value?.trim();
            if (key) return soEditingLicenseKey ? updateSoLicense() : createSoLicense();
            return soToast('Fill in the license form or use section save buttons.');
        }
        return soSaveCurrentTab();
    };

    const SO_SAVE_AS_DEFAULTS_CONFIRM = {
        config:
            'Save current Config & Pricing to Firebase as the default?\n\n' +
            'Plans, support, WhatsApp, and inline demo keys will be stored in shipping_optimizer_config/app. ' +
            'The extension uses these after its next config refresh.',
        credits:
            'Save current Credits & Packs (including Smart Mode dropdown options) to Firebase as the default?\n\n' +
            'Credit rates, packs, and variant dropdown choices will persist for the extension.',
        demo:
            'Save current demo/promo keys to Firebase as the default?\n\n' +
            'Pending and edited keys in this tab will be written to shipping_optimizer_demo_keys.',
        'google-trial':
            'Save current Google trial settings to Firebase as the default?\n\n' +
            'OAuth client IDs, trial limits, and toggles will be stored in google_trial on the app doc. ' +
            'Required for extension Google sign-in (especially Kiwi).',
        licenses:
            'License records are saved individually via Create license — not as app defaults.\n\n' +
            'Reset the form with Load defaults instead.'
    };

    function soBuildFullAppPayloadFromForms() {
        soPreserveInlineDemoRowsFromDom();
        soPlans = soReadPlansFromDom();
        soCreditPacks = soReadCreditPacksFromDom();
        const general = soReadGeneralConfigFromDom();
        const demoKeysPayload = soReadInlineDemoKeysFromDom();
        const creditsPayload = soBuildCreditsPayloadFromDom(soCreditPacks);
        const smartModePayload = soSmartModeToFirestore(soReadSmartModeFromDom());
        const googleTrialPayload = soGoogleTrialToFirestore(soReadGoogleTrialFromDom());
        return {
            general,
            demoKeysPayload,
            creditsPayload,
            smartModePayload,
            googleTrialPayload,
            payload: Object.assign({}, general, {
                plans: soPlans.map((p, i) => soPlanToFirestore(p, i)),
                demo_keys: demoKeysPayload,
                support: soSupportToFirestore(soReadSupportFromDom()),
                credits: creditsPayload,
                smart_mode: smartModePayload,
                google_trial: googleTrialPayload
            })
        };
    }

    window.soSaveCurrentAsDefaults = async function(tab) {
        const tabLabels = {
            config: 'Config & Pricing',
            credits: 'Credits & Packs',
            demo: 'Demo / Promo Keys',
            licenses: 'Paid Licenses',
            'google-trial': 'Google Free Trial'
        };
        const active = tab || soActiveTab;
        const label = tabLabels[active] || active;
        const confirmMsg = SO_SAVE_AS_DEFAULTS_CONFIRM[active];
        if (!confirmMsg) {
            return soToast(`"${label}" does not support Save as defaults.`);
        }
        if (active === 'licenses') {
            const ok = await soConfirmActionPreviewModal({
                title: 'Licenses are not app defaults',
                bodyHtml: `<p>${soEsc(confirmMsg)}</p>`,
                confirmLabel: 'OK',
                dangerous: false
            });
            if (ok) soToast('Use Create license to save license records.');
            return;
        }
        const previewOk = await soConfirmActionPreviewModal({
            title: `Save ${label} → Firebase`,
            bodyHtml: soBuildFirebaseTabSavePreviewHtml(active),
            confirmLabel: 'Write to Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        if (!soRequireExtensionWrite()) return;

        if (active === 'config') {
            soPlans = soReadPlansFromDom();
            const err = soValidatePlans(soPlans);
            if (err) return soToast(err);
            soPreserveInlineDemoRowsFromDom();
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
                await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set(Object.assign({}, payload, {
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: soAuthEmail()
                }), { merge: true });
                soConfig = Object.assign({}, soConfig || {}, payload);
                soAfterTabSaved('config');
            } catch (e) {
                return soToast('Save failed: ' + (e.message || 'Unknown error'));
            }
        } else if (active === 'credits') {
            soCreditPacks = soReadCreditPacksFromDom();
            const packErr = soValidateCreditPacks(soCreditPacks);
            if (packErr) return soToast(packErr);
            const smartModePayload = soSmartModeToFirestore(soReadSmartModeFromDom());
            const smartErr = soValidateSmartMode(smartModePayload);
            if (smartErr) return soToast(smartErr);
            const creditsPayload = {
                enabled: !!document.getElementById('so-credits-enabled')?.checked,
                price_per_credit: Math.max(0, parseInt(document.getElementById('so-credits-price-per')?.value, 10) || DEFAULT_CREDITS.price_per_credit),
                min_purchase: Math.max(1, parseInt(document.getElementById('so-credits-min-purchase')?.value, 10) || DEFAULT_CREDITS.min_purchase),
                cost_per_operation: Math.max(1, parseInt(document.getElementById('so-credits-cost-op')?.value, 10) || DEFAULT_CREDITS.cost_per_operation),
                pack_scopes_enabled: !!document.getElementById('so-pack-scopes-enabled')?.checked,
                addon_scopes_enabled: !!document.getElementById('so-addon-scopes-enabled')?.checked,
                image_generation: soReadImageGenerationFromDom(),
                packs: soCreditPacks.map((p, i) => soCreditPackToFirestore(p, i))
            };
            try {
                await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                    credits: creditsPayload,
                    smart_mode: smartModePayload,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: soAuthEmail()
                }, { merge: true });
                soCredits = creditsPayload;
                soSmartMode = smartModePayload;
                soConfig = Object.assign({}, soConfig, { credits: creditsPayload, smart_mode: smartModePayload });
                soAfterTabSaved('credits');
                renderSoExtensionPreview();
            } catch (e) {
                return soToast('Save failed: ' + (e.message || 'Unknown error'));
            }
        } else if (active === 'google-trial') {
            const payload = soGoogleTrialToFirestore(soReadGoogleTrialFromDom());
            if (!payload.oauth_client_id) {
                return soToast('Chrome extension OAuth client ID (oauth_client_id) is required.');
            }
            try {
                await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                    google_trial: payload,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: soAuthEmail()
                }, { merge: true });
                soConfig = Object.assign({}, soConfig || {}, { google_trial: payload });
                soBindGoogleTrialForm();
                soToast('Google trial settings saved as Firebase default.');
            } catch (e) {
                return soToast('Save failed: ' + (e.message || 'Unknown error'));
            }
        } else if (active === 'demo') {
            if (soDemoKeyPendingRows.length) {
                await saveSoDemoKeysBatch();
            } else {
                await saveSoDemoKeysChanges();
            }
            soToast('Demo keys saved as Firebase default.');
            return;
        }

        soEstablishCleanBaseline();
        soClearDraftStorage();
        if (active !== 'google-trial') {
            soToast(`"${label}" saved as Firebase default — extension will use these on next load.`);
        }
    };

    window.soSaveAllCurrentAsDefaults = async function() {
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Save all forms → Firebase',
            bodyHtml: soBuildFullFirebaseSavePreviewHtml(),
            confirmLabel: 'Write all to Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        if (!soRequireExtensionWrite()) return;

        let built;
        try {
            built = soBuildFullAppPayloadFromForms();
        } catch (e) {
            return soToast(e.message || 'Invalid form data.');
        }
        const planErr = soValidatePlans(soPlans);
        if (planErr) return soToast(planErr);
        const packErr = soValidateCreditPacks(soCreditPacks);
        if (packErr) return soToast(packErr);
        const smartErr = soValidateSmartMode(built.smartModePayload);
        if (smartErr) return soToast(smartErr);
        if (!built.googleTrialPayload.oauth_client_id) {
            return soToast('Google trial oauth_client_id is required when saving full app defaults.');
        }

        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set(Object.assign({}, built.payload, {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }), { merge: true });
            soConfig = Object.assign({}, soConfig || {}, built.payload);
            soCredits = built.creditsPayload;
            soSmartMode = built.smartModePayload;
            soBindGoogleTrialForm();
            soAfterTabSaved('config');
            soAfterTabSaved('credits');
            soEstablishCleanBaseline();
            soClearDraftStorage();
            renderSoExtensionPreview();
            soToast('Full app config saved as Firebase default.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
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
    let soGoogleTrials = [];
    let soActiveTab = 'config';
    let soLoaded = false;
    let soEditingLicenseKey = null;
    /** Original plan id when edit started — used to detect mid-edit plan changes. */
    let soLicenseEditBaselinePlanId = null;
    let soOverridesLicenseKey = null;
    let soAddCreditsLicenseKey = null;
    let soDirtyTabs = { config: false, credits: false };
    let soTabSnapshots = { config: null, credits: null };
    let soHydrating = false;
    let soSnapshotsReady = false;
    let soAllowDirtyMark = false;
    let soUserEditedSinceLoad = false;
    let soLoadInProgress = false;
    let soLoadGeneration = 0;
    let soDirtyCheckTimer = null;
    let soSupport = null;
    let soSmartMode = null;
    let soLicenseFilter = 'all';
    let soLicenseListPage = 1;
    const SO_LICENSE_LIST_PAGE_SIZE = 10;
    let soLicenseQuickPage = 1;
    const SO_LICENSE_QUICK_PAGE_SIZE = 25;
    let soLicenseQuickSelectedKey = '';
    let soDraftSaveTimer = null;
    const SO_DRAFT_STORAGE_KEY = 'swagstree_so_admin_draft_v1';
    const SO_DRAFT_SAVE_MS = 800;
    let soExpandedPlanIds = new Set();
    let soExpandedPackIds = new Set();
    let soExpandedAddonCatalogIds = new Set();
    let soExpandedSmartOptionIdxs = new Set();
    let soExpandedLicenseKeys = new Set();
    let soOpenSections = new Set(['config-general', 'license-quick', 'license-list', 'credits-smart-mode']);

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
        soExpandedSmartOptionIdxs.clear();
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
        const email = (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email)
            ? String(auth.currentUser.email).toLowerCase()
            : '';
        if (email === 'superadmin@swagstree.com') return true;
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
        p.detail_subtitle = String(p.detail_subtitle || '').trim();
        p.detail_footer = String(p.detail_footer || '').trim();
        p.cta_text = String(p.cta_text || '').trim();
        p.card_subtitle = String(p.card_subtitle || '').trim();
        p.card_hint = String(p.card_hint || '').trim();
        if (p.show_whatsapp_icon === false) p.show_whatsapp_icon = false;
        else p.show_whatsapp_icon = p.show_whatsapp_icon !== false;
        if (p.show_details_icon === false) p.show_details_icon = false;
        else p.show_details_icon = p.show_details_icon !== false;
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
            p.max_devices = tierDefault != null ? tierDefault : 0;
        }
        p.billing_mode = SO_BILLING_MODES.includes(p.billing_mode) ? p.billing_mode : 'subscription';
        p.included_credits = Math.max(0, parseInt(p.included_credits, 10) || 0);
        if (!p.unlimited_credits && p.included_credits === 0) {
            const byId = PLAN_DEFAULT_INCLUDED_CREDITS[p.id];
            if (Number.isFinite(byId) && byId > 0) {
                p.included_credits = byId;
            } else if (p.days > 0 && (p.billing_mode === 'hybrid' || p.billing_mode === 'credits')) {
                p.included_credits = soSuggestCreditsForPlanDays(p.days);
            } else if (p.billing_mode === 'credits' || p.billing_mode === 'hybrid') {
                p.included_credits = 50;
            }
        }
        if (p.included_credits > 0 && p.billing_mode === 'subscription' && !p.unlimited_credits) {
            p.billing_mode = 'hybrid';
        }
        p.allow_credit_addons = p.allow_credit_addons === true;
        p.allow_plan_addons = p.allow_plan_addons === true;
        p.hide_plan_addons_in_detail = p.hide_plan_addons_in_detail === true;
        p.disable_plan_addons = p.disable_plan_addons === true;
        if (p.allow_custom_plan === false) p.allow_custom_plan = false;
        else p.allow_custom_plan = true;
        p.hide_custom_plan = p.hide_custom_plan === true;
        p.disable_custom_plan = p.disable_custom_plan === true;
        p.max_addon_selections = Math.max(0, parseInt(p.max_addon_selections, 10) || 0);
        const rawAddons = Array.isArray(p.credit_addons) ? p.credit_addons : [];
        p.credit_addons = soSortCreditAddons(rawAddons.map(soNormalizeCreditAddon));
        p.credit_addons.forEach((a, i) => { a.order = i; });
        p.highlights = Array.isArray(p.highlights)
            ? p.highlights.map(h => String(h || '').trim()).filter(Boolean)
            : [];
        p.offer_badges = Array.isArray(p.offer_badges)
            ? p.offer_badges.map(b => String(b || '').trim()).filter(Boolean)
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
        a.card_subtitle = String(a.card_subtitle || a.cardSubtitle || '').trim();
        if (!a.card_subtitle) a.card_subtitle = `${a.credits} credits · ₹${a.price}`;
        a.description = String(a.description || '').trim();
        a.offer_badges = Array.isArray(a.offer_badges)
            ? a.offer_badges.map(b => String(b || '').trim()).filter(Boolean)
            : (typeof a.offer_badges === 'string' && a.offer_badges.trim()
                ? a.offer_badges.split(/[\n,]+/).map(b => b.trim()).filter(Boolean)
                : []);
        a.active = a.active !== false;
        a.default_selected = a.default_selected === true;
        a.best = a.best === true;
        if (a.save) a.save = String(a.save).trim();
        if (a.name) a.name = String(a.name).trim();
        a.order = Number.isFinite(Number(a.order)) ? Number(a.order) : index;
        a.scope = String(a.scope || 'global').trim().toLowerCase() === 'plan' ? 'plan' : 'global';
        const planIdsRaw = a.plan_ids ?? a.planIds ?? [];
        a.plan_ids = (Array.isArray(planIdsRaw) ? planIdsRaw : String(planIdsRaw || '').split(/[\s,]+/))
            .map(x => soSlugifyId(String(x || '').trim())).filter(Boolean);
        a.hide = a.hide === true;
        a.disabled = a.disabled === true;
        if (a.hide || a.disabled) a.active = false;
        return a;
    }

    function soSortCreditAddons(addons) {
        return addons.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function soGetActivePlanCreditAddons(plan) {
        if (!plan || !plan.allow_credit_addons) return [];
        const planAddons = soSortCreditAddons((plan.credit_addons || []).filter(a => a.active !== false));
        if (planAddons.length) return planAddons;
        return soGetAddonCatalogState().filter(a => a.active !== false);
    }

    function soGetPlanIncludedCredits(plan) {
        if (!plan || soIsUnlimitedCredits(plan)) return 0;
        return Math.max(0, parseInt(plan.included_credits, 10) || 0);
    }

    function soCalculatePlanCredits(plan, selectedAddonIds) {
        const included = plan && !soIsUnlimitedCredits(plan)
            ? soGetPlanIncludedCredits(plan)
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
                card_subtitle: get('card_subtitle'),
                description: get('description'),
                offer_badges: soParsePlanFeaturesText(get('offer_badges_text')),
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
                <label><span>Button label</span><input type="text" data-addon-field="label" value="${soAttr(addon.label || '')}" placeholder="+50 credits" oninput="soMarkTabDirty('config')"></label>
                <label class="so-field-full"><span>Card subtitle (extension)</span><input type="text" data-addon-field="card_subtitle" value="${soAttr(addon.card_subtitle || '')}" placeholder="25 credits · ₹40" oninput="soMarkTabDirty('config')"></label>
                <label class="so-field-full"><span>Description (detail / admin)</span><input type="text" data-addon-field="description" value="${soAttr(addon.description || '')}" placeholder="Add 25 credits at checkout…" oninput="soMarkTabDirty('config')"></label>
                <label class="so-field-full"><span>Offer badges (extension — one per line)</span><textarea rows="2" data-addon-field="offer_badges_text" placeholder="20% off&#10;+25" oninput="soMarkTabDirty('config')">${soEsc((addon.offer_badges || []).join('\n'))}</textarea></label>
                <label class="so-plan-check"><input type="checkbox" data-addon-field="active" ${addon.active !== false ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Active</label>
                <label class="so-plan-check"><input type="checkbox" data-addon-field="default_selected" ${addon.default_selected ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Pre-select on new license</label>
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
            max_devices: p.max_devices != null ? p.max_devices : 0,
            billing_mode: p.billing_mode || 'subscription'
        };
        if (p.duration) out.duration = p.duration;
        if (p.save) out.save = p.save;
        if (p.best) out.best = true;
        if (p.plan_kind) out.plan_kind = p.plan_kind;
        if (p.description) out.description = p.description;
        if (p.detail_subtitle) out.detail_subtitle = p.detail_subtitle;
        if (p.detail_footer) out.detail_footer = p.detail_footer;
        if (p.cta_text) out.cta_text = p.cta_text;
        if (p.card_subtitle) out.card_subtitle = p.card_subtitle;
        if (p.card_hint) out.card_hint = p.card_hint;
        if (p.show_whatsapp_icon === false) out.show_whatsapp_icon = false;
        if (p.show_details_icon === false) out.show_details_icon = false;
        if (p.included_credits > 0) out.included_credits = p.included_credits;
        if (p.allow_credit_addons) out.allow_credit_addons = true;
        if (p.allow_plan_addons) out.allow_plan_addons = true;
        if (p.hide_plan_addons_in_detail) out.hide_plan_addons_in_detail = true;
        if (p.disable_plan_addons) out.disable_plan_addons = true;
        if (p.allow_custom_plan === false) out.allow_custom_plan = false;
        if (p.hide_custom_plan) out.hide_custom_plan = true;
        if (p.disable_custom_plan) out.disable_custom_plan = true;
        if (p.max_addon_selections > 0) out.max_addon_selections = p.max_addon_selections;
        if (Array.isArray(p.credit_addons) && p.credit_addons.length) {
            out.credit_addons = p.credit_addons.map((a, i) => {
                const row = {
                    id: a.id,
                    credits: a.credits,
                    price: a.price,
                    label: a.label,
                    active: a.active !== false,
                    default_selected: a.default_selected === true,
                    order: i
                };
                if (a.card_subtitle) row.card_subtitle = a.card_subtitle;
                if (a.description) row.description = a.description;
                if (a.offer_badges && a.offer_badges.length) row.offer_badges = a.offer_badges.slice();
                if (a.save) row.save = a.save;
                if (a.best) row.best = true;
                if (a.name) row.name = a.name;
                return row;
            });
        }
        if (p.unlimited_time) out.unlimited_time = true;
        if (p.unlimited_devices) out.unlimited_devices = true;
        if (p.unlimited_credits) out.unlimited_credits = true;
        if (p.highlights && p.highlights.length) out.highlights = p.highlights.slice();
        if (p.offer_badges && p.offer_badges.length) out.offer_badges = p.offer_badges.slice();
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
        p.description = String(p.description || '').trim();
        p.detail_subtitle = String(p.detail_subtitle || '').trim();
        p.detail_footer = String(p.detail_footer || '').trim();
        p.cta_text = String(p.cta_text || '').trim();
        p.card_subtitle = String(p.card_subtitle || '').trim();
        p.card_hint = String(p.card_hint || '').trim();
        if (p.show_whatsapp_icon === false) p.show_whatsapp_icon = false;
        else p.show_whatsapp_icon = p.show_whatsapp_icon !== false;
        if (p.show_details_icon === false) p.show_details_icon = false;
        else p.show_details_icon = p.show_details_icon !== false;
        p.highlights = Array.isArray(p.highlights)
            ? p.highlights.map(h => String(h || '').trim()).filter(Boolean)
            : [];
        p.features = Array.isArray(p.features) ? p.features : [];
        p.detail_sections = Array.isArray(p.detail_sections) ? p.detail_sections.map(s => ({
            title: String(s && s.title || '').trim(),
            body: String(s && s.body || '').trim(),
            items: Array.isArray(s && s.items) ? s.items.map(i => String(i || '').trim()).filter(Boolean) : []
        })) : [];
        p.scope = String(p.scope || 'global').trim().toLowerCase() === 'plan' ? 'plan' : 'global';
        const planIdsRaw = p.plan_ids ?? p.planIds ?? [];
        p.plan_ids = (Array.isArray(planIdsRaw) ? planIdsRaw : String(planIdsRaw || '').split(/[\s,]+/))
            .map(x => soSlugifyId(String(x || '').trim())).filter(Boolean);
        return p;
    }

    function soGetConfiguredPlanIdList() {
        const fromPlans = (soPlans || []).map(p => p.id).filter(Boolean);
        if (fromPlans.length) return fromPlans;
        return ['monthly', 'quarterly', 'halfyearly', 'yearly', 'credits_starter', 'lifetime'];
    }

    /** Plan options for pack/add-on mapping — Config tab plans + any saved ids not in list. */
    function soGetPlanMappingOptions(selectedIds) {
        const options = [];
        const seen = new Set();
        (soPlans || []).forEach(p => {
            if (!p || !p.id) return;
            const slug = soSlugifyId(p.id);
            if (!slug || seen.has(slug)) return;
            seen.add(slug);
            const name = String(p.name || '').trim();
            options.push({
                id: slug,
                label: name ? `${name} (${slug})` : slug
            });
        });
        (selectedIds || []).forEach(id => {
            const slug = soSlugifyId(id);
            if (!slug || seen.has(slug)) return;
            seen.add(slug);
            options.push({
                id: slug,
                label: `${slug} (saved — add on Config tab to rename)`
            });
        });
        if (!options.length) {
            return soGetConfiguredPlanIdList().map(id => ({ id: soSlugifyId(id), label: id }));
        }
        return options;
    }

    function soReadPlanIdsFromRow(row) {
        if (!row) return [];
        const fromChecks = Array.from(row.querySelectorAll('[data-field="plan_id"]:checked'))
            .map(el => soSlugifyId(el.getAttribute('data-plan-id') || ''))
            .filter(Boolean);
        if (fromChecks.length) return fromChecks;
        const legacy = row.querySelector('[data-field="plan_ids_text"]');
        if (legacy && String(legacy.value || '').trim()) {
            return String(legacy.value).split(/[\s,]+/)
                .map(x => soSlugifyId(x.trim())).filter(Boolean);
        }
        return [];
    }

    function soRenderPlanIdsPickerHtml(selectedIds, changeHandler) {
        const handler = changeHandler || 'soOnCreditPackPlanIdsChange(this)';
        const options = soGetPlanMappingOptions(selectedIds);
        const selected = new Set((selectedIds || []).map(id => soSlugifyId(id)));
        if (!options.length) {
            return '<p class="so-admin-muted so-field-group-hint">Add subscription plans on the <strong>Config</strong> tab first, then map packs here.</p>';
        }
        return `<div class="so-plan-id-picker" role="group" aria-label="Subscription plans">
            ${options.map(opt => {
                const checked = selected.has(soSlugifyId(opt.id));
                return `<label class="so-plan-check so-plan-id-pick"><input type="checkbox" data-field="plan_id" data-plan-id="${soAttr(opt.id)}" ${checked ? 'checked' : ''} onchange="${handler}"> <span>${soEsc(opt.label)}</span></label>`;
            }).join('')}
        </div>`;
    }

    function soScopePlanBadgeHtml(scope, planIds) {
        if (scope === 'plan') {
            return (planIds && planIds.length)
                ? `<span class="so-meta-chip so-scope-plan-badge">${soEsc(planIds.join(', '))}</span>`
                : '<span class="so-badge so-badge--off so-scope-plan-badge">Plan (pick plans)</span>';
        }
        return '<span class="so-meta-chip so-scope-plan-badge">Global</span>';
    }

    function soUpdateScopePlanBadge(row, scope, planIds) {
        if (!row) return;
        const existing = row.querySelector('.so-scope-plan-badge');
        const html = soScopePlanBadgeHtml(scope, planIds);
        if (existing) {
            existing.outerHTML = html;
        } else {
            const badges = row.querySelector('.so-plan-card-badges');
            if (badges) badges.insertAdjacentHTML('beforeend', html);
        }
    }

    function soTogglePlanIdsWrap(row, scope) {
        if (!row) return;
        const wrap = row.querySelector('[data-so-plan-ids-wrap]');
        if (wrap) wrap.style.display = scope === 'plan' ? '' : 'none';
    }

    window.soOnCreditPackScopeChange = function(selectEl) {
        const row = selectEl && selectEl.closest('.so-credit-pack-row');
        if (!row) return;
        const scope = selectEl.value === 'plan' ? 'plan' : 'global';
        soMarkTabDirty('credits');
        soTogglePlanIdsWrap(row, scope);
        soSyncCreditPacksFromDom();
        const idx = parseInt(row.getAttribute('data-pack-idx'), 10);
        const pack = Number.isFinite(idx) ? soCreditPacks[idx] : null;
        soUpdateScopePlanBadge(row, scope, pack ? pack.plan_ids : soReadPlanIdsFromRow(row));
        renderSoExtensionPreview();
    };

    window.soOnCreditPackPlanIdsChange = function(el) {
        const row = el && el.closest('.so-credit-pack-row');
        if (!row) return;
        soMarkTabDirty('credits');
        soSyncCreditPacksFromDom();
        const scopeEl = row.querySelector('[data-field="scope"]');
        const scope = scopeEl && scopeEl.value === 'plan' ? 'plan' : 'global';
        soUpdateScopePlanBadge(row, scope, soReadPlanIdsFromRow(row));
        renderSoExtensionPreview();
    };

    window.soOnAddonCatalogScopeChange = function(selectEl) {
        const row = selectEl && selectEl.closest('.so-addon-catalog-row');
        if (!row) return;
        const scope = selectEl.value === 'plan' ? 'plan' : 'global';
        soMarkTabDirty('credits');
        soTogglePlanIdsWrap(row, scope);
        soSyncAddonCatalogFromDom();
        soUpdateScopePlanBadge(row, scope, soReadPlanIdsFromRow(row));
        renderSoExtensionPreview();
    };

    window.soOnAddonCatalogPlanIdsChange = function(el) {
        const row = el && el.closest('.so-addon-catalog-row');
        if (!row) return;
        soMarkTabDirty('credits');
        soSyncAddonCatalogFromDom();
        const scopeEl = row.querySelector('[data-field="scope"]');
        const scope = scopeEl && scopeEl.value === 'plan' ? 'plan' : 'global';
        soUpdateScopePlanBadge(row, scope, soReadPlanIdsFromRow(row));
        renderSoExtensionPreview();
    };

    function soPackAppliesToPlan(pack, planId, scopesEnabled) {
        if (!pack || pack.active === false) return false;
        if (!scopesEnabled) return true;
        const scope = pack.scope || 'global';
        if (scope !== 'plan') return scope === 'global';
        const ids = pack.plan_ids || [];
        if (!ids.length) return false;
        const key = soSlugifyId(planId);
        return ids.some(id => soSlugifyId(id) === key);
    }

    function soCreditPackToFirestore(p, order) {
        const out = {
            id: p.id,
            credits: p.credits,
            price: p.price,
            label: p.label,
            active: p.active !== false,
            order: order
        };
        if (p.description) out.description = p.description;
        if (p.detail_subtitle) out.detail_subtitle = p.detail_subtitle;
        if (p.detail_footer) out.detail_footer = p.detail_footer;
        if (p.cta_text) out.cta_text = p.cta_text;
        if (p.card_subtitle) out.card_subtitle = p.card_subtitle;
        if (p.card_hint) out.card_hint = p.card_hint;
        if (p.show_whatsapp_icon === false) out.show_whatsapp_icon = false;
        if (p.show_details_icon === false) out.show_details_icon = false;
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
        if (p.scope === 'plan') {
            out.scope = 'plan';
            if (p.plan_ids && p.plan_ids.length) out.plan_ids = p.plan_ids.slice();
        } else if (p.scope === 'global') {
            out.scope = 'global';
        }
        return out;
    }

    function soSortCreditPacks(packs) {
        return packs.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    /** Parse credits.packs from Firebase — array or legacy object map. */
    function soParseCreditPacksFromConfig(raw) {
        if (Array.isArray(raw)) return raw.slice();
        if (raw && typeof raw === 'object') {
            return Object.entries(raw).map(([id, p], i) => {
                const row = p && typeof p === 'object' ? Object.assign({}, p) : {};
                if (!row.id) row.id = id;
                row.order = row.order != null ? row.order : i;
                return row;
            });
        }
        return null;
    }

    function soResolveCreditPacksFromConfig(rawCredits, fallback) {
        const parsed = soParseCreditPacksFromConfig(rawCredits && rawCredits.packs);
        if (parsed && parsed.length) return parsed;
        if (parsed && Array.isArray(rawCredits?.packs)) return parsed;
        return (fallback || DEFAULT_CREDIT_PACKS).slice();
    }

    function soSyncCreditPacksFromDom() {
        const container = document.getElementById('so-credit-packs-editor');
        if (container && container.querySelector('.so-credit-pack-row')) {
            soCreditPacks = soReadCreditPacksFromDom();
        }
    }

    function soSyncAddonCatalogFromDom() {
        const container = document.getElementById('so-addon-catalog-editor');
        if (!container || !container.querySelector('.so-addon-catalog-row')) return;
        if (!soCredits) soCredits = Object.assign({}, DEFAULT_CREDITS);
        soCredits.addon_catalog = soReadAddonCatalogFromDom();
    }

    function soReadCreditPacksForSave(packOverrides) {
        if (packOverrides != null) return packOverrides;
        soSyncCreditPacksFromDom();
        return soCreditPacks.slice();
    }

    function soValidateCreditPacks(packs) {
        const scopesOn = !!document.getElementById('so-pack-scopes-enabled')?.checked;
        const ids = new Set();
        for (let i = 0; i < packs.length; i++) {
            const p = packs[i];
            if (!p.id) return `Credit pack #${i + 1}: id is required.`;
            if (ids.has(p.id)) return `Duplicate credit pack id "${p.id}".`;
            ids.add(p.id);
            if (p.credits < 1) return `Pack "${p.id}": credits must be ≥ 1.`;
            if (p.price < 0) return `Pack "${p.id}": price must be ≥ 0.`;
            if (scopesOn && p.scope === 'plan' && !(p.plan_ids || []).length) {
                return `Pack "${p.id}": pick at least one subscription plan when scope is plan-specific.`;
            }
        }
        return '';
    }

    function soValidateSmartMode(mode) {
        const m = soNormalizeSmartMode(mode);
        const options = m.variant_options || [];
        if (!options.length) return 'Add at least one Smart Mode variant option.';
        const values = options.map(o => o.value);
        const seen = new Set();
        for (let i = 0; i < values.length; i++) {
            if (seen.has(values[i])) {
                return `Duplicate variant value ${values[i]} — each dropdown option needs a unique count.`;
            }
            seen.add(values[i]);
            if (values[i] < 1) return `Variant option #${i + 1}: count must be at least 1.`;
        }
        if (!options.some(o => o.active !== false)) {
            return 'At least one variant option must be active (shown in extension).';
        }
        const activeValues = options.filter(o => o.active !== false).map(o => o.value);
        if (!activeValues.includes(m.default_variant)) {
            return 'Default variant must be one of the active options.';
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
        const container = document.getElementById('so-license-addon-picks');
        if (plan && container) {
            const maxSel = parseInt(plan.max_addon_selections, 10) || 0;
            if (maxSel === 1) {
                const checked = container.querySelectorAll('[data-license-addon]:checked');
                if (checked.length > 1) {
                    const last = checked[checked.length - 1];
                    container.querySelectorAll('[data-license-addon]:checked').forEach(el => {
                        if (el !== last) el.checked = false;
                    });
                }
            } else if (maxSel > 1) {
                const checked = container.querySelectorAll('[data-license-addon]:checked');
                if (checked.length > maxSel) {
                    checked[checked.length - 1].checked = false;
                    soToast(`This plan allows at most ${maxSel} add-on(s).`);
                }
            }
        }
        const balEl = document.getElementById('so-license-credits-balance');
        if (balEl && !soEditingLicenseKey) {
            const planId = document.getElementById('so-license-plan')?.value;
            const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
            const prefill = soCalculateLicenseCreditPrefill(plan, soReadSelectedLicenseAddonIds());
            balEl.value = prefill.balance;
            const usedEl = document.getElementById('so-license-credits-used');
            if (usedEl) usedEl.value = prefill.used;
        } else if (soEditingLicenseKey) {
            const planId = document.getElementById('so-license-plan')?.value;
            const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
            const lic = soLicenses.find(l => l.key === soEditingLicenseKey);
            if (plan && lic && soLicensePlanChangedOnEdit(plan)) {
                const used = Math.max(0, parseInt(document.getElementById('so-license-credits-used')?.value, 10) || 0);
                const breakdown = soResolveLicenseCreditBreakdown(plan, soReadSelectedLicenseAddonIds(), lic);
                const grantTotal = breakdown.grantTotal;
                if (balEl) balEl.value = Math.max(0, grantTotal - used);
                const totalEl = document.getElementById('so-license-total-credits');
                if (totalEl) totalEl.value = grantTotal;
            }
        }
        soUpdateLicenseCreditsBreakdown();
        soSyncLicenseBillingModeFromCredits();
    };

    function soCalculateLicenseCreditPrefill(plan, selectedIds) {
        if (!plan || soIsUnlimitedCredits(plan)) {
            return { included: 0, addon: 0, total: 0, balance: 0, used: 0 };
        }
        const calc = soCalculatePlanCredits(plan, selectedIds || []);
        const total = calc.total;
        return {
            included: calc.included,
            addon: calc.addon,
            total,
            balance: total,
            used: 0
        };
    }

    let soLicenseCreditsTotalDirty = false;

    function soReadLicenseGrantTotal(plan, selectedIds, lic) {
        const totalEl = document.getElementById('so-license-total-credits');
        const balEl = document.getElementById('so-license-credits-balance');
        const usedEl = document.getElementById('so-license-credits-used');
        const manual = Math.max(0, parseInt(totalEl?.value, 10) || 0);
        const bal = Math.max(0, parseInt(balEl?.value, 10) || 0);
        const used = Math.max(0, parseInt(usedEl?.value, 10) || 0);
        const custom = Math.max(0, parseInt(document.getElementById('so-license-custom-credits')?.value, 10) || 0);
        if (soEditingLicenseKey) {
            const fromBalance = bal + used;
            if (fromBalance > 0) return fromBalance;
        }
        const breakdown = soResolveLicenseCreditBreakdown(plan, selectedIds, lic);
        if (soLicenseCreditsTotalDirty && manual > 0) return manual;
        if (manual > 0 && manual !== breakdown.grantTotal) return manual;
        const base = breakdown.grantTotal > 0 ? breakdown.grantTotal : manual;
        return base > 0 ? base : manual;
    }

    window.soOnLicenseCustomCreditsChange = function() {
        const lic = soEditingLicenseKey ? soLicenses.find(l => l.key === soEditingLicenseKey) : null;
        const prevCustom = lic
            ? Math.max(0, parseInt(lic.custom_credits ?? lic.customCredits ?? lic.bonus_credits, 10) || 0)
            : 0;
        const custom = soReadLicenseCustomCredits();
        const balEl = document.getElementById('so-license-credits-balance');
        const usedEl = document.getElementById('so-license-credits-used');
        const totalEl = document.getElementById('so-license-total-credits');
        const bal = Math.max(0, parseInt(balEl?.value, 10) || 0);
        const used = Math.max(0, parseInt(usedEl?.value, 10) || 0);
        if (soEditingLicenseKey && custom > prevCustom) {
            const delta = custom - prevCustom;
            const newBal = bal + delta;
            const newTotal = used + newBal;
            if (balEl) balEl.value = newBal;
            if (totalEl) totalEl.value = newTotal;
            soLicenseCreditsTotalDirty = true;
        } else if (!soEditingLicenseKey) {
            const planId = document.getElementById('so-license-plan')?.value;
            const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
            const breakdown = soResolveLicenseCreditBreakdown(plan, soReadSelectedLicenseAddonIds(), null);
            const grantTotal = breakdown.included + breakdown.addon + custom;
            if (totalEl && !soLicenseCreditsTotalDirty) totalEl.value = grantTotal;
            if (balEl && !soEditingLicenseKey) balEl.value = Math.max(0, grantTotal - used);
        }
        soUpdateLicenseCreditsBreakdown();
        soSyncLicenseBillingModeFromCredits();
    };

    let soLicenseBillingManualOverride = false;
    let soLicenseCustomPlans = [];
    let soExpandedLicenseCustomPlanIds = new Set();
    let soLicenseCustomPlanModalIdx = -1;

    function soLicenseNeedsHybridBilling(plan, selectedIds, lic) {
        const custom = soReadLicenseCustomCredits();
        const ids = selectedIds || soReadSelectedLicenseAddonIds();
        const calc = plan ? soCalculatePlanCredits(plan, ids) : { addon: 0 };
        let addon = calc.addon;
        if (lic && soEditingLicenseKey && !ids.length) {
            addon = Math.max(0, parseInt(lic.addon_credits ?? lic.addonCredits, 10) || 0);
        }
        return custom > 0 || addon > 0 || ids.length > 0;
    }

    function soSyncLicenseBillingModeFromCredits() {
        const billingEl = document.getElementById('so-license-billing-mode');
        if (!billingEl || soLicenseBillingManualOverride) return;
        const planId = document.getElementById('so-license-plan')?.value;
        const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
        const lic = soEditingLicenseKey ? soLicenses.find(l => l.key === soEditingLicenseKey) : null;
        const selectedIds = soReadSelectedLicenseAddonIds();
        if (soLicenseNeedsHybridBilling(plan, selectedIds, lic)) {
            billingEl.value = 'hybrid';
        } else if (billingEl.value !== 'credits') {
            billingEl.value = 'subscription';
        }
    }

    window.soOnLicenseBillingModeManualChange = function() {
        const billingEl = document.getElementById('so-license-billing-mode');
        soLicenseBillingManualOverride = billingEl && billingEl.value === 'credits';
        soUpdateLicenseCreditsBreakdown();
    };

    function soReadLicenseCustomCredits() {
        return Math.max(0, parseInt(document.getElementById('so-license-custom-credits')?.value, 10) || 0);
    }

    function soReadLicenseCustomCreditsLabel() {
        return String(document.getElementById('so-license-custom-credits-label')?.value || '').trim();
    }

    function soResolveLicenseConsumedPools(lic, breakdown, used) {
        const includedGrant = breakdown.included;
        const addonGrant = breakdown.addon;
        const customGrant = breakdown.custom;
        let includedUsed = Math.min(used, includedGrant);
        let addonUsed = 0;
        let customUsed = 0;
        if (lic) {
            const iu = parseInt(lic.included_credits_used ?? lic.includedCreditsUsed, 10);
            const au = parseInt(lic.addon_credits_used ?? lic.addonCreditsUsed, 10);
            const cu = parseInt(lic.custom_credits_used ?? lic.customCreditsUsed, 10);
            if (Number.isFinite(iu) && iu >= 0) includedUsed = Math.min(iu, includedGrant);
            if (Number.isFinite(au) && au >= 0) addonUsed = Math.min(au, addonGrant);
            if (Number.isFinite(cu) && cu >= 0) customUsed = Math.min(cu, customGrant);
            if (!Number.isFinite(iu) && !Number.isFinite(au)) {
                includedUsed = Math.min(used, includedGrant);
                addonUsed = Math.max(0, Math.min(used - includedUsed, addonGrant));
                customUsed = Math.max(0, used - includedUsed - addonUsed);
            } else if (!Number.isFinite(cu)) {
                customUsed = Math.max(0, Math.min(used - includedUsed - addonUsed, customGrant));
            }
        } else {
            includedUsed = Math.min(used, includedGrant);
            addonUsed = Math.max(0, Math.min(used - includedUsed, addonGrant));
            customUsed = Math.max(0, used - includedUsed - addonUsed);
        }
        return {
            includedGrant,
            addonGrant,
            customGrant,
            includedUsed,
            addonUsed,
            customUsed,
            includedRemaining: Math.max(0, includedGrant - includedUsed),
            addonRemaining: Math.max(0, addonGrant - addonUsed),
            customRemaining: Math.max(0, customGrant - customUsed)
        };
    }

    function soRenderLicenseConsumedPanel(pools, isEdit) {
        const panel = document.getElementById('so-license-consumed-panel');
        if (!panel) return;
        if (!isEdit || (pools.includedGrant + pools.addonGrant + pools.customGrant) <= 0) {
            panel.hidden = true;
            panel.innerHTML = '';
            return;
        }
        panel.hidden = false;
        const mk = (title, grant, usedVal, remain) => grant > 0
            ? `<div class="so-license-consumed-card"><strong>${title}</strong>Used ${usedVal} / ${grant} · Left ${remain}</div>`
            : '';
        panel.innerHTML = `<div class="so-admin-subhead" style="margin-top:8px;">Consumed breakdown (stored on license)</div>
            <div class="so-license-consumed-grid">
                ${mk('Subscription', pools.includedGrant, pools.includedUsed, pools.includedRemaining)}
                ${mk('Add-on', pools.addonGrant, pools.addonUsed, pools.addonRemaining)}
                ${mk('Custom', pools.customGrant, pools.customUsed, pools.customRemaining)}
            </div>
            <p class="so-admin-muted so-admin-tip" style="margin-top:6px;">Extension deducts in order: subscription → add-on → custom.</p>`;
    }

    window.soOnLicenseTotalCreditsChange = function() {
        soLicenseCreditsTotalDirty = true;
        const totalEl = document.getElementById('so-license-total-credits');
        const balEl = document.getElementById('so-license-credits-balance');
        const usedEl = document.getElementById('so-license-credits-used');
        const customEl = document.getElementById('so-license-custom-credits');
        const includedEl = document.getElementById('so-license-included-credits');
        const addonEl = document.getElementById('so-license-addon-credits');
        const total = Math.max(0, parseInt(totalEl?.value, 10) || 0);
        const used = Math.max(0, parseInt(usedEl?.value, 10) || 0);
        const inc = Math.max(0, parseInt(includedEl?.value, 10) || 0);
        const add = Math.max(0, parseInt(addonEl?.value, 10) || 0);
        if (customEl && total >= inc + add) customEl.value = Math.max(0, total - inc - add);
        if (balEl && (!soEditingLicenseKey || total >= used)) {
            balEl.value = Math.max(0, total - used);
        }
        soUpdateLicenseCreditsBreakdown();
    };

    function soPrefillLicenseCreditsFromPlan(plan, selectedIds) {
        soLicenseCreditsTotalDirty = false;
        const prefill = soCalculateLicenseCreditPrefill(plan, selectedIds);
        const includedEl = document.getElementById('so-license-included-credits');
        const addonEl = document.getElementById('so-license-addon-credits');
        const totalEl = document.getElementById('so-license-total-credits');
        const balEl = document.getElementById('so-license-credits-balance');
        const usedEl = document.getElementById('so-license-credits-used');
        if (includedEl) includedEl.value = prefill.included;
        if (addonEl) addonEl.value = prefill.addon;
        if (totalEl) totalEl.value = prefill.total;
        if (!soEditingLicenseKey) {
            if (balEl) balEl.value = prefill.balance;
            if (usedEl) usedEl.value = prefill.used;
        }
    }

    function soInitLicenseCreateForm() {
        if (soEditingLicenseKey) return;
        const sel = document.getElementById('so-license-plan');
        if (!sel) return;
        const plans = soGetAllPlansForSelect();
        const preferred = plans.find(p => p.id === SO_DEFAULT_LICENSE_PLAN_ID)
            || plans.find(p => p.active !== false)
            || plans[0];
        if (preferred) sel.value = preferred.id;
        const plan = soPlans.find(p => p.id === sel.value) || preferred;
        if (plan) soApplyPlanDefaultsToLicenseForm(plan);
        else soUpdateLicenseCreditsBreakdown();
        const locEl = document.getElementById('so-license-customer-location');
        if (locEl && !locEl.value) locEl.value = soGuessAdminLocation();
        void soPrefillLicenseCustomerFields(null);
    }

    async function soFetchAdminIpIntoLicenseField() {
        const ipEl = document.getElementById('so-license-customer-ip');
        if (!ipEl || ipEl.value || soEditingLicenseKey) return;
        try {
            const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
            if (!r.ok) return;
            const j = await r.json();
            if (j && j.ip) ipEl.value = String(j.ip);
        } catch (_) { /* optional */ }
    }

    function soPrefillLicenseCustomerFields(lic) {
        const isEdit = !!soEditingLicenseKey;
        const src = lic || {};
        const setIfEmpty = (id, val) => {
            const el = document.getElementById(id);
            if (el && !String(el.value || '').trim() && val) el.value = val;
        };
        setIfEmpty('so-license-customer-name', src.customer_name || src.customerName || '');
        setIfEmpty('so-license-customer-phone', src.customer_phone || src.customerPhone || '');
        setIfEmpty('so-license-customer-email', src.customer_email || src.customerEmail || (!isEdit ? soAuthEmail() : ''));
        setIfEmpty('so-license-customer-address', src.customer_address || src.customerAddress || '');
        setIfEmpty('so-license-customer-location', src.customer_location || src.customerLocation || soGuessAdminLocation());
        const email = String(document.getElementById('so-license-customer-email')?.value || src.customer_email || src.customerEmail || '').trim().toLowerCase();
        if (email && soGoogleTrials && soGoogleTrials.length) {
            const trial = soGoogleTrials.find(r => String(r.email || '').trim().toLowerCase() === email);
            if (trial) {
                setIfEmpty('so-license-customer-name', trial.display_name || trial.displayName || '');
                setIfEmpty('so-license-customer-email', trial.email || email);
            }
        }
        if (!isEdit) void soFetchAdminIpIntoLicenseField();
    }

    function soLicensePlanChangedOnEdit(plan) {
        if (!soEditingLicenseKey || !plan) return false;
        const lic = soLicenses.find(l => l.key === soEditingLicenseKey);
        const baseline = soLicenseEditBaselinePlanId || (lic && (lic.planId || lic.planType)) || '';
        return soSlugifyId(plan.id) !== soSlugifyId(baseline);
    }

    function soResolveLicenseCreditBreakdown(plan, selectedIds, lic) {
        const calc = plan ? soCalculatePlanCredits(plan, selectedIds || []) : { included: 0, addon: 0, total: 0, addonPrice: 0 };
        let included = calc.included;
        let addon = calc.addon;
        const planChangedOnEdit = lic && soEditingLicenseKey && plan && soLicensePlanChangedOnEdit(plan);
        if (lic && !planChangedOnEdit) {
            const licIncluded = parseInt(lic.included_credits, 10);
            const licAddon = parseInt(lic.addon_credits, 10);
            if (Number.isFinite(licIncluded) && licIncluded >= 0) included = licIncluded;
            if (Number.isFinite(licAddon) && licAddon >= 0) addon = licAddon;
        }
        const custom = lic
            ? Math.max(0, parseInt(lic.custom_credits ?? lic.customCredits, 10) || parseInt(lic.bonus_credits, 10) || 0)
            : soReadLicenseCustomCredits();
        if (!lic) {
            const fromForm = soReadLicenseCustomCredits();
            if (fromForm > 0) custom = fromForm;
        }
        const grantTotal = included + addon + custom;
        return { included, addon, custom, total: grantTotal, grantTotal, addonPrice: calc.addonPrice };
    }

    window.soUpdateLicenseCreditsBreakdown = function() {
        const panel = document.getElementById('so-license-credits-breakdown');
        if (!panel) return;
        const planId = document.getElementById('so-license-plan')?.value;
        const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
        const selectedIds = soReadSelectedLicenseAddonIds();
        const lic = soEditingLicenseKey ? soLicenses.find(l => l.key === soEditingLicenseKey) : null;
        const unlimited = !!document.getElementById('so-license-unlimited-credits')?.checked
            || soIsUnlimitedCredits(plan) || (lic && soIsUnlimitedCredits(lic));
        if (unlimited) {
            panel.innerHTML = '<strong>Credits:</strong> Unlimited — no balance tracking.';
            return;
        }
        const breakdown = soResolveLicenseCreditBreakdown(plan, selectedIds, lic);
        const grantTotal = soReadLicenseGrantTotal(plan, selectedIds, lic);
        const bal = Math.max(0, parseInt(document.getElementById('so-license-credits-balance')?.value, 10) || 0);
        const used = Math.max(0, parseInt(document.getElementById('so-license-credits-used')?.value, 10) || 0);
        const planGrant = breakdown.grantTotal || breakdown.total;
        const custom = breakdown.custom;
        const bonus = grantTotal > planGrant ? grantTotal - planGrant : 0;
        const isEdit = !!soEditingLicenseKey;
        const pools = soResolveLicenseConsumedPools(lic, breakdown, used);
        soRenderLicenseConsumedPanel(pools, isEdit);
        if (!plan) {
            panel.textContent = '';
            return;
        }
        const billing = plan.billing_mode || 'subscription';
        const customLabel = soReadLicenseCustomCreditsLabel() || (lic && (lic.custom_credits_label || lic.customCreditsLabel)) || '';
        const grantLine = planGrant > 0
            ? `<strong>Plan grant:</strong> ${breakdown.included} subscription + ${breakdown.addon} add-on${custom > 0 ? ` + ${custom} custom` : ''} = <strong>${planGrant}</strong>`
            + (bonus > 0 ? ` + <strong>${bonus} manual adjust</strong> = <strong>${grantTotal} total</strong>` : (grantTotal !== planGrant ? ` → <strong>${grantTotal} effective total</strong>` : ''))
            : grantTotal > 0
                ? `<strong>Manual grant:</strong> <strong>${grantTotal} credits</strong> (no plan credits — customer support top-up)`
                : `<strong>Plan grant:</strong> none (subscription-only plan — no credits on activation)`;
        const balanceLine = `<strong>Unused (balance):</strong> ${bal} · <strong>Used (total):</strong> ${used}` +
            (grantTotal > 0 ? ` · <strong>Grant total:</strong> ${grantTotal} (= balance + used)` : '');
        const poolLine = planGrant > 0
            ? `<br><strong>Consumption order:</strong> subscription (${breakdown.included}) → add-on (${breakdown.addon})${custom > 0 ? ` → custom (${custom}${customLabel ? ': ' + soEsc(customLabel) : ''})` : ''}.`
            : '';
        const poolRemain = isEdit && planGrant > 0
            ? `<br><strong>Remaining pools:</strong> ${pools.includedRemaining} subscription · ${pools.addonRemaining} add-on · ${pools.customRemaining} custom`
            : (planGrant > 0
                ? `<br><strong>Remaining pools:</strong> ~${pools.includedRemaining} subscription · ~${pools.addonRemaining} add-on · ~${pools.customRemaining} custom`
                : '');
        const consistencyWarn = grantTotal > 0 && (bal + used) !== grantTotal
            ? `<br><span class="so-admin-muted" style="color:#f59e0b;">Balance + used (${bal + used}) ≠ grant total (${grantTotal}). Set total to ${bal + used} or adjust balance/used.</span>`
            : '';
        const activationHint = !isEdit && grantTotal > 0
            ? '<br><span class="so-admin-muted">New license: balance prefilled from grant total — edit <strong>Total</strong> or <strong>Custom credits</strong> for manual grants.</span>'
            : (isEdit
                ? (plan && lic && soLicensePlanChangedOnEdit(plan)
                    ? '<br><span class="so-admin-muted" style="color:#f59e0b;">Plan changed — credits recalculated from the new plan. Used credits preserved; review balance before saving.</span>'
                    : '<br><span class="so-admin-muted">Edit mode: values above are loaded from Firebase. Consumed cards show stored pool usage.</span>')
                : '');
        const planHint = planGrant === 0 && grantTotal === 0 && (billing === 'hybrid' || billing === 'credits')
            ? '<br><span class="so-admin-muted">Set <code>included_credits</code> on this plan in Config → Pricing, or enter <strong>Custom credits</strong> / <strong>Total</strong>.</span>'
            : '';
        const billingEl = document.getElementById('so-license-billing-mode');
        soSyncLicenseBillingModeFromCredits();
        const billingMode = billingEl ? billingEl.value : (lic?.billing_mode || 'subscription');
        const billingLine = `<br><strong>Billing mode:</strong> ${soEsc(billingMode)}${soLicenseBillingManualOverride ? ' (manual credits override)' : ' (auto: hybrid when add-on or custom credits)'}`;
        panel.innerHTML = `${grantLine}<br>${balanceLine}${poolLine}${poolRemain}${billingLine}${consistencyWarn}${activationHint}${planHint}`;
        const includedEl = document.getElementById('so-license-included-credits');
        const addonEl = document.getElementById('so-license-addon-credits');
        const totalEl = document.getElementById('so-license-total-credits');
        if (!isEdit) {
            if (includedEl) includedEl.value = breakdown.included;
            if (addonEl) addonEl.value = breakdown.addon;
            if (totalEl && !soLicenseCreditsTotalDirty) totalEl.value = grantTotal > 0 ? grantTotal : planGrant;
        } else if (plan && lic && soLicensePlanChangedOnEdit(plan)) {
            if (includedEl) includedEl.value = breakdown.included;
            if (addonEl) addonEl.value = breakdown.addon;
            if (totalEl && !soLicenseCreditsTotalDirty) totalEl.value = grantTotal > 0 ? grantTotal : planGrant;
        } else if (totalEl && !soLicenseCreditsTotalDirty && (bal + used) > 0) {
            totalEl.value = bal + used;
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

    function soLicenseCreatedAt(lic) {
        return lic?.issued_at || lic?.issuedAt || lic?.createdAt || lic?.created_at || null;
    }

    function soFormatLicenseCreated(lic) {
        const ts = soLicenseCreatedAt(lic);
        return ts ? soFormatTs(ts) : '—';
    }

    function soFormatLicenseExpiryDetail(lic) {
        if (soLicenseNeverExpires(lic)) {
            return { label: 'Never expires', sub: 'Lifetime / unlimited time', kind: 'lifetime' };
        }
        const exp = soLicenseExpiryDate(lic);
        if (exp) {
            const expired = exp.getTime() < Date.now();
            const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
            return {
                label: soFormatTs(lic.expiresAt),
                sub: expired
                    ? 'Expired'
                    : (daysLeft <= 7 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : `${daysLeft} days left`),
                kind: expired ? 'expired' : 'active'
            };
        }
        if (!lic?.activatedAt && lic?.expiry_starts_on_activation !== false) {
            const days = lic?.planDays != null ? lic.planDays : '?';
            if (parseInt(days, 10) === 0) {
                return { label: 'Never expires', sub: 'After activation', kind: 'lifetime' };
            }
            return {
                label: `Starts on activation`,
                sub: `${days} days from first use`,
                kind: 'pending'
            };
        }
        const expStr = lic?.expiresAt && typeof lic.expiresAt === 'string' ? lic.expiresAt.trim() : '';
        if (expStr) return { label: expStr, sub: 'Fixed expiry', kind: 'dated' };
        return { label: 'No fixed expiry', sub: 'Open-ended grant', kind: 'open' };
    }

    function soNormalizeLicenseKeyQuery(q) {
        return String(q || '').trim().toUpperCase().replace(/\s+/g, '-');
    }

    function soLicenseSearchHaystack(lic) {
        const deviceIds = soGetLicenseDeviceIds(lic).join(' ');
        return [
            lic.key, lic.machineId, deviceIds, lic.planId, lic.planType, lic.billing_mode,
            lic.customer_name, lic.customer_phone, lic.customer_email, lic.customer_address,
            String(lic.credits_balance ?? ''), String(lic.credits_used ?? ''),
            soFormatValidity(lic), soFormatLicenseCreated(lic)
        ].filter(v => v != null && v !== '').join(' ').toLowerCase();
    }

    function soGetFilteredLicenses() {
        const q = String(document.getElementById('so-license-search')?.value || '').trim().toLowerCase();
        return soLicenses.filter(lic => {
            if (!soLicenseMatchesFilter(lic, soLicenseFilter)) return false;
            if (!q) return true;
            const norm = soNormalizeLicenseKeyQuery(q);
            if (norm && lic.key && lic.key.toUpperCase().includes(norm.replace(/-/g, ''))) return true;
            if (norm && lic.key && lic.key.toUpperCase().includes(norm)) return true;
            return soLicenseSearchHaystack(lic).includes(q);
        });
    }

    function soGetQuickFilteredLicenses() {
        const q = String(document.getElementById('so-license-quick-search')?.value || '').trim().toLowerCase();
        const quickFilter = document.getElementById('so-license-quick-filter')?.value || 'all';
        return soLicenses.filter(lic => {
            if (!soLicenseMatchesFilter(lic, quickFilter)) return false;
            if (!q) return true;
            const norm = soNormalizeLicenseKeyQuery(q);
            if (norm && lic.key && lic.key.toUpperCase().includes(norm)) return true;
            if (norm && lic.key && lic.key.replace(/-/g, '').includes(norm.replace(/-/g, ''))) return true;
            return soLicenseSearchHaystack(lic).includes(q);
        });
    }

    function soPaginateSlice(arr, page, pageSize) {
        const total = arr.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
        const safePage = Math.min(Math.max(1, page), totalPages);
        const start = (safePage - 1) * pageSize;
        return {
            items: arr.slice(start, start + pageSize),
            page: safePage,
            totalPages,
            total
        };
    }

    function soRenderPaginationControls(containerId, page, pageSize, total, prevHandler, nextHandler) {
        const el = document.getElementById(containerId);
        if (!el) return page;
        const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
        const safePage = Math.min(Math.max(1, page), totalPages);
        const start = total ? (safePage - 1) * pageSize + 1 : 0;
        const end = Math.min(safePage * pageSize, total);
        el.innerHTML = `<div class="so-pagination">
            <span class="so-pagination-meta">${total ? `Showing ${start}–${end} of ${total}` : 'No licenses'}</span>
            <div class="so-pagination-btns">
                <button type="button" class="so-btn-sm so-btn-touch" data-so-page-prev="${containerId}" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
                <span class="so-pagination-page">Page ${safePage} / ${totalPages}</span>
                <button type="button" class="so-btn-sm so-btn-touch" data-so-page-next="${containerId}" ${safePage >= totalPages ? 'disabled' : ''}>Next</button>
            </div>
        </div>`;
        const prevBtn = el.querySelector('[data-so-page-prev]');
        const nextBtn = el.querySelector('[data-so-page-next]');
        if (prevBtn && safePage > 1) {
            prevBtn.onclick = () => { prevHandler(safePage - 1); };
        }
        if (nextBtn && safePage < totalPages) {
            nextBtn.onclick = () => { nextHandler(safePage + 1); };
        }
        return safePage;
    }

    function soLicenseQuickSelectLabel(lic) {
        const exp = soFormatLicenseExpiryDetail(lic);
        const plan = lic.planId || lic.planType || '—';
        const status = soRegistryStatusLabel(soGetLicenseRegistryStatus(lic));
        return `${lic.key} · ${plan} · ${exp.label} · ${status}`;
    }

    function soRenderLicenseQuickDetails(lic) {
        const panel = document.getElementById('so-license-quick-details');
        const keyEl = document.getElementById('so-license-quick-key-display');
        const editBtn = document.getElementById('so-license-quick-edit-btn');
        const scrollBtn = document.getElementById('so-license-quick-scroll-btn');
        if (!panel) return;
        if (!lic) {
            if (keyEl) keyEl.value = '';
            if (editBtn) editBtn.disabled = true;
            if (scrollBtn) scrollBtn.disabled = true;
            panel.innerHTML = '<p class="so-admin-muted">Select or search for a license to view validity.</p>';
            return;
        }
        soLicenseQuickSelectedKey = lic.key;
        if (keyEl) keyEl.value = lic.key || '';
        if (editBtn) editBtn.disabled = false;
        if (scrollBtn) scrollBtn.disabled = false;
        const created = soFormatLicenseCreated(lic);
        const expiry = soFormatLicenseExpiryDetail(lic);
        const activated = soIsLicenseActivated(lic);
        const shared = soIsLicenseShared(lic);
        const status = soGetLicenseRegistryStatus(lic);
        const expiryClass = expiry.kind === 'expired' ? 'so-quick-exp--bad'
            : (expiry.kind === 'active' && expiry.sub && expiry.sub.includes('day') && parseInt(expiry.sub, 10) <= 7 ? 'so-quick-exp--warn' : '');
        panel.innerHTML = `
            <div class="so-license-quick-detail-grid">
                <div class="so-license-quick-detail-card">
                    <div class="so-license-quick-detail-label">Created</div>
                    <div class="so-license-quick-detail-value">${soEsc(created)}</div>
                </div>
                <div class="so-license-quick-detail-card ${expiryClass}">
                    <div class="so-license-quick-detail-label">Expires</div>
                    <div class="so-license-quick-detail-value">${soEsc(expiry.label)}</div>
                    <div class="so-license-quick-detail-sub">${soEsc(expiry.sub || '')}</div>
                </div>
                <div class="so-license-quick-detail-card">
                    <div class="so-license-quick-detail-label">Status</div>
                    <div class="so-license-quick-detail-value">${soEsc(soRegistryStatusLabel(status))}</div>
                </div>
                <div class="so-license-quick-detail-card">
                    <div class="so-license-quick-detail-label">Plan · Credits</div>
                    <div class="so-license-quick-detail-value">${soEsc(lic.planId || lic.planType || '—')}</div>
                    <div class="so-license-quick-detail-sub">${soEsc(soFormatCreditsLabel(lic))}</div>
                </div>
            </div>
            <div class="so-license-quick-detail-meta">
                ${lic.customer_name || lic.customer_email || lic.customer_phone
                    ? `<strong>Customer:</strong> ${soEsc([lic.customer_name, lic.customer_email, lic.customer_phone].filter(Boolean).join(' · '))}<br>`
                    : ''}
                ${activated ? `<strong>Activated:</strong> ${soEsc(soFormatTs(lic.activatedAt))}<br>` : '<strong>Activated:</strong> Not yet<br>'}
                ${shared ? `<strong>Shared:</strong> ${soEsc(soFormatTs(lic.shared_at || lic.sharedAt))}` : '<strong>Shared:</strong> Not yet'}
            </div>`;
    }

    function soSyncLicenseQuickSelectOptions() {
        const select = document.getElementById('so-license-quick-select');
        if (!select) return;
        const filtered = soGetQuickFilteredLicenses();
        const searchNorm = soNormalizeLicenseKeyQuery(
            document.getElementById('so-license-quick-search')?.value || ''
        );
        const exactMatch = searchNorm
            ? filtered.find(l => l.key === searchNorm || l.key.replace(/-/g, '') === searchNorm.replace(/-/g, ''))
            : null;
        if (exactMatch) {
            const exactIdx = filtered.findIndex(l => l.key === exactMatch.key);
            if (exactIdx >= 0) {
                soLicenseQuickPage = Math.floor(exactIdx / SO_LICENSE_QUICK_PAGE_SIZE) + 1;
                soLicenseQuickSelectedKey = exactMatch.key;
            }
        } else if (soLicenseQuickSelectedKey && filtered.some(l => l.key === soLicenseQuickSelectedKey)) {
            const selIdx = filtered.findIndex(l => l.key === soLicenseQuickSelectedKey);
            if (selIdx >= 0) {
                soLicenseQuickPage = Math.floor(selIdx / SO_LICENSE_QUICK_PAGE_SIZE) + 1;
            }
        }
        const pageData = soPaginateSlice(filtered, soLicenseQuickPage, SO_LICENSE_QUICK_PAGE_SIZE);
        soLicenseQuickPage = soRenderPaginationControls(
            'so-license-quick-pagination',
            pageData.page,
            SO_LICENSE_QUICK_PAGE_SIZE,
            pageData.total,
            (p) => { soLicenseQuickPage = p; soSyncLicenseQuickSelectOptions(); },
            (p) => { soLicenseQuickPage = p; soSyncLicenseQuickSelectOptions(); }
        );
        if (!pageData.items.length) {
            select.innerHTML = '<option value="">No licenses match</option>';
            soRenderLicenseQuickDetails(null);
            return;
        }
        let selected = soLicenseQuickSelectedKey;
        if (!selected || !pageData.items.some(l => l.key === selected)) {
            selected = exactMatch?.key || pageData.items[0]?.key || '';
        }
        select.innerHTML = pageData.items.map(lic =>
            `<option value="${soAttr(lic.key)}"${lic.key === selected ? ' selected' : ''}>${soEsc(soLicenseQuickSelectLabel(lic))}</option>`
        ).join('');
        const lic = soLicenses.find(l => l.key === selected) || pageData.items[0];
        if (lic) soRenderLicenseQuickDetails(lic);
    }

    function soRenderLicenseQuickLookup() {
        soSyncLicenseQuickSelectOptions();
    }

    function soRefreshLicenseUIs() {
        renderSoLicensesList();
        soRenderLicenseQuickLookup();
    }

    window.soCopyText = function(text) {
        const val = String(text || '').trim();
        if (!val) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(() => soToast('Copied.')).catch(() => {
                soToast('Copy failed — select text and copy manually.');
            });
        } else {
            soToast('Select text and copy (Ctrl+C).');
        }
    };

    window.soOnLicenseQuickSearchInput = function() {
        soLicenseQuickPage = 1;
        const q = String(document.getElementById('so-license-quick-search')?.value || '').trim();
        const norm = soNormalizeLicenseKeyQuery(q);
        if (norm) {
            const exact = soLicenses.find(l =>
                l.key === norm ||
                l.key.replace(/-/g, '') === norm.replace(/-/g, '')
            );
            if (exact) soLicenseQuickSelectedKey = exact.key;
        }
        soRenderLicenseQuickLookup();
    };

    window.soOnLicenseQuickFilterChange = function() {
        soLicenseQuickPage = 1;
        soRenderLicenseQuickLookup();
    };

    window.soOnLicenseQuickSelectChange = function() {
        const key = document.getElementById('so-license-quick-select')?.value || '';
        soLicenseQuickSelectedKey = key;
        const lic = soLicenses.find(l => l.key === key);
        soRenderLicenseQuickDetails(lic || null);
    };

    window.soCopyLicenseKeyQuick = function() {
        const key = document.getElementById('so-license-quick-key-display')?.value
            || soLicenseQuickSelectedKey
            || '';
        if (!key) return soToast('Select a license first.');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(key).then(() => soToast('License key copied.')).catch(() => {
                soToast('Copy failed — tap the key field and copy manually.');
            });
        } else {
            const el = document.getElementById('so-license-quick-key-display');
            if (el) { el.focus(); el.select(); }
            soToast('Select the key field and copy (Ctrl+C).');
        }
    };

    window.soEditLicenseQuickSelection = function() {
        if (!soLicenseQuickSelectedKey) return soToast('Select a license first.');
        editSoLicense(soLicenseQuickSelectedKey);
    };

    window.soScrollToLicenseInList = function() {
        if (!soLicenseQuickSelectedKey) return soToast('Select a license first.');
        soOpenSections.add('license-list');
        document.querySelectorAll('.so-section-accordion[data-so-section]').forEach(el => {
            const id = el.getAttribute('data-so-section');
            if (id) el.classList.toggle('so-section-accordion--open', soOpenSections.has(id));
        });
        const search = document.getElementById('so-license-search');
        if (search) search.value = soLicenseQuickSelectedKey;
        soLicenseListPage = 1;
        renderSoLicensesList();
        soExpandedLicenseKeys.add(soLicenseQuickSelectedKey);
        renderSoLicensesList();
        const row = Array.from(document.querySelectorAll('.so-license-row')).find(
            (r) => r.dataset.licenseKey === soLicenseQuickSelectedKey
        );
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.soRefreshLicenseQuickLookup = async function() {
        try {
            await soLoadLicenses();
            soRefreshLicenseUIs();
            soToast('Licenses refreshed.');
        } catch (e) {
            soToast('Refresh failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.soOnLicenseListSearchInput = function() {
        soLicenseListPage = 1;
        renderSoLicensesList();
    };

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
        if (soHydrating || !soSnapshotsReady || !soAllowDirtyMark) return;
        if (tab === 'config' || tab === 'credits') {
            soUserEditedSinceLoad = true;
            soDirtyTabs[tab] = true;
            soUpdateUnsavedBanner();
            soScheduleDraftSave();
        }
    };

    function soClearAllDirty() {
        soDirtyTabs.config = false;
        soDirtyTabs.credits = false;
        soUpdateUnsavedBanner();
    }

    function soClearDirtyTab(tab) {
        if (tab === 'config' || tab === 'credits') soDirtyTabs[tab] = false;
        soUpdateUnsavedBanner();
    }

    function soComputeDirtyFromSnapshots() {
        if (!soSnapshotsReady || soHydrating || !soAllowDirtyMark) {
            return { config: false, credits: false };
        }
        return {
            config: soTabSnapshots.config != null && soSerializeConfigTabState() !== soTabSnapshots.config,
            credits: soTabSnapshots.credits != null && soSerializeCreditsTabState() !== soTabSnapshots.credits
        };
    }

    /** After partial save — clear dirty only if DOM now matches snapshot baseline */
    function soSyncDirtyFromSnapshots() {
        const dirty = soComputeDirtyFromSnapshots();
        soDirtyTabs.config = dirty.config;
        soDirtyTabs.credits = dirty.credits;
        soApplyUnsavedBannerVisibility();
        if (!soDirtyTabs.config && !soDirtyTabs.credits) soClearDraftStorage();
    }

    function soAfterTabSaved(tab) {
        if (tab === 'config' || tab === 'credits') {
            if (tab === 'config') soTabSnapshots.config = soSerializeConfigTabState();
            if (tab === 'credits') soTabSnapshots.credits = soSerializeCreditsTabState();
        }
        soClearDirtyTab(tab);
        if (!soDirtyTabs.config && !soDirtyTabs.credits) soClearDraftStorage();
        soUpdateUnsavedBanner();
    }

    window.soHasUnsavedChanges = function() {
        if (!soSnapshotsReady || !soAllowDirtyMark || !soUserEditedSinceLoad) return false;
        const dirty = soComputeDirtyFromSnapshots();
        return !!(dirty.config || dirty.credits);
    };

    function soDraftsEnabled() {
        return typeof adminCrudDraftsEnabled === 'function' ? adminCrudDraftsEnabled() : true;
    }

    function soReadGeneralConfigLenient() {
        return {
            whatsapp_number: String(document.getElementById('so-whatsapp-number')?.value || '').replace(/\D/g, ''),
            whatsapp_message: String(document.getElementById('so-whatsapp-message')?.value || '').trim(),
            extension_enabled: !!document.getElementById('so-extension-enabled')?.checked,
            min_extension_version: String(document.getElementById('so-min-version')?.value || DEFAULT_MIN_VERSION).trim(),
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

    function soRenderPackDetailSectionRow(section, packIdx, secIdx) {
        const sec = section || {};
        const itemsText = Array.isArray(sec.items) ? sec.items.join('\n') : '';
        return `
            <div class="so-plan-detail-section-row" data-detail-idx="${secIdx}">
                <label><span>Section title</span><input type="text" data-detail-field="title" value="${soAttr(sec.title || '')}" oninput="soMarkTabDirty('credits')"></label>
                <label><span>Body (optional)</span><textarea rows="2" data-detail-field="body" oninput="soMarkTabDirty('credits')">${soEsc(sec.body || '')}</textarea></label>
                <label><span>Items (one per line)</span><textarea rows="3" data-detail-field="items" oninput="soMarkTabDirty('credits')">${soEsc(itemsText)}</textarea></label>
                <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="removeSoPackDetailSection(${packIdx}, ${secIdx})">Remove section</button>
            </div>`;
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
        const mode = String(g.stop_billing_mode || DEFAULT_IMAGE_GENERATION.stop_billing_mode).toLowerCase();
        g.stop_billing_mode = SO_STOP_BILLING_MODES.includes(mode) ? mode : DEFAULT_IMAGE_GENERATION.stop_billing_mode;
        g.stop_billing_min_charge = Math.max(0, parseFloat(g.stop_billing_min_charge) || 0);
        const roundDec = parseInt(g.stop_billing_round_decimals, 10);
        g.stop_billing_round_decimals = Number.isFinite(roundDec) && roundDec >= 0 && roundDec <= 6
            ? roundDec
            : DEFAULT_IMAGE_GENERATION.stop_billing_round_decimals;
        g.stop_billing_full_on_complete = g.stop_billing_full_on_complete !== false;
        return g;
    }

    function soReadImageGenerationFromDom() {
        return soNormalizeImageGeneration({
            enabled: !!document.getElementById('so-img-gen-enabled')?.checked,
            credits_per_image: document.getElementById('so-img-gen-credits')?.value,
            daily_limit: document.getElementById('so-img-gen-daily-limit')?.value,
            monthly_limit: document.getElementById('so-img-gen-monthly-limit')?.value,
            max_batch_size: document.getElementById('so-img-gen-batch-max')?.value,
            stop_billing_mode: document.getElementById('so-img-gen-stop-mode')?.value,
            stop_billing_min_charge: document.getElementById('so-img-gen-stop-min')?.value,
            stop_billing_round_decimals: document.getElementById('so-img-gen-stop-round')?.value,
            stop_billing_full_on_complete: !!document.getElementById('so-img-gen-stop-full-complete')?.checked
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
        setVal('so-img-gen-stop-mode', img.stop_billing_mode);
        setVal('so-img-gen-stop-min', img.stop_billing_min_charge);
        setVal('so-img-gen-stop-round', img.stop_billing_round_decimals);
        const fullCompleteEl = document.getElementById('so-img-gen-stop-full-complete');
        if (fullCompleteEl) fullCompleteEl.checked = img.stop_billing_full_on_complete !== false;
        soUpdateImageGenStopBillingVisibility();
        soUpdateImageGenPreviewCard();
    }

    window.soUpdateImageGenStopBillingVisibility = function() {
        const mode = document.getElementById('so-img-gen-stop-mode')?.value || 'full';
        const proportional = mode === 'proportional';
        document.querySelectorAll('[data-so-stop-proportional]').forEach(el => {
            el.style.display = proportional ? '' : 'none';
        });
    };

    window.soUpdateImageGenPreviewCard = function() {
        const card = document.getElementById('so-img-gen-preview-card');
        if (!card) return;
        const img = soReadImageGenerationFromDom();
        const creditsLabel = img.credits_per_image === 0 ? '0 (free)' : String(img.credits_per_image);
        const base = `Example: customer uploads 1 image, selects 50 variants → counts as <strong>1 run</strong>, uses <strong>1</strong> from daily limit.`;
        let billingNote = '';
        if (img.stop_billing_mode === 'proportional') {
            const perCredit = img.credits_per_image || 1;
            const stopped = (perCredit * 5 / 50).toFixed(img.stop_billing_round_decimals);
            billingNote = ` <strong>Proportional billing:</strong> stop at 5/50 variants → charge <strong>${stopped}</strong> credits (base ${perCredit}/run).`;
        } else {
            billingNote = ` <strong>Full billing:</strong> charged <strong>${creditsLabel}</strong> credits at run start (even if stopped early).`;
        }
        card.innerHTML = base + billingNote;
    };

    function soNormalizeSmartModeVariantOption(opt, index) {
        const o = Object.assign({}, opt);
        o.value = Math.max(1, parseInt(o.value, 10) || 20);
        o.label = String(o.label || `${o.value} variants`).trim();
        o.active = o.active !== false;
        o.order = Number.isFinite(Number(o.order)) ? Number(o.order) : index;
        return o;
    }

    function soNormalizeSmartMode(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        let options = [];
        if (Array.isArray(src.variant_options) && src.variant_options.length) {
            options = src.variant_options.map((opt, i) => {
                if (typeof opt === 'number' || (typeof opt === 'string' && /^\d+$/.test(opt))) {
                    const val = parseInt(opt, 10);
                    return soNormalizeSmartModeVariantOption({ value: val, label: `${val} variants`, active: true }, i);
                }
                return soNormalizeSmartModeVariantOption(opt, i);
            });
        } else {
            options = DEFAULT_SMART_MODE.variant_options.map(soNormalizeSmartModeVariantOption);
        }
        options.sort((a, b) => (a.order || 0) - (b.order || 0));
        options.forEach((o, i) => { o.order = i; });
        const activeValues = options.filter(o => o.active !== false).map(o => o.value);
        let defaultVariant = parseInt(src.default_variant, 10);
        if (!Number.isFinite(defaultVariant) || !activeValues.includes(defaultVariant)) {
            defaultVariant = activeValues[0] || options[0]?.value || DEFAULT_SMART_MODE.default_variant;
        }
        return {
            variant_options: options,
            default_variant: defaultVariant,
            max_variants_cap: Math.max(0, parseInt(src.max_variants_cap, 10) || DEFAULT_SMART_MODE.max_variants_cap),
            label: String(src.label || DEFAULT_SMART_MODE.label).trim(),
            hint: String(src.hint || DEFAULT_SMART_MODE.hint).trim()
        };
    }

    function soSmartModeToFirestore(mode) {
        const m = soNormalizeSmartMode(mode);
        return {
            variant_options: m.variant_options.map((o, i) => ({
                value: o.value,
                label: o.label,
                active: o.active !== false,
                order: i
            })),
            default_variant: m.default_variant,
            max_variants_cap: m.max_variants_cap,
            label: m.label,
            hint: m.hint
        };
    }

    function soReadSmartModeVariantOptionsFromDom() {
        const container = document.getElementById('so-smart-mode-options');
        if (!container) return (soSmartMode || DEFAULT_SMART_MODE).variant_options.slice();
        return Array.from(container.querySelectorAll('.so-smart-mode-option-row')).map((row, idx) => {
            const get = (field) => {
                const el = row.querySelector(`[data-smart-field="${field}"]`);
                if (!el) return '';
                if (el.type === 'checkbox') return el.checked;
                return el.value;
            };
            return soNormalizeSmartModeVariantOption({
                value: get('value'),
                label: get('label'),
                active: get('active'),
                order: idx
            }, idx);
        });
    }

    function soReadSmartModeFromDom() {
        const options = soReadSmartModeVariantOptionsFromDom();
        const activeValues = options.filter(o => o.active !== false).map(o => o.value);
        let defaultVariant = parseInt(document.getElementById('so-smart-default-variant')?.value, 10);
        if (!Number.isFinite(defaultVariant) || !activeValues.includes(defaultVariant)) {
            defaultVariant = activeValues[0] || options[0]?.value || DEFAULT_SMART_MODE.default_variant;
        }
        return soNormalizeSmartMode({
            variant_options: options,
            default_variant: defaultVariant,
            max_variants_cap: document.getElementById('so-smart-max-cap')?.value,
            label: document.getElementById('so-smart-label')?.value,
            hint: document.getElementById('so-smart-hint')?.value
        });
    }

    function soRenderSmartModeVariantRow(opt, idx) {
        const o = soNormalizeSmartModeVariantOption(opt, idx);
        const open = soExpandedSmartOptionIdxs.has(idx);
        const statusBadge = o.active !== false
            ? '<span class="so-badge so-badge--on">Visible</span>'
            : '<span class="so-badge so-badge--off">Hidden</span>';
        return `
            <div class="so-smart-mode-option-row so-plan-card so-collapsible-row ${open ? 'so-collapsible-row--open' : ''}" data-smart-idx="${idx}">
                <div class="so-plan-card-head-wrap">
                    <button type="button" class="so-plan-card-head" onclick="toggleSoSmartModeOptionRow(${idx})" aria-expanded="${open ? 'true' : 'false'}">
                        <span class="so-plan-order" aria-hidden="true">${idx + 1}</span>
                        <div class="so-plan-card-summary">
                            <div class="so-plan-card-title-row">
                                <strong class="so-plan-card-name so-smart-option-summary-name">${soEsc(o.label)}</strong>
                                <span class="so-meta-chip">${soEsc(String(o.value))} variants</span>
                            </div>
                            <div class="so-plan-card-badges">${statusBadge}</div>
                        </div>
                        <i class="fa fa-chevron-down so-plan-chevron" aria-hidden="true"></i>
                    </button>
                    <div class="so-plan-reorder" onclick="event.stopPropagation()">
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoSmartModeOption(${idx}, -1)" title="Move up" aria-label="Move option up">▲</button>
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoSmartModeOption(${idx}, 1)" title="Move down" aria-label="Move option down">▼</button>
                    </div>
                </div>
                <div class="so-plan-card-body" onclick="event.stopPropagation()">
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-list"></i> Dropdown option</div>
                        <div class="so-plan-fields so-plan-fields--basic">
                            <label><span>Variant count (value)</span><input type="number" min="1" step="1" data-smart-field="value" value="${o.value}" oninput="soOnSmartModeOptionInput(${idx})"></label>
                            <label><span>Dropdown label</span><input type="text" data-smart-field="label" value="${soAttr(o.label)}" oninput="soOnSmartModeOptionInput(${idx})"></label>
                            <label class="so-plan-check"><input type="checkbox" data-smart-field="active" ${o.active !== false ? 'checked' : ''} onchange="soOnSmartModeOptionInput(${idx})"> Show in extension dropdown</label>
                        </div>
                    </div>
                    <div class="so-plan-actions-bar">
                        <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="removeSoSmartModeOption(${idx})"><i class="fa fa-trash"></i> Remove option</button>
                    </div>
                </div>
            </div>`;
    }

    function soUpdateSmartModeOptionsCount() {
        const el = document.getElementById('so-smart-options-count');
        if (!el) return;
        const options = soReadSmartModeVariantOptionsFromDom();
        const active = options.filter(o => o.active !== false).length;
        const n = options.length;
        el.textContent = n === 1
            ? `1 option (${active} visible)`
            : `${n} options (${active} visible)`;
    }

    function soRenderSmartModeEditor() {
        const container = document.getElementById('so-smart-mode-options');
        if (!container) return;
        const mode = soSmartMode || soNormalizeSmartMode(soConfig?.smart_mode);
        if (!mode.variant_options.length) {
            container.innerHTML = '<div class="so-plans-empty"><i class="fa fa-wand-magic-sparkles"></i><p>No variant options yet</p><span class="so-admin-muted">Tap + Add variant option</span></div>';
        } else {
            container.innerHTML = mode.variant_options.map((opt, idx) => soRenderSmartModeVariantRow(opt, idx)).join('');
        }
        soUpdateSmartModeOptionsCount();
        soUpdateSmartModeDefaultSelect();
    }

    function soBindSmartModeForm() {
        const mode = soNormalizeSmartMode(soSmartMode || soConfig?.smart_mode);
        soSmartMode = mode;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        setVal('so-smart-max-cap', mode.max_variants_cap);
        setVal('so-smart-label', mode.label);
        setVal('so-smart-hint', mode.hint);
        soRenderSmartModeEditor();
    }

    window.soUpdateSmartModeDefaultSelect = function() {
        const select = document.getElementById('so-smart-default-variant');
        if (!select) return;
        const options = soReadSmartModeVariantOptionsFromDom().filter(o => o.active !== false);
        const current = parseInt(select.value, 10);
        select.innerHTML = options.map(o =>
            `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${soEsc(o.label)} (${o.value})</option>`
        ).join('');
        if (!options.some(o => o.value === current) && options.length) {
            select.value = String(options[0].value);
        }
        const batchMax = parseInt(document.getElementById('so-img-gen-batch-max')?.value, 10);
        const hint = document.getElementById('so-smart-batch-hint');
        if (hint) {
            if (Number.isFinite(batchMax) && batchMax > 0) {
                hint.textContent = `Options above ${batchMax} variants are hidden in the extension when max variants per run is set.`;
                hint.hidden = false;
            } else {
                hint.hidden = true;
            }
        }
    };

    window.soOnSmartModeOptionInput = function(idx) {
        soMarkTabDirty('credits');
        const row = document.querySelector(`.so-smart-mode-option-row[data-smart-idx="${idx}"]`);
        if (row) {
            const value = row.querySelector('[data-smart-field="value"]')?.value;
            const label = row.querySelector('[data-smart-field="label"]')?.value;
            const active = !!row.querySelector('[data-smart-field="active"]')?.checked;
            const nameEl = row.querySelector('.so-smart-option-summary-name');
            if (nameEl) nameEl.textContent = String(label || `${value} variants`).trim();
            const badges = row.querySelector('.so-plan-card-badges');
            if (badges) {
                badges.innerHTML = active
                    ? '<span class="so-badge so-badge--on">Visible</span>'
                    : '<span class="so-badge so-badge--off">Hidden</span>';
            }
        }
        soUpdateSmartModeOptionsCount();
        soUpdateSmartModeDefaultSelect();
    };

    window.toggleSoSmartModeOptionRow = function(idx) {
        soSmartMode = soReadSmartModeFromDom();
        const opening = !soExpandedSmartOptionIdxs.has(idx);
        if (soExpandedSmartOptionIdxs.has(idx)) soExpandedSmartOptionIdxs.delete(idx);
        else soExpandedSmartOptionIdxs.add(idx);
        if (opening) {
            soOpenSections.add('credits-smart-mode');
            const section = document.querySelector('.so-section-accordion[data-so-section="credits-smart-mode"]');
            if (section) section.classList.add('so-section-accordion--open');
        }
        soRenderSmartModeEditor();
        if (opening) {
            requestAnimationFrame(() => {
                const row = document.querySelector(`.so-smart-mode-option-row[data-smart-idx="${idx}"]`);
                if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }
    };

    window.expandAllSoSmartModeOptions = function() {
        soSmartMode = soReadSmartModeFromDom();
        soSmartMode.variant_options.forEach((_, idx) => soExpandedSmartOptionIdxs.add(idx));
        soRenderSmartModeEditor();
    };

    window.collapseAllSoSmartModeOptions = function() {
        soExpandedSmartOptionIdxs.clear();
        soRenderSmartModeEditor();
    };

    window.addSoSmartModeOption = function() {
        soSmartMode = soReadSmartModeFromDom();
        const values = soSmartMode.variant_options.map(o => o.value);
        let nextVal = 20;
        while (values.includes(nextVal)) nextVal += 10;
        const newIdx = soSmartMode.variant_options.length;
        soSmartMode.variant_options.push(soNormalizeSmartModeVariantOption({
            value: nextVal,
            label: `${nextVal} variants`,
            active: true
        }, newIdx));
        soExpandedSmartOptionIdxs.add(newIdx);
        soOpenSections.add('credits-smart-mode');
        const section = document.querySelector('.so-section-accordion[data-so-section="credits-smart-mode"]');
        if (section) section.classList.add('so-section-accordion--open');
        soRenderSmartModeEditor();
        soMarkTabDirty('credits');
        requestAnimationFrame(() => {
            const row = document.querySelector(`.so-smart-mode-option-row[data-smart-idx="${newIdx}"]`);
            if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    window.removeSoSmartModeOption = function(idx) {
        soSmartMode = soReadSmartModeFromDom();
        const option = soSmartMode.variant_options[idx];
        if (!option) return;
        if (soSmartMode.variant_options.length <= 1) {
            return soToast('At least one variant option is required for the Smart Mode dropdown.');
        }
        const label = option.label || `${option.value} variants`;
        if (!confirm(`Remove "${label}" from the dropdown? Save to Firebase to apply in the extension.`)) return;
        soSmartMode.variant_options.splice(idx, 1);
        soExpandedSmartOptionIdxs.delete(idx);
        const nextExpanded = new Set();
        soExpandedSmartOptionIdxs.forEach(i => {
            if (i < idx) nextExpanded.add(i);
            else if (i > idx) nextExpanded.add(i - 1);
        });
        soExpandedSmartOptionIdxs = nextExpanded;
        soSmartMode = soNormalizeSmartMode(soSmartMode);
        soRenderSmartModeEditor();
        soMarkTabDirty('credits');
    };

    window.moveSoSmartModeOption = function(idx, dir) {
        soSmartMode = soReadSmartModeFromDom();
        const next = idx + dir;
        if (next < 0 || next >= soSmartMode.variant_options.length) return;
        const tmp = soSmartMode.variant_options[idx];
        soSmartMode.variant_options[idx] = soSmartMode.variant_options[next];
        soSmartMode.variant_options[next] = tmp;
        const expanded = soExpandedSmartOptionIdxs.has(idx);
        const nextExpanded = soExpandedSmartOptionIdxs.has(next);
        if (expanded) soExpandedSmartOptionIdxs.delete(idx);
        if (nextExpanded) soExpandedSmartOptionIdxs.delete(next);
        if (expanded) soExpandedSmartOptionIdxs.add(next);
        if (nextExpanded) soExpandedSmartOptionIdxs.add(idx);
        soSmartMode.variant_options.forEach((o, i) => { o.order = i; });
        soRenderSmartModeEditor();
        soMarkTabDirty('credits');
    };

    window.saveShippingOptimizerSmartMode = async function() {
        if (!soRequireExtensionWrite()) return;
        const smartModePayload = soSmartModeToFirestore(soReadSmartModeFromDom());
        const err = soValidateSmartMode(smartModePayload);
        if (err) return soToast(err);
        const creditsPayload = soBuildCreditsPayloadFromDom();
        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                smart_mode: smartModePayload,
                credits: creditsPayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }, { merge: true });
            soSmartMode = smartModePayload;
            soConfig = Object.assign({}, soConfig, { smart_mode: smartModePayload, credits: creditsPayload });
            soAfterTabSaved('credits');
            renderSoExtensionPreview();
            soToast('Smart Mode dropdown options saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    function soBuildGeneralCanonical(fromDom) {
        if (fromDom) return soReadGeneralConfigLenient();
        return {
            whatsapp_number: String(soConfig?.whatsapp_number || '919654414891').replace(/\D/g, ''),
            whatsapp_message: String(soConfig?.whatsapp_message || 'Hi! I want to purchase Shipping Optimizer license.').trim(),
            extension_enabled: soConfig?.extension_enabled !== false,
            min_extension_version: String(soConfig?.min_extension_version || DEFAULT_MIN_VERSION).trim(),
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
            smart_mode: fromDom ? soReadSmartModeFromDom() : soSmartModeToFirestore(soSmartMode || soConfig?.smart_mode || DEFAULT_SMART_MODE),
            pack_scopes_enabled: fromDom
                ? !!document.getElementById('so-pack-scopes-enabled')?.checked
                : c.pack_scopes_enabled === true,
            addon_scopes_enabled: fromDom
                ? !!document.getElementById('so-addon-scopes-enabled')?.checked
                : c.addon_scopes_enabled === true,
            packs: packs.map((p, i) => soCreditPackToFirestore(p, i)),
            addon_catalog: soSerializeAddonCatalog(fromDom)
        };
    }

    function soSerializeConfigTabState() {
        return JSON.stringify(soBuildConfigCanonicalObject(true));
    }

    function soSerializeCreditsTabState() {
        return JSON.stringify(soBuildCreditsCanonicalObject(true));
    }

    function soCaptureSnapshots(fromDom) {
        const useDom = fromDom !== false;
        soTabSnapshots.config = JSON.stringify(soBuildConfigCanonicalObject(useDom));
        soTabSnapshots.credits = JSON.stringify(soBuildCreditsCanonicalObject(useDom));
        soClearAllDirty();
    }

    function soRebindAllFormsFromState() {
        soBindConfigForm();
        soBindSupportForm();
        soBindCreditsForm();
        soBindImageGenerationForm();
        soBindSmartModeForm();
        renderSoPlansEditor();
        renderSoInlineDemoKeysEditor();
        renderSoCreditPacksEditor();
        soUpdateCustomCreditCalc();
        soUpdateImageGenPreviewCard();
    }

    function soEstablishCleanBaseline() {
        soHydrating = true;
        soRebindAllFormsFromState();
        soTabSnapshots.config = soSerializeConfigTabState();
        soTabSnapshots.credits = soSerializeCreditsTabState();
        soClearAllDirty();
        soUserEditedSinceLoad = false;
        soHydrating = false;
    }

    function soEnableDirtyTrackingAfterSettle(loadGen) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (loadGen !== soLoadGeneration || soLoadInProgress) return;
                soEstablishCleanBaseline();
                soSnapshotsReady = true;
                soAllowDirtyMark = true;
                soClearDraftStorage();
                soApplyUnsavedBannerVisibility();
                soRenderDraftBanner();
                soPruneStaleDraft();
            });
        });
    }

    function soFinalizeAdminLoadState() {
        const loadGen = soLoadGeneration;
        soSnapshotsReady = false;
        soAllowDirtyMark = false;
        soUserEditedSinceLoad = false;
        soClearAllDirty();
        soHydrating = true;
        switchShippingOptimizerTab(soActiveTab);
        soEstablishCleanBaseline();
        soClearDraftStorage();
        soApplyUnsavedBannerVisibility();
        soEnableDirtyTrackingAfterSettle(loadGen);
    }

    /** Called when Super tab is shown — reset unsaved UI; reload only if not loaded yet */
    window.soOnSuperViewShown = function() {
        soAllowDirtyMark = false;
        soUserEditedSinceLoad = false;
        soClearAllDirty();
        soApplyUnsavedBannerVisibility();
        soClearDraftStorage();
        if (typeof window.soWarmExtensionFirebaseInBackground === 'function') {
            window.soWarmExtensionFirebaseInBackground();
        }
        const content = document.getElementById('shipping-optimizer-accordion-content');
        const panelOpen = content && content.style.display !== 'none' && content.style.display !== '';
        if (panelOpen && typeof window.loadShippingOptimizerAdmin === 'function') {
            window.loadShippingOptimizerAdmin(false);
        }
    };

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
        soAfterTabSaved(tab);
    }

    function soPlanReviewSummary(plan) {
        if (!plan) return '';
        const addons = (plan.credit_addons || []).filter(a => a.active !== false)
            .map(a => `${a.label || '+' + a.credits} (₹${a.price})`).join(', ');
        const parts = [
            `₹${plan.price}`,
            `${plan.included_credits || 0} cr`,
            plan.card_subtitle ? `"${plan.card_subtitle}"` : ''
        ];
        if (addons) parts.push(`add-ons: ${addons}`);
        return `${plan.name} [${plan.id}]: ${parts.filter(Boolean).join(' · ')}`;
    }

    function soBuildSaveReviewHtml(tab) {
        const lines = [];
        if (tab === 'config') {
            let before;
            let after;
            try {
                before = JSON.parse(soTabSnapshots.config || '{}');
                after = JSON.parse(soSerializeConfigTabState());
            } catch (_) {
                return '<p class="so-admin-muted">Could not compute diff — review form manually before saving.</p>';
            }
            const gKeys = ['whatsapp_number', 'whatsapp_message', 'min_extension_version', 'announcement'];
            gKeys.forEach(k => {
                const b = before.general?.[k];
                const a = after.general?.[k];
                if (String(b ?? '') !== String(a ?? '')) {
                    lines.push(`<li><strong>General · ${soEsc(k)}</strong><br><span class="so-admin-muted">Was:</span> ${soEsc(String(b ?? '—'))}<br><span class="so-admin-muted">Now:</span> ${soEsc(String(a ?? '—'))}</li>`);
                }
            });
            if (!!before.general?.extension_enabled !== !!after.general?.extension_enabled) {
                lines.push(`<li><strong>General · extension_enabled</strong>: ${before.general?.extension_enabled !== false ? 'ON' : 'OFF'} → ${after.general?.extension_enabled !== false ? 'ON' : 'OFF'}</li>`);
            }
            const bPlans = before.plans || [];
            const aPlans = after.plans || [];
            const bMap = {};
            bPlans.forEach(p => { bMap[p.id] = p; });
            const aMap = {};
            aPlans.forEach(p => { aMap[p.id] = p; });
            const allIds = [...new Set([...Object.keys(bMap), ...Object.keys(aMap)])].sort();
            allIds.forEach(id => {
                const b = bMap[id];
                const a = aMap[id];
                if (!b && a) lines.push(`<li><strong>Plan added</strong> — ${soEsc(soPlanReviewSummary(a))}</li>`);
                else if (b && !a) lines.push(`<li><strong>Plan removed</strong> — ${soEsc(soPlanReviewSummary(b))} <span class="so-admin-muted">(hidden from extension if deleted in editor)</span></li>`);
                else if (JSON.stringify(b) !== JSON.stringify(a)) {
                    lines.push(`<li><strong>Plan changed</strong> — ${soEsc(soPlanReviewSummary(a))}</li>`);
                }
            });
            const bDemo = JSON.stringify(before.inlineDemo || {});
            const aDemo = JSON.stringify(after.inlineDemo || {});
            if (bDemo !== aDemo) lines.push('<li><strong>Inline demo keys</strong> changed</li>');
            if (JSON.stringify(before.support) !== JSON.stringify(after.support)) {
                lines.push('<li><strong>Support contacts</strong> changed</li>');
            }
        } else if (tab === 'credits') {
            let before;
            let after;
            try {
                before = JSON.parse(soTabSnapshots.credits || '{}');
                after = JSON.parse(soSerializeCreditsTabState());
            } catch (_) {
                return '<p class="so-admin-muted">Could not compute diff.</p>';
            }
            ['enabled', 'price_per_credit', 'min_purchase', 'cost_per_operation'].forEach(k => {
                if (String(before[k]) !== String(after[k])) {
                    lines.push(`<li><strong>${soEsc(k)}</strong>: ${soEsc(String(before[k]))} → ${soEsc(String(after[k]))}</li>`);
                }
            });
            const bPacks = before.packs || [];
            const aPacks = after.packs || [];
            if (JSON.stringify(bPacks) !== JSON.stringify(aPacks)) {
                lines.push(`<li><strong>Credit packs</strong> (${aPacks.length} pack(s))</li>`);
            }
            if (JSON.stringify(before.smart_mode) !== JSON.stringify(after.smart_mode)) {
                lines.push('<li><strong>Smart Mode options</strong> changed</li>');
            }
            if (JSON.stringify(before.image_generation) !== JSON.stringify(after.image_generation)) {
                lines.push('<li><strong>Image generation billing</strong> changed</li>');
            }
            if (JSON.stringify(before.addon_catalog || []) !== JSON.stringify(after.addon_catalog || [])) {
                const n = (after.addon_catalog || []).length;
                lines.push(`<li><strong>Add-on catalog</strong> (${n} item${n === 1 ? '' : 's'})</li>`);
            }
        }
        if (!lines.length) {
            return '<p class="so-admin-muted" data-so-no-diff="1">No field-level diff vs last saved snapshot — you can still save current form values below.</p>';
        }
        return `<p class="so-admin-muted" style="margin-bottom:8px;">These changes will be written to Firebase. License and Google user records are <strong>not</strong> modified by config/credits saves.</p><ul class="so-save-review-list">${lines.join('')}</ul>`;
    }

    function soEnsureModalPortal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal && modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        return modal;
    }

    function soEnsureSaveReviewModalPortal() {
        return soEnsureModalPortal('so-save-review-modal');
    }

    function soCloseSaveReviewModal() {
        const modal = document.getElementById('so-save-review-modal');
        if (modal) {
            modal.hidden = true;
            modal.style.display = 'none';
        }
        document.body.classList.remove('so-save-review-open');
        soSaveReviewResolver = null;
    }

    let soActionPreviewResolver = null;

    function soEnsureActionPreviewModalPortal() {
        return soEnsureModalPortal('so-action-preview-modal');
    }

    function soCloseActionPreviewModal() {
        const modal = document.getElementById('so-action-preview-modal');
        if (modal) {
            modal.hidden = true;
            modal.style.display = 'none';
        }
        document.body.classList.remove('so-action-preview-open');
        soActionPreviewResolver = null;
    }

    function soOpenActionPreviewModal(opts) {
        const options = opts || {};
        const modal = soEnsureActionPreviewModalPortal();
        const body = document.getElementById('so-action-preview-body');
        const title = document.getElementById('so-action-preview-title');
        const confirmBtn = document.getElementById('so-action-preview-confirm');
        if (!modal || !body) {
            if (typeof options.onConfirm === 'function') options.onConfirm();
            return Promise.resolve(true);
        }
        if (title) title.textContent = options.title || 'Review before continuing';
        body.innerHTML = options.bodyHtml || '<p class="so-admin-muted">No preview available.</p>';
        if (confirmBtn) {
            confirmBtn.textContent = options.confirmLabel || 'Confirm';
            confirmBtn.style.display = '';
            confirmBtn.disabled = false;
            confirmBtn.classList.toggle('so-btn-danger', !!options.dangerous);
        }
        modal.hidden = false;
        modal.style.display = 'flex';
        document.body.classList.add('so-action-preview-open');
        requestAnimationFrame(() => {
            if (confirmBtn) confirmBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        return new Promise(resolve => {
            soActionPreviewResolver = async (ok) => {
                soCloseActionPreviewModal();
                resolve(!!ok);
                if (ok && typeof options.onConfirm === 'function') {
                    try {
                        await options.onConfirm();
                    } catch (e) {
                        soToast(e.message || 'Action failed.');
                    }
                }
            };
        });
    }

    window.soConfirmActionPreview = function() {
        if (soActionPreviewResolver) soActionPreviewResolver(true);
    };

    window.soCancelActionPreview = function() {
        if (soActionPreviewResolver) soActionPreviewResolver(false);
    };

    function soBuildLoadDefaultsPreviewHtml(tab) {
        const tabLabels = {
            config: 'Config & Pricing',
            credits: 'Credits & Packs',
            demo: 'Demo / Promo Keys',
            licenses: 'Paid Licenses',
            'google-trial': 'Google Free Trial'
        };
        const label = tabLabels[tab] || tab;
        const seed = soGetDefaultAppSeed();
        const lines = [
            `<p><strong>Action:</strong> Load built-in defaults into the <em>${soEsc(label)}</em> form.</p>`,
            '<p class="so-admin-muted"><strong>Safe:</strong> Does <em>not</em> write Firebase. Unsaved form edits on this tab will be replaced. Tap <strong>Save to Firebase</strong> separately when ready.</p>'
        ];
        if (tab === 'config') {
            const plans = (seed.plans || []).map((p, i) => soNormalizePlan(p, i));
            lines.push(`<p><strong>Plans (${plans.length}):</strong></p><ul class="so-save-review-list">${plans.map(p =>
                `<li>${soEsc(p.name)} · ₹${p.price} · ${p.included_credits || 0} cr · devices ${p.max_devices === 0 ? 'unlimited' : p.max_devices}</li>`
            ).join('')}</ul>`);
        } else if (tab === 'credits') {
            const packs = seed.credits?.packs || [];
            const addons = seed.credits?.addon_catalog || [];
            lines.push(`<p><strong>Credit rate:</strong> ₹${seed.credits?.price_per_credit}/cr · min ${seed.credits?.min_purchase} · ${packs.length} pack(s) · ${addons.length} catalog add-on(s)</p>`);
        } else if (tab === 'google-trial') {
            const t = soNormalizeGoogleTrial(seed.google_trial);
            lines.push(`<p><strong>Google trial:</strong> ${t.trial_credits} credits · ${t.max_devices} device(s) · login ${t.google_login_enabled ? 'on' : 'off'}</p>`);
        } else if (tab === 'demo') {
            lines.push('<p><strong>Demo key:</strong> <code>MEESHO-DEMOFREE</code> added to pending batch (if not already present).</p>');
        } else if (tab === 'licenses') {
            lines.push('<p><strong>License form</strong> will be cleared to create-new defaults.</p>');
        }
        lines.push('<p class="so-admin-muted">Open the <strong>Built-in defaults</strong> tab anytime for the full read-only preview.</p>');
        return lines.join('');
    }

    function soBuildSeedDefaultsPreviewHtml() {
        const seed = soGetDefaultAppSeed();
        const plans = (seed.plans || []).map((p, i) => soNormalizePlan(p, i));
        const packs = seed.credits?.packs || [];
        const trial = soNormalizeGoogleTrial(seed.google_trial);
        return `<p><strong>Action:</strong> Write the full built-in seed to <code>shipping_optimizer_config/app</code> (merge).</p>
            <p class="so-admin-muted" style="color:#f59e0b;"><strong>Warning:</strong> Overwrites config fields with seed values. Does <em>not</em> delete licenses, Google users, or demo_keys collection docs.</p>
            <ul class="so-save-review-list">
                <li><strong>Plans:</strong> ${plans.length} — ${plans.map(p => soEsc(p.name)).join(', ')}</li>
                <li><strong>Credit packs:</strong> ${packs.length}</li>
                <li><strong>Google trial:</strong> ${trial.trial_credits} credits · ${trial.max_devices} device limit</li>
                <li><strong>WhatsApp:</strong> ${soEsc(seed.whatsapp_number || '—')}</li>
            </ul>
            <p class="so-admin-muted">Prefer a safer path? Use <em>Load → Config form</em> then review → <em>Save to Firebase</em>.</p>`;
    }

    function soBuildFirebaseTabSavePreviewHtml(tab) {
        const tabLabels = {
            config: 'Config & Pricing',
            credits: 'Credits & Packs',
            demo: 'Demo / Promo Keys',
            'google-trial': 'Google Free Trial'
        };
        const label = tabLabels[tab] || tab;
        const confirmMsg = SO_SAVE_AS_DEFAULTS_CONFIRM[tab] || '';
        let detail = '';
        if (tab === 'config') {
            soPlans = soReadPlansFromDom();
            detail = `<ul class="so-save-review-list">${soPlans.map(p => `<li>${soEsc(soPlanReviewSummary(p))}</li>`).join('')}</ul>`;
        } else if (tab === 'credits') {
            const packs = soReadCreditPacksFromDom();
            detail = `<p><strong>${packs.length} credit pack(s)</strong> · rates from current form</p>`;
        }
        return `<p><strong>Action:</strong> Save current <em>${soEsc(label)}</em> form to Firebase.</p>
            <p class="so-admin-muted">${soEsc(confirmMsg)}</p>${detail}`;
    }

    function soBuildFullFirebaseSavePreviewHtml() {
        let built;
        try {
            built = soBuildFullAppPayloadFromForms();
        } catch (e) {
            return `<p class="so-admin-muted">Could not build preview: ${soEsc(e.message || 'Invalid forms')}</p>`;
        }
        const plans = built.payload?.plans || [];
        return `<p><strong>Action:</strong> Save <em>all</em> current admin forms to Firebase (merge).</p>
            <p class="so-admin-muted" style="color:#f59e0b;">Writes config, credits, smart mode, support, inline demo keys, and Google trial from forms now.</p>
            <ul class="so-save-review-list">
                <li><strong>Plans:</strong> ${plans.length}</li>
                <li><strong>Credit packs:</strong> ${(built.creditsPayload?.packs || []).length}</li>
                <li><strong>Google trial oauth:</strong> ${soEsc(built.googleTrialPayload?.oauth_client_id ? 'set' : 'missing')}</li>
            </ul>`;
    }

    function soBuildLicenseSavePreviewHtml(payload, mode, existingLic) {
        const key = payload.key || soEditingLicenseKey || '(new key)';
        const included = payload.included_credits != null ? payload.included_credits : 0;
        const addon = payload.addon_credits != null ? payload.addon_credits : 0;
        const custom = payload.custom_credits != null ? payload.custom_credits : 0;
        const bal = payload.credits_balance != null ? payload.credits_balance : 0;
        const used = payload.credits_used != null ? payload.credits_used : 0;
        const iUsed = payload.included_credits_used != null ? payload.included_credits_used : 0;
        const aUsed = payload.addon_credits_used != null ? payload.addon_credits_used : 0;
        const cUsed = payload.custom_credits_used != null ? payload.custom_credits_used : 0;
        const maxDev = payload.max_devices != null
            ? (payload.max_devices === 0 ? 'unlimited' : payload.max_devices)
            : 'from plan';
        const flags = [];
        if (payload.hide_plan_addons) flags.push('hide plan add-ons');
        if (payload.disable_plan_addons) flags.push('disable plan add-ons');
        if (payload.hide_custom_plan) flags.push('hide global custom plan');
        if (payload.disable_custom_plan) flags.push('disable global custom plan');
        if (payload.hide_license_custom_plans) flags.push('hide MY PLANS');
        if (payload.disable_license_custom_plans) flags.push('disable MY PLANS');
        const licPlans = payload.license_custom_plans;
        const visiblePlans = Array.isArray(licPlans) ? licPlans.filter(p => p && p.enabled !== false) : [];
        const disabledPlanCount = visiblePlans.filter(p => p.disabled).length;
        const licPlanCount = visiblePlans.length;
        const licPlanLine = licPlanCount > 0
            ? `<li><strong>License custom plans:</strong> ${licPlanCount} mapped${disabledPlanCount ? ` · ${disabledPlanCount} disabled block${disabledPlanCount === 1 ? '' : 's'}` : ''} (${soEsc(visiblePlans.map(p => `${p.label || p.id}${p.disabled ? ' [disabled]' : ''}`).join(', '))})</li>`
            : (mode === 'update' && existingLic && (soResolveLicenseCustomPlansFromDoc(existingLic).length)
                ? '<li><strong>License custom plans:</strong> cleared</li>'
                : '');
        const customerLine = (payload.customer_email || payload.customer_name || payload.customer_address)
            ? `<li><strong>Customer:</strong> ${soEsc([payload.customer_name, payload.customer_email, payload.customer_address].filter(Boolean).join(' · '))}</li>`
            : '';
        const prevPlan = existingLic ? (existingLic.planId || existingLic.planType || '') : '';
        const newPlan = payload.planId || payload.planType || '';
        const planChangeLine = mode === 'update' && prevPlan && newPlan && soSlugifyId(prevPlan) !== soSlugifyId(newPlan)
            ? `<li><strong>Plan change:</strong> <code>${soEsc(prevPlan)}</code> → <code>${soEsc(newPlan)}</code></li>`
            : '';
        return `<p><strong>Action:</strong> ${mode === 'update' ? 'Update' : 'Create'} license <code>${soEsc(String(key))}</code> in Firebase.</p>
            <ul class="so-save-review-list">
                <li><strong>Plan:</strong> ${soEsc(payload.planId || payload.planType || '—')}</li>
                <li><strong>Billing mode:</strong> ${soEsc(payload.billing_mode || 'subscription')}</li>
                ${planChangeLine}
                ${customerLine}
                ${licPlanLine}
                <li><strong>Subscription credits (included):</strong> ${included}</li>
                <li><strong>Add-on credits:</strong> ${addon}${payload.addon_credit_ids?.length ? ` · IDs: ${soEsc(payload.addon_credit_ids.join(', '))}` : ''}</li>
                <li><strong>Custom credits (license-only):</strong> ${custom}${payload.custom_credits_label ? ` · ${soEsc(payload.custom_credits_label)}` : ''}</li>
                <li><strong>Balance / used:</strong> ${bal} remaining · ${used} used</li>
                <li><strong>Consumed pools:</strong> subscription ${iUsed} · add-on ${aUsed} · custom ${cUsed}</li>
                <li><strong>Devices:</strong> ${maxDev}</li>
                ${flags.length ? `<li><strong>Extension flags:</strong> ${soEsc(flags.join(', '))}</li>` : ''}
            </ul>
            <p class="so-admin-muted">This writes only this license document — not app config.</p>`;
    }

    async function soConfirmActionPreviewModal(opts) {
        const ok = await soOpenActionPreviewModal(opts);
        return !!ok;
    }

    function soApplyLoadDefaultsForTab(tab) {
        const seed = soGetDefaultAppSeed();
        if (tab === 'config') {
            soApplySeedSectionToState(seed, 'config');
            soRefreshFormsAfterSeed('config');
            soToast('Config defaults loaded into form — review, then Save to Firebase when ready.');
        } else if (tab === 'credits') {
            soApplySeedSectionToState(seed, 'credits');
            soRefreshFormsAfterSeed('credits');
            soToast('Credits defaults loaded into form — review, then Save to Firebase when ready.');
        } else if (tab === 'demo') {
            const key = 'MEESHO-DEMOFREE';
            const entry = seed.demo_keys[key];
            const exists = soDemoKeys.some(d => d.key === key);
            if (exists) {
                soToast(`Demo key ${key} already exists in Firebase.`);
                return;
            }
            const pending = soDemoKeyPendingRows.some(r => String(r.key || '').toUpperCase() === key);
            if (!pending) {
                soDemoKeyPendingRows.push({
                    key,
                    days: entry.days,
                    label: entry.label,
                    max_uses: 0,
                    active: true
                });
                renderSoDemoPendingKeysEditor();
            }
            soToast(`Default demo key ${key} added to batch — review, then Save to Firebase.`);
        } else if (tab === 'licenses') {
            cancelSoLicenseEdit();
            soToast('License form reset.');
        } else if (tab === 'google-trial') {
            soApplySeedSectionToState(seed, 'google-trial');
            soRefreshFormsAfterSeed('google-trial');
            soToast('Google trial defaults loaded into form — Save to Firebase when ready.');
        }
    }

    async function soExecuteSeedAllDefaults() {
        if (!soRequireExtensionWrite()) return;
        const seed = soGetDefaultAppSeed();
        const payload = Object.assign({}, seed, {
            plans: seed.plans.map((p, i) => soPlanToFirestore(soNormalizePlan(p, i), i)),
            support: soSupportToFirestore(soNormalizeSupport(seed.support)),
            credits: Object.assign({}, seed.credits, {
                packs: seed.credits.packs.map((p, i) => soCreditPackToFirestore(soNormalizeCreditPack(p, i), i)),
                image_generation: seed.credits.image_generation
            }),
            smart_mode: soSmartModeToFirestore(soNormalizeSmartMode(seed.smart_mode)),
            google_trial: soGoogleTrialToFirestore(seed.google_trial)
        });
        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set(Object.assign({}, payload, {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }), { merge: true });
            const legacyDeletes = {};
            SO_GOOGLE_TRIAL_LEGACY_FIELDS.forEach((field) => {
                legacyDeletes[`google_trial.${field}`] = firebase.firestore.FieldValue.delete();
            });
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).update(legacyDeletes);
            soApplySeedSectionToState(seed, 'all');
            soRefreshFormsAfterSeed('all');
            soEstablishCleanBaseline();
            soClearDraftStorage();
            soToast('Full app config seeded to Firebase.');
        } catch (e) {
            soToast('Seed failed: ' + (e.message || 'Unknown error'));
        }
    }

    function soBuildTabSavePreviewSummary(tab) {
        if (tab === 'credits') {
            let state;
            try {
                state = JSON.parse(soSerializeCreditsTabState());
            } catch (_) {
                return '';
            }
            const packs = state.packs || [];
            const addons = state.addon_catalog || [];
            return `<ul class="so-save-review-list">
                <li><strong>Price/credit:</strong> ₹${state.price_per_credit} · min ${state.min_purchase}</li>
                <li><strong>Packs:</strong> ${packs.length} · <strong>Add-on catalog:</strong> ${addons.length}</li>
            </ul>`;
        }
        if (tab === 'config') {
            let state;
            try {
                state = JSON.parse(soSerializeConfigTabState());
            } catch (_) {
                return '';
            }
            return `<ul class="so-save-review-list"><li><strong>Plans:</strong> ${(state.plans || []).length}</li></ul>`;
        }
        return '';
    }

    let soSaveReviewResolver = null;

    function soOpenSaveReviewModal(tab, onConfirm) {
        const modal = soEnsureSaveReviewModalPortal();
        const body = document.getElementById('so-save-review-body');
        const title = document.getElementById('so-save-review-title');
        const confirmBtn = document.getElementById('so-save-review-confirm');
        if (!modal || !body) {
            if (typeof onConfirm === 'function') onConfirm();
            return Promise.resolve(true);
        }
        const tabLabel = tab === 'credits' ? 'Credits & Packs' : 'Config & Pricing';
        if (title) title.textContent = `Review changes — ${tabLabel}`;
        const html = soBuildSaveReviewHtml(tab);
        const noDiff = html.includes('data-so-no-diff');
        body.innerHTML = noDiff
            ? `${html}${soBuildTabSavePreviewSummary(tab)}`
            : html;
        if (confirmBtn) {
            confirmBtn.style.display = '';
            confirmBtn.textContent = 'Write to Firebase';
        }
        modal.hidden = false;
        modal.style.display = 'flex';
        document.body.classList.add('so-save-review-open');
        requestAnimationFrame(() => {
            if (confirmBtn) confirmBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        return new Promise(resolve => {
            soSaveReviewResolver = (ok) => {
                soCloseSaveReviewModal();
                resolve(!!ok);
                if (ok && typeof onConfirm === 'function') onConfirm();
            };
        });
    }

    window.soReviewUnsavedChanges = function() {
        const tab = soActiveTab === 'credits' ? 'credits' : soActiveTab === 'config' ? 'config' : null;
        if (!tab) return soToast('Review is available on Config or Credits tabs.');
        soOpenSaveReviewModal(tab);
    };

    window.soConfirmSaveReview = function() {
        if (soSaveReviewResolver) soSaveReviewResolver(true);
    };

    window.soCancelSaveReview = function() {
        if (soSaveReviewResolver) soSaveReviewResolver(false);
    };

    async function soConfirmSaveWithReview(tab, saveFn) {
        const dirty = soComputeDirtyFromSnapshots();
        const previewHtml = soBuildSaveReviewHtml(tab);
        const noDiff = previewHtml.includes('data-so-no-diff');
        if (!dirty[tab] && noDiff) return saveFn();
        if (noDiff && dirty[tab]) {
            const ok = await soConfirmActionPreviewModal({
                title: `Save ${tab === 'credits' ? 'Credits & Packs' : 'Config & Pricing'} → Firebase`,
                bodyHtml: `<p>Unsaved edits detected. Saving current form values.</p>${soBuildTabSavePreviewSummary(tab)}`,
                confirmLabel: 'Write to Firebase',
                dangerous: true,
                onConfirm: saveFn
            });
            return ok;
        }
        if (!dirty[tab]) return saveFn();
        return soOpenSaveReviewModal(tab, saveFn);
    }

    function soGuessAdminLocation() {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            const lang = navigator.language || '';
            return [tz, lang].filter(Boolean).join(' · ') || '';
        } catch (_) {
            return '';
        }
    }

    function soReadLicenseCustomerFields() {
        return {
            customer_name: String(document.getElementById('so-license-customer-name')?.value || '').trim(),
            customer_phone: String(document.getElementById('so-license-customer-phone')?.value || '').replace(/\D/g, ''),
            customer_email: String(document.getElementById('so-license-customer-email')?.value || '').trim(),
            customer_address: String(document.getElementById('so-license-customer-address')?.value || '').trim(),
            customer_location: String(document.getElementById('so-license-customer-location')?.value || '').trim(),
            customer_ip: String(document.getElementById('so-license-customer-ip')?.value || '').trim(),
        };
    }

    function soCustomerDetailsComplete(fields) {
        const f = fields || {};
        return !!(f.customer_name && (f.customer_phone || f.customer_email));
    }

    function soCustomerDetailsLabel(lic) {
        if (!lic) return 'Unassigned';
        const name = lic.customer_name || '';
        const phone = lic.customer_phone || '';
        const email = lic.customer_email || '';
        if (name || phone || email) {
            return name || phone || email;
        }
        return 'Unassigned customer';
    }

    function soLicenseCustomerSnapshot() {
        return soReadLicenseCustomerFields();
    }

    function soConfirmLicenseCustomerClear(existingLic) {
        if (!existingLic) return true;
        const next = soLicenseCustomerSnapshot();
        const had = existingLic.customer_name || existingLic.customer_phone || existingLic.customer_email
            || existingLic.customer_address || existingLic.customer_location || existingLic.customer_ip;
        const clearing = had && (!next.customer_name && !next.customer_phone && !next.customer_email
            && !next.customer_address && !next.customer_location && !next.customer_ip);
        const partialClear = (existingLic.customer_name && !next.customer_name)
            || (existingLic.customer_phone && !next.customer_phone)
            || (existingLic.customer_email && !next.customer_email)
            || (existingLic.customer_address && !next.customer_address)
            || (existingLic.customer_location && !next.customer_location)
            || (existingLic.customer_ip && !next.customer_ip);
        if (!clearing && !partialClear) return true;
        return confirm(
            'You are removing or clearing customer mapping fields on this license.\n\n'
            + `Was: ${[
                existingLic.customer_name,
                existingLic.customer_phone,
                existingLic.customer_email,
                existingLic.customer_address,
                existingLic.customer_location,
                existingLic.customer_ip,
            ].filter(Boolean).join(' · ') || '—'}\n\n`
            + 'Continue? Customer details help track who owns this license key.'
        );
    }

    function soApplyUnsavedBannerVisibility() {
        const banner = document.getElementById('so-unsaved-banner');
        if (!banner) return;
        const dirtyState = soComputeDirtyFromSnapshots();
        const dirty = soSnapshotsReady && soAllowDirtyMark && soUserEditedSinceLoad && !!dirtyState[soActiveTab];
        banner.hidden = !dirty;
        banner.style.display = dirty ? '' : 'none';
        const label = banner.querySelector('span');
        if (label && dirty) {
            const tabName = soActiveTab === 'credits' ? 'Credits & Packs' : 'Config & Pricing';
            label.textContent = `Unsaved changes on ${tabName}`;
        }
    }

    function soUpdateUnsavedBanner() {
        if (soSnapshotsReady && soAllowDirtyMark) {
            const dirty = soComputeDirtyFromSnapshots();
            soDirtyTabs.config = dirty.config;
            soDirtyTabs.credits = dirty.credits;
        }
        soApplyUnsavedBannerVisibility();
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
        if (!soDraftsEnabled()) return;
        if (!soDirtyTabs.config && !soDirtyTabs.credits) return;
        clearTimeout(soDraftSaveTimer);
        soDraftSaveTimer = setTimeout(() => {
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
        setVal('so-min-version', general.min_extension_version || DEFAULT_MIN_VERSION);
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
        if (credits.smart_mode) {
            soSmartMode = soNormalizeSmartMode(credits.smart_mode);
        } else if (soConfig?.smart_mode) {
            soSmartMode = soNormalizeSmartMode(soConfig.smart_mode);
        }

        soBindCreditsForm();
        soBindImageGenerationForm();
        soBindSmartModeForm();
        soBindSupportForm();
        renderSoCreditPacksEditor();
        renderSoPlansEditor();
        renderSoInlineDemoKeysEditor();
        soPopulateLicensePlanSelect();
        soUpdateCustomCreditCalc();
        soHydrating = false;
        soEstablishCleanBaseline();
        soClearDraftStorage();
        soUserEditedSinceLoad = true;
        soSyncDirtyFromSnapshots();
        soScheduleDraftSave();
    }

    function soEnableUserEditGate() { /* no-op — dirty tracked explicitly via soMarkTabDirty */ }

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
                : soGetDefaultPlansCopy();
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
            soExpandedSmartOptionIdxs.clear();
            const rawCredits = soConfig?.credits && typeof soConfig.credits === 'object' ? soConfig.credits : {};
            soCredits = Object.assign({}, DEFAULT_CREDITS, rawCredits);
            const rawPacks = soResolveCreditPacksFromConfig(rawCredits, DEFAULT_CREDIT_PACKS);
            soCreditPacks = soSortCreditPacks(rawPacks.map(soNormalizeCreditPack));
            soCreditPacks.forEach((p, i) => { p.order = i; });
            soSmartMode = soNormalizeSmartMode(
                soConfig.smart_mode
                || rawCredits.smart_mode
                || DEFAULT_SMART_MODE
            );
            soBindCreditsForm();
            soBindImageGenerationForm();
            soBindSmartModeForm();
            renderSoCreditPacksEditor();
            renderSoAddonCatalogEditor();
            soUpdateCustomCreditCalc();
        }
        soHydrating = false;
        soEstablishCleanBaseline();
        soClearDraftStorage();
        renderSoExtensionPreview();
        soToast('Reverted to last saved values.');
    };

    window.soSaveCurrentTab = async function() {
        if (soActiveTab === 'config') await saveShippingOptimizerConfig();
        else if (soActiveTab === 'credits') await saveShippingOptimizerCredits();
    };

    function soConfirmLeaveTab(nextTab) {
        if (!soUserEditedSinceLoad) return true;
        const dirty = soComputeDirtyFromSnapshots();
        if (!dirty[soActiveTab]) return true;
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
        if (open && typeof loadShippingOptimizerAdmin === 'function') {
            loadShippingOptimizerAdmin(false);
        }
    };

    function openShippingOptimizerPanel() {
        const content = document.getElementById('shipping-optimizer-accordion-content');
        const icon = document.getElementById('shipping-optimizer-accordion-icon');
        if (!content) return Promise.resolve();
        const closed = content.style.display === 'none' || !content.style.display;
        if (closed) {
            content.style.display = 'flex';
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
        if (typeof loadShippingOptimizerAdmin === 'function') {
            return loadShippingOptimizerAdmin(true);
        }
        return Promise.resolve();
    }

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
            soBindImageGenerationForm();
            soBindSmartModeForm();
            soUpdateCustomCreditCalc();
        }
        if (soActiveTab === 'demo') {
            renderSoDemoPendingKeysEditor();
            renderSoDemoKeysList();
        }
        if (soActiveTab === 'google-trial') {
            soBindGoogleTrialForm();
        }
        if (soActiveTab === 'google-users') {
            soLoadGoogleTrials()
                .then(() => renderSoGoogleTrialsRegistry())
                .catch(() => renderSoGoogleTrialsRegistry());
        }
        if (soActiveTab === 'config' || soActiveTab === 'credits') {
            renderSoExtensionPreview();
        }
        if (soActiveTab === 'licenses') soRefreshLicenseUIs();
        if (soActiveTab === 'customers') renderSoCustomerRegistry();
        if (soActiveTab === 'defaults') renderSoDefaultsSummary();
    };

    async function soLoadConfig() {
        const snap = await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).get();
        if (snap.exists) {
            soConfig = snap.data() || {};
        } else {
            soConfig = {};
        }
        const configWasEmpty = soIsConfigEmpty(soConfig);
        if (configWasEmpty) {
            soApplySeedSectionToState(soGetDefaultAppSeed(), 'all');
            soConfig = Object.assign({}, soGetDefaultAppSeed(), soConfig);
        }
        const rawPlans = Array.isArray(soConfig.plans) && soConfig.plans.length
            ? soConfig.plans
            : soGetDefaultPlansCopy();
        if (Array.isArray(soConfig.plans) && soConfig.plans.length === 0) {
            console.warn('[Shipping Optimizer] Firebase plans[] is empty — using built-in ₹199 defaults');
        }
        soPlans = soSortPlans(rawPlans.map(soNormalizePlan));
        soPlans.forEach((p, i) => { p.order = i; });
        soPopulateLicensePlanSelect();
        const rawCredits = soConfig.credits && typeof soConfig.credits === 'object' ? soConfig.credits : {};
        soCredits = Object.assign({}, DEFAULT_CREDITS, rawCredits);
        const rawCatalog = Array.isArray(rawCredits.addon_catalog) && rawCredits.addon_catalog.length
            ? rawCredits.addon_catalog
            : DEFAULT_ADDON_CATALOG.slice();
        soCredits.addon_catalog = soSortCreditAddons(rawCatalog.map(soNormalizeCreditAddon));
        const rawPacks = soResolveCreditPacksFromConfig(rawCredits, DEFAULT_CREDIT_PACKS);
        soCreditPacks = soSortCreditPacks(rawPacks.map(soNormalizeCreditPack));
        soCreditPacks.forEach((p, i) => { p.order = i; });
        if (soConfig.demo_keys && typeof soConfig.demo_keys === 'object') {
            soInlineDemoKeys = Object.assign({}, soConfig.demo_keys);
        } else {
            soInlineDemoKeys = Object.assign({}, DEFAULT_INLINE_DEMO_KEYS);
        }
        soSyncInlineDemoRowsFromObject();
        soSupport = soNormalizeSupport(soConfig.support || DEFAULT_SUPPORT);
        const smartModeRaw = soConfig.smart_mode
            || (soConfig.credits && soConfig.credits.smart_mode)
            || (soConfig.credits && soConfig.credits.smartMode)
            || DEFAULT_SMART_MODE;
        soSmartMode = soNormalizeSmartMode(smartModeRaw);
        soHydrating = true;
        soBindConfigForm();
        soBindGoogleTrialForm();
        soBindSupportForm();
        soBindCreditsForm();
        soBindImageGenerationForm();
        soBindSmartModeForm();
        renderSoCreditPacksEditor();
        renderSoAddonCatalogEditor();
        renderSoPlansEditor();
        renderSoInlineDemoKeysEditor();
        soHydrating = false;
        if (configWasEmpty) {
            soToast('Config doc empty — forms pre-filled with recommended defaults. Tap Save to Firebase when ready.');
        } else if (Array.isArray(soConfig.plans) && soConfig.plans.length === 0 && soPlans.length) {
            soToast('Firebase plans[] was empty — showing built-in ₹199 defaults. Save to Firebase to restore.');
        }
    }

    function soNormalizeGoogleTrial(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const trialCredits = soResolveTrialCredits(src);
        const unlimitedTime = src.unlimited_time !== false && src.unlimitedTime !== false;
        const daysRaw = parseInt(src.days, 10);
        const days = unlimitedTime
            ? 0
            : Math.max(1, Number.isFinite(daysRaw) ? daysRaw : DEFAULT_GOOGLE_TRIAL.days || 7);
        return {
            google_login_enabled: src.google_login_enabled !== false && src.googleLoginEnabled !== false,
            enabled: src.enabled !== false,
            unlimited_time: unlimitedTime,
            days,
            trial_credits: trialCredits,
            image_run_limit: trialCredits,
            max_increment_per_run: Math.max(1, parseInt(src.max_increment_per_run ?? src.maxIncrementPerRun, 10) || DEFAULT_GOOGLE_TRIAL.max_increment_per_run),
            max_devices: (() => {
                const n = parseInt(src.max_devices ?? src.maxDevices, 10);
                if (Number.isFinite(n) && n >= 0) return n;
                return DEFAULT_GOOGLE_TRIAL.max_devices;
            })(),
            label: String(src.label || DEFAULT_GOOGLE_TRIAL.label).trim(),
            oauth_client_id: String(src.oauth_client_id || src.oauthClientId || DEFAULT_GOOGLE_TRIAL.oauth_client_id || '').trim(),
            oauth_web_client_id: String(src.oauth_web_client_id || src.oauthWebClientId || DEFAULT_GOOGLE_TRIAL.oauth_web_client_id || '').trim(),
            chrome_extension_id: String(src.chrome_extension_id || src.chromeExtensionId || DEFAULT_GOOGLE_TRIAL.chrome_extension_id || '').trim()
        };
    }

    function soGoogleTrialToFirestore(trial) {
        const t = soNormalizeGoogleTrial(trial);
        const out = {
            google_login_enabled: t.google_login_enabled,
            enabled: t.enabled,
            unlimited_time: t.unlimited_time,
            days: t.days,
            trial_credits: t.trial_credits,
            image_run_limit: t.trial_credits,
            max_increment_per_run: t.max_increment_per_run,
            max_devices: t.max_devices,
            label: t.label
        };
        if (t.oauth_client_id) out.oauth_client_id = t.oauth_client_id;
        if (t.oauth_web_client_id) out.oauth_web_client_id = t.oauth_web_client_id;
        if (t.chrome_extension_id) out.chrome_extension_id = t.chrome_extension_id;
        return out;
    }

    async function soPersistGoogleTrial(payload) {
        const ref = soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID);
        await ref.set({
            google_trial: payload,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: soAuthEmail()
        }, { merge: true });
        const legacyDeletes = {};
        SO_GOOGLE_TRIAL_LEGACY_FIELDS.forEach((field) => {
            legacyDeletes[`google_trial.${field}`] = firebase.firestore.FieldValue.delete();
        });
        await ref.update(legacyDeletes);
        soConfig = Object.assign({}, soConfig || {}, { google_trial: payload });
        soBindGoogleTrialForm();
    }

    function soGoogleTrialRedirectUriVariants(trial) {
        const id = soGoogleTrialExtensionId(trial);
        if (!id) return [];
        const base = `https://${id}.chromiumapp.org`;
        return [`${base}/`, base];
    }

    function soGoogleTrialStatusBadges(trial) {
        const t = soNormalizeGoogleTrial(trial);
        const parts = [];
        parts.push(t.google_login_enabled
            ? '<span class="so-badge so-badge--on">Google login ON</span>'
            : '<span class="so-badge so-badge--off">Google login OFF</span>');
        parts.push(t.enabled
            ? '<span class="so-badge so-badge--on">New sign-ins ON</span>'
            : '<span class="so-badge so-badge--off">New sign-ins OFF</span>');
        parts.push(t.unlimited_time
            ? '<span class="so-badge so-badge--on">No calendar expiry</span>'
            : `<span class="so-badge so-badge--warn">${t.days}-day limit</span>`);
        parts.push(`<span class="so-badge so-badge--meta">Device limit: ${t.max_devices} (Google trial only — not shown to users)</span>`);
        return parts.join(' ');
    }

    function soGoogleTrialOAuthStatusBadges(t) {
        const parts = [];
        parts.push(t.oauth_client_id
            ? '<span class="so-badge so-badge--on">Chrome OAuth configured</span>'
            : '<span class="so-badge so-badge--off">oauth_client_id missing</span>');
        parts.push(t.oauth_web_client_id
            ? '<span class="so-badge so-badge--on">Web OAuth configured</span>'
            : '<span class="so-badge so-badge--warn">oauth_web_client_id missing (Kiwi fallback)</span>');
        return parts.join(' ');
    }

    function soBindGoogleTrialForm() {
        const trial = soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL);
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        const setChecked = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };
        setChecked('so-google-login-enabled', trial.google_login_enabled);
        setChecked('so-google-trial-enabled', trial.enabled);
        const googleLoginGeneral = document.getElementById('so-google-login-general');
        if (googleLoginGeneral) googleLoginGeneral.checked = trial.google_login_enabled;
        setChecked('so-google-trial-unlimited-time', trial.unlimited_time);
        setVal('so-google-trial-days', trial.days);
        setVal('so-google-trial-credits', trial.trial_credits);
        setVal('so-google-trial-max-increment', trial.max_increment_per_run);
        setVal('so-google-trial-max-devices', trial.max_devices);
        setVal('so-google-trial-label', trial.label);
        setVal('so-google-trial-oauth-client-id', trial.oauth_client_id);
        setVal('so-google-trial-oauth-web-client-id', trial.oauth_web_client_id);
        setVal('so-google-trial-chrome-extension-id', trial.chrome_extension_id);
        const statusEl = document.getElementById('so-google-trial-status');
        if (statusEl) {
            statusEl.innerHTML = soGoogleTrialStatusBadges(trial);
        }
        const oauthStatusEl = document.getElementById('so-google-trial-oauth-status');
        if (oauthStatusEl) {
            oauthStatusEl.innerHTML = soGoogleTrialOAuthStatusBadges(trial);
        }
        const redirectEl = document.getElementById('so-google-trial-redirect-hint');
        if (redirectEl) {
            const uris = soGoogleTrialRedirectUriVariants(trial);
            redirectEl.innerHTML = uris.length
                ? uris.map(u => `<code>${soEsc(u)}</code>`).join(' and ')
                : '(set chrome_extension_id)';
        }
        const extIdEl = document.getElementById('so-google-trial-extension-id-hint');
        if (extIdEl) {
            extIdEl.textContent = soGoogleTrialExtensionId(trial);
        }
        const extInput = document.getElementById('so-google-trial-chrome-extension-id');
        const daysEl = document.getElementById('so-google-trial-days');
        if (daysEl) daysEl.disabled = !!trial.unlimited_time;
        const unlimitedEl = document.getElementById('so-google-trial-unlimited-time');
        if (unlimitedEl && !unlimitedEl.dataset.soBound) {
            unlimitedEl.dataset.soBound = '1';
            unlimitedEl.addEventListener('change', () => {
                const on = !!unlimitedEl.checked;
                const daysField = document.getElementById('so-google-trial-days');
                if (daysField) {
                    daysField.disabled = on;
                    if (on) daysField.value = '0';
                }
            });
        }
        if (extInput && !extInput.dataset.soBound) {
            extInput.dataset.soBound = '1';
            extInput.addEventListener('input', () => {
                const t = soReadGoogleTrialFromDom();
                const hint = document.getElementById('so-google-trial-extension-id-hint');
                if (hint) hint.textContent = soGoogleTrialExtensionId(t);
                const redir = document.getElementById('so-google-trial-redirect-hint');
                if (redir) {
                    const uris = soGoogleTrialRedirectUriVariants(t);
                    redir.innerHTML = uris.length
                        ? uris.map(u => `<code>${soEsc(u)}</code>`).join(' and ')
                        : '(set chrome_extension_id)';
                }
            });
        }
    }

    function soReadGoogleTrialFromDom() {
        return soNormalizeGoogleTrial({
            google_login_enabled: !!document.getElementById('so-google-login-enabled')?.checked,
            enabled: !!document.getElementById('so-google-trial-enabled')?.checked,
            unlimited_time: !!document.getElementById('so-google-trial-unlimited-time')?.checked,
            days: document.getElementById('so-google-trial-days')?.value,
            trial_credits: document.getElementById('so-google-trial-credits')?.value,
            max_increment_per_run: document.getElementById('so-google-trial-max-increment')?.value,
            max_devices: document.getElementById('so-google-trial-max-devices')?.value,
            label: document.getElementById('so-google-trial-label')?.value,
            oauth_client_id: document.getElementById('so-google-trial-oauth-client-id')?.value,
            oauth_web_client_id: document.getElementById('so-google-trial-oauth-web-client-id')?.value,
            chrome_extension_id: document.getElementById('so-google-trial-chrome-extension-id')?.value
        });
    }

    window.soApplyRecommendedGoogleTrial = function() {
        const trial = Object.assign({}, DEFAULT_GOOGLE_TRIAL);
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        const setChecked = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };
        setChecked('so-google-login-enabled', trial.google_login_enabled);
        setChecked('so-google-trial-enabled', trial.enabled);
        setChecked('so-google-trial-unlimited-time', trial.unlimited_time);
        setVal('so-google-trial-days', trial.days);
        setVal('so-google-trial-credits', trial.trial_credits);
        setVal('so-google-trial-max-increment', trial.max_increment_per_run);
        setVal('so-google-trial-max-devices', trial.max_devices);
        setVal('so-google-trial-label', trial.label);
        setVal('so-google-trial-oauth-client-id', trial.oauth_client_id);
        setVal('so-google-trial-oauth-web-client-id', trial.oauth_web_client_id);
        setVal('so-google-trial-chrome-extension-id', trial.chrome_extension_id);
        soBindGoogleTrialForm();
        soToast('Recommended Google trial values applied — tap Save to write to Firebase.');
    };

    window.soSaveRecommendedGoogleTrial = async function() {
        if (!soRequireExtensionWrite()) return;
        soApplyRecommendedGoogleTrial();
        const payload = soGoogleTrialToFirestore(DEFAULT_GOOGLE_TRIAL);
        if (!payload.oauth_web_client_id) {
            return soToast('oauth_web_client_id is required for Kiwi sign-in.');
        }
        try {
            await soPersistGoogleTrial(payload);
            soToast('Recommended Google trial config saved (legacy function_url removed).');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerGoogleTrial = async function() {
        if (!soRequireExtensionWrite()) return;
        const payload = soGoogleTrialToFirestore(soReadGoogleTrialFromDom());
        if (!payload.oauth_client_id) {
            return soToast('Chrome extension OAuth client ID (oauth_client_id) is required.');
        }
        if (!payload.oauth_web_client_id) {
            return soToast('oauth_web_client_id (Web client 1) is required for Kiwi sign-in.');
        }
        if (!payload.chrome_extension_id) {
            return soToast('chrome_extension_id must match chrome://extensions on Kiwi.');
        }
        try {
            await soPersistGoogleTrial(payload);
            soToast('Google trial settings saved to extension Firebase.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    async function soLoadGoogleTrials() {
        soGoogleTrials = [];
        const seen = new Set();
        const cols = [SO_GOOGLE_TRIALS_COL, SO_GOOGLE_TRIALS_LEGACY_COL];
        for (const colName of cols) {
            try {
                let snap;
                try {
                    snap = await soDb().collection(colName).orderBy('created_at', 'desc').limit(200).get();
                } catch (_) {
                    try {
                        snap = await soDb().collection(colName).orderBy('expires_at', 'desc').limit(200).get();
                    } catch (_2) {
                        snap = await soDb().collection(colName).limit(200).get();
                    }
                }
                snap.forEach(doc => {
                    if (seen.has(doc.id)) return;
                    seen.add(doc.id);
                    soGoogleTrials.push(Object.assign(
                        { uid: doc.id, _trialCollection: colName },
                        doc.data(),
                    ));
                });
            } catch (e) {
                console.warn('Google trials load (' + colName + '):', e.message || e);
            }
        }
        soGoogleTrials.sort((a, b) => {
            const ta = soGoogleTrialExpiryMs(a) || soGoogleTrialCreatedMs(a);
            const tb = soGoogleTrialExpiryMs(b) || soGoogleTrialCreatedMs(b);
            return tb - ta;
        });
    }

    function soGoogleTrialExpiryMs(row) {
        const raw = row.expires_at || row.expiresAt;
        if (!raw) return 0;
        if (raw.toMillis) return raw.toMillis();
        if (raw.toDate) return raw.toDate().getTime();
        const d = new Date(raw);
        return Number.isFinite(d.getTime()) ? d.getTime() : 0;
    }

    function soGoogleTrialCreatedMs(row) {
        const raw = row.created_at || row.createdAt;
        if (!raw) return 0;
        if (raw.toMillis) return raw.toMillis();
        if (raw.toDate) return raw.toDate().getTime();
        const d = new Date(raw);
        return Number.isFinite(d.getTime()) ? d.getTime() : 0;
    }

    function soFormatGoogleTrialExpiry(row) {
        const ms = soGoogleTrialExpiryMs(row);
        if (!ms) return '—';
        const d = new Date(ms);
        const expired = ms < Date.now();
        const label = d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        return expired ? `${label} (expired)` : label;
    }

    function soFormatGoogleTrialCreated(row) {
        const raw = row.created_at || row.createdAt;
        if (!raw) return '—';
        if (raw.toDate) return raw.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        const d = new Date(raw);
        return Number.isFinite(d.getTime())
            ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
            : '—';
    }

    function soGoogleTrialDeviceCount(row) {
        const ids = row.machine_ids || row.machineIds;
        return Array.isArray(ids) ? ids.length : 0;
    }

    function soGoogleTrialMaxDevices(row) {
        const userRaw = row?.max_devices ?? row?.maxDevices;
        if (userRaw != null && userRaw !== '') {
            const n = parseInt(userRaw, 10);
            if (Number.isFinite(n) && n >= 0) return n;
        }
        return soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).max_devices;
    }

    function soFormatGoogleTrialDeviceLimit(n) {
        const val = parseInt(n, 10);
        if (!Number.isFinite(val) || val < 0) return '1';
        return val === 0 ? 'unlimited' : String(val);
    }

    function soReadGoogleUserMaxDevicesInput() {
        const raw = document.getElementById('so-google-user-max-devices')?.value;
        if (raw === '' || raw == null) return soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).max_devices;
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 0) return null;
        return n;
    }

    function soBindGoogleUserDevicesForm(row) {
        const maxEl = document.getElementById('so-google-user-max-devices');
        if (maxEl) {
            const limit = soGoogleTrialMaxDevices(row);
            maxEl.value = limit != null ? limit : DEFAULT_GOOGLE_TRIAL.max_devices;
        }
        soUpdateGoogleUserDevicesLabel(row);
    }

    function soUpdateGoogleUserDevicesLabel(row) {
        const uid = soGoogleTrialManageUid;
        const src = row || (uid ? soGoogleTrials.find(r => r.uid === uid) : null);
        if (!src) return;
        const devices = soGoogleTrialDeviceCount(src);
        const inputLimit = soReadGoogleUserMaxDevicesInput();
        const limit = inputLimit != null ? inputLimit : soGoogleTrialMaxDevices(src);
        const labelEl = document.getElementById('so-google-user-devices-label');
        const previewEl = document.getElementById('so-google-user-devices-preview');
        const hasOverride = src.max_devices != null || src.maxDevices != null;
        const globalDefault = soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).max_devices;
        if (labelEl) {
            labelEl.textContent = `${devices} bound · limit ${soFormatGoogleTrialDeviceLimit(limit)}${hasOverride ? ' (per-user override)' : ` (global default ${globalDefault})`}`;
        }
        if (previewEl) {
            previewEl.textContent = limit === 0
                ? 'Preview: unlimited devices — 0 clears the per-user cap.'
                : `Preview: up to ${limit} device${limit === 1 ? '' : 's'} · ${devices} currently bound.`;
        }
    }

    window.soOnGoogleUserMaxDevicesInput = function() {
        soUpdateGoogleUserDevicesLabel();
    };

    window.soGoogleUserApplyGlobalDeviceDefault = function() {
        const def = soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).max_devices;
        const el = document.getElementById('so-google-user-max-devices');
        if (el) el.value = def;
        soUpdateGoogleUserDevicesLabel();
        soToast(`Device limit field set to global default (${soFormatGoogleTrialDeviceLimit(def)}) — tap Save to Firebase when ready.`);
    };

    function soGoogleTrialImagesUsed(row) {
        return Number(row.images_used ?? row.imagesUsed ?? 0) || 0;
    }

    function soGoogleTrialImagesLimit(row) {
        const limit = row.images_limit ?? row.imagesLimit ?? row.trial_credits ?? row.trialCredits;
        return limit != null ? Number(limit) || 0 : 0;
    }

    function soGoogleTrialCreditsRemaining(row) {
        const used = soGoogleTrialImagesUsed(row);
        const limit = soGoogleTrialImagesLimit(row);
        return Math.max(0, limit - used);
    }

    function soGoogleTrialHasUnlimitedTimeRow(row) {
        if (!row) return false;
        if (row.unlimited_time === true || row.unlimitedTime === true) return true;
        if (row.unlimited_time === false || row.unlimitedTime === false) return false;
        if (!soGoogleTrialExpiryMs(row)) {
            return soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).unlimited_time;
        }
        return false;
    }

    function soGoogleTrialExpiryToDatetimeLocal(ms) {
        if (!ms) return '';
        const d = new Date(ms);
        if (!Number.isFinite(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function soBindGoogleUserCreditsForm(row) {
        const used = soGoogleTrialImagesUsed(row);
        const total = soGoogleTrialImagesLimit(row);
        const balance = Math.max(0, total - used);
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        setVal('so-google-user-total-credits', total);
        setVal('so-google-user-credits-used', used);
        setVal('so-google-user-credits-balance', balance);
        const adjustEl = document.getElementById('so-google-user-credits-adjust');
        if (adjustEl && !adjustEl.value) adjustEl.placeholder = 'e.g. 3';
        soUpdateGoogleUserCreditsBreakdown();
    }

    window.soUpdateGoogleUserCreditsBreakdown = function(changedField) {
        const totalEl = document.getElementById('so-google-user-total-credits');
        const usedEl = document.getElementById('so-google-user-credits-used');
        const balanceEl = document.getElementById('so-google-user-credits-balance');
        const panel = document.getElementById('so-google-user-credits-breakdown');
        if (!totalEl || !usedEl || !balanceEl) return;

        let total = Math.max(0, parseInt(totalEl.value, 10) || 0);
        let used = Math.max(0, parseInt(usedEl.value, 10) || 0);
        let balance = Math.max(0, parseInt(balanceEl.value, 10) || 0);

        if (changedField === 'total') {
            if (used > total) used = total;
            balance = Math.max(0, total - used);
            usedEl.value = used;
            balanceEl.value = balance;
        } else if (changedField === 'balance') {
            total = used + balance;
            totalEl.value = total;
        } else if (changedField === 'used') {
            if (used > total) total = used;
            balance = Math.max(0, total - used);
            totalEl.value = total;
            balanceEl.value = balance;
        } else {
            balance = Math.max(0, total - used);
            balanceEl.value = balance;
        }

        total = Math.max(0, parseInt(totalEl.value, 10) || 0);
        used = Math.max(0, parseInt(usedEl.value, 10) || 0);
        balance = Math.max(0, parseInt(balanceEl.value, 10) || 0);
        const consistent = (used + balance) === total;
        if (panel) {
            panel.innerHTML = `<strong>Preview:</strong> ${balance} remaining of ${total} total · ${used} used` +
                (consistent ? '' : ` <span style="color:#f59e0b;">(will reconcile to total ${used + balance} on save)</span>`);
        }
    };

    window.soGoogleUserQuickAdjust = function(mode) {
        const amount = parseInt(document.getElementById('so-google-user-credits-adjust')?.value, 10);
        if (!Number.isFinite(amount) || amount < 1) {
            return soToast('Enter an adjust amount (minimum 1).');
        }
        const totalEl = document.getElementById('so-google-user-total-credits');
        const usedEl = document.getElementById('so-google-user-credits-used');
        const balanceEl = document.getElementById('so-google-user-credits-balance');
        if (!totalEl || !usedEl || !balanceEl) return;
        let total = Math.max(0, parseInt(totalEl.value, 10) || 0);
        let used = Math.max(0, parseInt(usedEl.value, 10) || 0);
        let balance = Math.max(0, parseInt(balanceEl.value, 10) || 0);
        if (mode === 'add-total') {
            total += amount;
            balance = Math.max(0, total - used);
        } else if (mode === 'remove-total') {
            total = Math.max(used, total - amount);
            balance = Math.max(0, total - used);
        } else if (mode === 'add-balance') {
            balance += amount;
            total = used + balance;
        } else if (mode === 'reset-used') {
            used = 0;
            balance = total;
        } else {
            return;
        }
        totalEl.value = total;
        usedEl.value = used;
        balanceEl.value = balance;
        soUpdateGoogleUserCreditsBreakdown();
    };

    window.saveSoGoogleUserCredits = async function() {
        if (!soRequireExtensionWrite()) return;
        const uid = soGoogleTrialManageUid;
        if (!uid) return soToast('No user selected.');
        const row = soGoogleTrials.find(r => r.uid === uid);
        if (!row) return soToast('Google user not found.');

        let total = Math.max(0, parseInt(document.getElementById('so-google-user-total-credits')?.value, 10) || 0);
        let used = Math.max(0, parseInt(document.getElementById('so-google-user-credits-used')?.value, 10) || 0);
        let balance = Math.max(0, parseInt(document.getElementById('so-google-user-credits-balance')?.value, 10) || 0);

        if (used > total) total = used;
        if (used + balance !== total) total = used + balance;
        balance = Math.max(0, total - used);

        const prevUsed = soGoogleTrialImagesUsed(row);
        const prevTotal = soGoogleTrialImagesLimit(row);
        const payload = {
            images_limit: total,
            trial_credits: total,
            images_used: used,
            adjusted_at: firebase.firestore.FieldValue.serverTimestamp(),
            adjusted_by: soAuthEmail()
        };
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Save Google user credits → Firebase',
            bodyHtml: `<p><strong>User:</strong> ${soEsc(row.email || uid)}</p>
                <ul class="so-save-review-list">
                    <li><strong>Total:</strong> ${prevTotal} → ${total}</li>
                    <li><strong>Used:</strong> ${prevUsed} → ${used}</li>
                    <li><strong>Balance:</strong> ${Math.max(0, prevTotal - prevUsed)} → ${balance}</li>
                </ul>
                <p class="so-admin-muted">Writes <code>shipping_optimizer_google_trials/${soEsc(uid)}</code> only.</p>`,
            confirmLabel: 'Save credits to Firebase',
            dangerous: true
        });
        if (!previewOk) return;

        try {
            await soDb().collection(SO_GOOGLE_TRIALS_COL).doc(uid).set(payload, { merge: true });
            await soLoadGoogleTrials();
            soBindGoogleUserCreditsForm(soGoogleTrials.find(r => r.uid === uid) || row);
            renderSoGoogleTrialsRegistry();
            soToast(`Credits saved — ${balance} remaining of ${total} total.`);
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveSoGoogleUserCreditsAsDefault = async function() {
        if (!soRequireExtensionWrite()) return;
        const total = Math.max(0, parseInt(document.getElementById('so-google-user-total-credits')?.value, 10) || 0);
        const prev = soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).trial_credits;
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Save trial credits as global default',
            bodyHtml: `<p>Update <code>google_trial.trial_credits</code> for <em>new</em> Google sign-ins?</p>
                <ul class="so-save-review-list"><li><strong>Trial credits:</strong> ${prev} → ${total}</li></ul>
                <p class="so-admin-muted">Does not change existing user docs — only app config default.</p>`,
            confirmLabel: 'Save global default to Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        try {
            const trial = soNormalizeGoogleTrial(Object.assign({}, soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL, {
                trial_credits: total,
                image_run_limit: total
            }));
            await soPersistGoogleTrial(soGoogleTrialToFirestore(trial));
            soToast(`Global Google trial credits default set to ${total}.`);
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.soOnGoogleUserUnlimitedTimeToggle = function() {
        const unlimited = !!document.getElementById('so-google-user-unlimited-time')?.checked;
        const limitedFields = document.getElementById('so-google-user-time-limited-fields');
        if (limitedFields) limitedFields.style.display = unlimited ? 'none' : 'block';
    };

    window.soGoogleUserPreviewExtendDays = function(days) {
        const el = document.getElementById('so-google-user-extend-days');
        if (el) el.value = String(days);
        soGoogleUserPreviewExtendDaysInput();
    };

    window.soGoogleUserPreviewExtendDaysInput = function() {
        const uid = soGoogleTrialManageUid;
        const row = uid ? soGoogleTrials.find(r => r.uid === uid) : null;
        const days = parseInt(document.getElementById('so-google-user-extend-days')?.value, 10);
        if (!Number.isFinite(days) || days < 1) return soToast('Enter days to extend (minimum 1).');
        const currentMs = row ? soGoogleTrialExpiryMs(row) : 0;
        const base = currentMs > Date.now() ? currentMs : Date.now();
        const next = new Date(base + days * 86400000);
        const expiresEl = document.getElementById('so-google-user-expires-at');
        if (expiresEl) expiresEl.value = soGoogleTrialExpiryToDatetimeLocal(next.getTime());
        soToast(`Expiry field set to ${next.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} — tap Save access time.`);
    };

    window.saveSoGoogleUserAccessTime = async function() {
        if (!soRequireExtensionWrite()) return;
        const uid = soGoogleTrialManageUid;
        if (!uid) return soToast('No user selected.');
        const row = soGoogleTrials.find(r => r.uid === uid);
        if (!row) return soToast('Google user not found.');
        const unlimited = !!document.getElementById('so-google-user-unlimited-time')?.checked;
        const payload = {
            unlimited_time: unlimited,
            adjusted_at: firebase.firestore.FieldValue.serverTimestamp(),
            adjusted_by: soAuthEmail()
        };
        if (unlimited) {
            payload.expires_at = firebase.firestore.FieldValue.delete();
            payload.days_granted = 0;
        } else {
            const raw = String(document.getElementById('so-google-user-expires-at')?.value || '').trim();
            if (!raw) return soToast('Pick an expiry date/time, or enable unlimited time.');
            const next = new Date(raw);
            if (!Number.isFinite(next.getTime())) return soToast('Invalid expiry date.');
            if (next.getTime() <= Date.now()) return soToast('Expiry must be in the future.');
            payload.expires_at = next;
            const days = parseInt(document.getElementById('so-google-user-extend-days')?.value, 10);
            if (Number.isFinite(days) && days > 0) payload.days_granted = days;
        }
        const label = unlimited ? 'no expiry (unlimited time)' : `expires ${payload.expires_at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Save Google user access time → Firebase',
            bodyHtml: `<p><strong>User:</strong> ${soEsc(row.email || uid)}</p>
                <ul class="so-save-review-list"><li><strong>Access:</strong> ${soEsc(label)}</li></ul>
                <p class="so-admin-muted">Per-user override on trial doc only.</p>`,
            confirmLabel: 'Save access time to Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        try {
            await soDb().collection(SO_GOOGLE_TRIALS_COL).doc(uid).set(payload, { merge: true });
            await soLoadGoogleTrials();
            soRefreshGoogleUserModalLabels();
            renderSoGoogleTrialsRegistry();
            soToast('Access time saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveSoGoogleUserDevices = async function() {
        if (!soRequireExtensionWrite()) return;
        const uid = soGoogleTrialManageUid;
        if (!uid) return soToast('No user selected.');
        const row = soGoogleTrials.find(r => r.uid === uid);
        if (!row) return soToast('Google user not found.');
        const limit = soReadGoogleUserMaxDevicesInput();
        if (limit == null) return soToast('Device limit must be 0 (unlimited) or a positive number.');
        const prev = soGoogleTrialMaxDevices(row);
        const bound = soGoogleTrialDeviceCount(row);
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Save Google user device limit → Firebase',
            bodyHtml: `<p><strong>User:</strong> ${soEsc(row.email || uid)}</p>
                <ul class="so-save-review-list">
                    <li><strong>Device limit:</strong> ${soFormatGoogleTrialDeviceLimit(prev)} → ${soFormatGoogleTrialDeviceLimit(limit)}</li>
                    <li><strong>Currently bound:</strong> ${bound} device${bound === 1 ? '' : 's'}</li>
                </ul>
                <p class="so-admin-muted"><strong>0 = unlimited</strong> · default for new users is global config (currently ${soFormatGoogleTrialDeviceLimit(soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).max_devices)}).</p>`,
            confirmLabel: 'Save device limit to Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        try {
            await soDb().collection(SO_GOOGLE_TRIALS_COL).doc(uid).set({
                max_devices: limit,
                adjusted_at: firebase.firestore.FieldValue.serverTimestamp(),
                adjusted_by: soAuthEmail()
            }, { merge: true });
            await soLoadGoogleTrials();
            soRefreshGoogleUserModalLabels();
            renderSoGoogleTrialsRegistry();
            soToast(`Device limit saved — ${soFormatGoogleTrialDeviceLimit(limit)} for this user.`);
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveSoGoogleUserDevicesAsDefault = async function() {
        if (!soRequireExtensionWrite()) return;
        const limit = soReadGoogleUserMaxDevicesInput();
        if (limit == null) return soToast('Device limit must be 0 (unlimited) or a positive number.');
        const prev = soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).max_devices;
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Save device limit as global Google trial default',
            bodyHtml: `<p>Update <code>google_trial.max_devices</code> for the extension?</p>
                <ul class="so-save-review-list"><li><strong>Default device limit:</strong> ${soFormatGoogleTrialDeviceLimit(prev)} → ${soFormatGoogleTrialDeviceLimit(limit)}</li></ul>
                <p class="so-admin-muted">New sign-ins use this unless a per-user <code>max_devices</code> override is set. <strong>0 = unlimited.</strong></p>`,
            confirmLabel: 'Save global default to Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        try {
            const trial = soNormalizeGoogleTrial(Object.assign({}, soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL, {
                max_devices: limit
            }));
            await soPersistGoogleTrial(soGoogleTrialToFirestore(trial));
            soUpdateGoogleUserDevicesLabel();
            soToast(`Global Google trial device default set to ${soFormatGoogleTrialDeviceLimit(limit)}.`);
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    function soRefreshGoogleUserModalLabels() {
        const uid = soGoogleTrialManageUid;
        if (!uid) return;
        const row = soGoogleTrials.find(r => r.uid === uid);
        if (!row) return;
        const devices = soGoogleTrialDeviceCount(row);
        const maxDevices = soGoogleTrialMaxDevices(row);
        const unlimited = soGoogleTrialHasUnlimitedTimeRow(row);
        const emailEl = document.getElementById('so-google-user-email-label');
        const summaryEl = document.getElementById('so-google-user-summary-label');
        const devicesEl = document.getElementById('so-google-user-devices-label');
        if (emailEl) emailEl.textContent = row.email || uid;
        if (summaryEl) {
            summaryEl.textContent = unlimited
                ? `Access: no expiry · UID ${row.uid || ''}`
                : `Access expires: ${soFormatGoogleTrialExpiry(row)} · UID ${row.uid || ''}`;
        }
        soBindGoogleUserCreditsForm(row);
        soBindGoogleUserDevicesForm(row);
        if (devicesEl) {
            devicesEl.textContent = `${devices} / ${soFormatGoogleTrialDeviceLimit(maxDevices)} device(s) bound`;
        }
        const unlimitedEl = document.getElementById('so-google-user-unlimited-time');
        if (unlimitedEl) unlimitedEl.checked = unlimited;
        const expiresEl = document.getElementById('so-google-user-expires-at');
        if (expiresEl && !unlimited) expiresEl.value = soGoogleTrialExpiryToDatetimeLocal(soGoogleTrialExpiryMs(row));
        soOnGoogleUserUnlimitedTimeToggle();
        const revokeBtn = document.getElementById('so-google-user-revoke-btn');
        const reactBtn = document.getElementById('so-google-user-reactivate-btn');
        const isActive = row.active !== false;
        if (revokeBtn) revokeBtn.style.display = isActive ? '' : 'none';
        if (reactBtn) reactBtn.style.display = isActive ? 'none' : '';
    }

    function soGoogleTrialRowViewModel(r, maxDevices) {
        const used = soGoogleTrialImagesUsed(r);
        const limit = soGoogleTrialImagesLimit(r);
        const remaining = soGoogleTrialCreditsRemaining(r);
        const active = r.active !== false;
        const devices = soGoogleTrialDeviceCount(r);
        const unlimitedTime = soGoogleTrialHasUnlimitedTimeRow(r);
        const linkedKey = r.license_key || r.licenseKey || '';
        const legacyCol = r._trialCollection === SO_GOOGLE_TRIALS_LEGACY_COL
            ? '<span class="so-badge so-badge--meta">legacy collection</span>'
            : '';
        const accessLabel = unlimitedTime
            ? '<span class="so-badge so-badge--on">No expiry</span>'
            : soEsc(soFormatGoogleTrialExpiry(r));
        const statusBadge = active
            ? '<span class="so-badge so-badge--on">Active</span>'
            : '<span class="so-badge so-badge--off">Revoked</span>';
        const uid = r.uid || '';
        const email = r.email || '—';
        return {
            uid,
            email,
            linkedKey,
            legacyCol,
            used,
            limit,
            remaining,
            active,
            devices,
            maxDevices,
            unlimitedTime,
            accessLabel,
            statusBadge,
            created: soFormatGoogleTrialCreated(r),
            balanceLabel: `${remaining} / ${limit || '—'}`,
            devicesLabel: `${devices}/${maxDevices === 0 ? '∞' : maxDevices}`
        };
    }

    function soRenderGoogleTrialActionsHtml(uid, active, email) {
        return `
            <button type="button" class="so-btn-sm so-btn-touch" onclick="openSoGoogleTrialManage('${soAttr(uid)}')">Manage</button>
            ${active
                ? `<button type="button" class="so-btn-sm so-btn-touch so-btn-danger" onclick="soRevokeGoogleTrial('${soAttr(uid)}')">Revoke</button>`
                : ''}
            <button type="button" class="so-btn-sm so-btn-touch" onclick="soResetGoogleTrialDevices('${soAttr(uid)}')">Reset devices</button>
            <button type="button" class="so-btn-sm so-btn-touch" onclick="soLinkGoogleTrialToLicense('${soAttr(uid)}', '${soAttr(email || '')}')">Link license</button>`;
    }

    function renderSoGoogleTrialsRegistry() {
        const container = document.getElementById('so-google-trials-list');
        const countEl = document.getElementById('so-google-trials-count');
        if (!container) return;
        const rows = soGoogleTrials.slice();
        if (countEl) {
            countEl.textContent = rows.length === 1 ? '1 Google user' : `${rows.length} Google users`;
        }
        if (!rows.length) {
            container.innerHTML = '<p class="so-admin-muted">No Google sign-ins yet. Records appear in <code>shipping_optimizer_google_trials</code> after users tap <strong>Continue with Google</strong> in the extension.<br><span class="so-admin-tip">If users signed in before v1.8.1, tap <strong>Refresh</strong> — legacy <code>google_trials</code> docs are merged when readable.</span></p>';
            return;
        }
        const q = String(document.getElementById('so-google-trial-search')?.value || '').trim().toLowerCase();
        const filtered = q
            ? rows.filter(r => {
                const email = String(r.email || '').toLowerCase();
                const uid = String(r.uid || '').toLowerCase();
                return email.includes(q) || uid.includes(q);
            })
            : rows;
        if (!filtered.length) {
            container.innerHTML = '<p class="so-admin-muted">No matches for your search.</p>';
            return;
        }
        container.innerHTML = `
            <div class="so-google-trials-cards" role="list">
                ${filtered.map(r => {
                    const v = soGoogleTrialRowViewModel(r, soGoogleTrialMaxDevices(r));
                    const linked = v.linkedKey ? `<div class="so-google-trial-card-linked"><code>${soEsc(v.linkedKey)}</code></div>` : '';
                    return `
                    <article class="so-google-trial-card ${v.active ? '' : 'so-google-trial-card--revoked'}" role="listitem" onclick="openSoGoogleTrialManage('${soAttr(v.uid)}')" title="Tap to manage credits and access">
                        <div class="so-google-trial-card-head">
                            <div class="so-google-trial-card-email">${soEsc(v.email)}</div>
                            <div class="so-google-trial-card-badges">${v.statusBadge}${v.legacyCol ? ` ${v.legacyCol}` : ''}</div>
                        </div>
                        ${linked}
                        <dl class="so-google-trial-card-grid">
                            <div><dt>Balance</dt><dd><strong>${soEsc(v.balanceLabel)}</strong></dd></div>
                            <div><dt>Used</dt><dd>${soEsc(String(v.used))}</dd></div>
                            <div><dt>Created</dt><dd>${soEsc(v.created)}</dd></div>
                            <div><dt>Access</dt><dd>${v.accessLabel}</dd></div>
                            <div><dt>Devices</dt><dd>${soEsc(v.devicesLabel)}</dd></div>
                            <div class="so-google-trial-card-uid"><dt>UID</dt><dd><code>${soEsc(v.uid)}</code></dd></div>
                        </dl>
                        <div class="so-google-trial-card-actions" onclick="event.stopPropagation()">
                            ${soRenderGoogleTrialActionsHtml(v.uid, v.active, v.email)}
                        </div>
                    </article>`;
                }).join('')}
            </div>
            <div class="so-google-trials-table-wrap so-google-trials-table-wrap--desktop">
                <table class="so-google-trials-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Balance / Total</th>
                            <th>Used</th>
                            <th>Created</th>
                            <th>Access</th>
                            <th>Devices</th>
                            <th>Status</th>
                            <th>UID</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(r => {
                            const v = soGoogleTrialRowViewModel(r, soGoogleTrialMaxDevices(r));
                            const legacyCol = v.legacyCol ? `<br>${v.legacyCol}` : '';
                            return `
                            <tr class="so-google-trial-row ${v.active ? '' : 'so-google-trial-row--revoked'}" onclick="openSoGoogleTrialManage('${soAttr(v.uid)}')" title="Click to manage credits and access time">
                                <td data-label="Email">${soEsc(v.email)}${v.linkedKey ? `<br><code class="so-admin-muted">${soEsc(v.linkedKey)}</code>` : ''}${legacyCol}</td>
                                <td data-label="Balance"><strong>${soEsc(String(v.remaining))}</strong> / ${soEsc(String(v.limit || '—'))}</td>
                                <td data-label="Used">${soEsc(String(v.used))}</td>
                                <td data-label="Created">${soEsc(v.created)}</td>
                                <td data-label="Access">${v.accessLabel}</td>
                                <td data-label="Devices">${soEsc(v.devicesLabel)}</td>
                                <td data-label="Status">${v.statusBadge}</td>
                                <td data-label="UID"><code class="so-admin-muted">${soEsc(v.uid)}</code></td>
                                <td class="so-google-trials-actions" data-label="Actions" onclick="event.stopPropagation()">
                                    ${soRenderGoogleTrialActionsHtml(v.uid, v.active, v.email)}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    let soGoogleTrialManageUid = null;
    let soGoogleUserModalKeyHandler = null;

    function soEnsureGoogleUserModalPortal() {
        const modal = document.getElementById('so-google-user-modal');
        if (modal && modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        return modal;
    }

    function soBindGoogleUserModalDismiss() {
        if (soGoogleUserModalKeyHandler) return;
        soGoogleUserModalKeyHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeSoGoogleTrialManage();
            }
        };
        document.addEventListener('keydown', soGoogleUserModalKeyHandler);
    }

    function soUnbindGoogleUserModalDismiss() {
        if (!soGoogleUserModalKeyHandler) return;
        document.removeEventListener('keydown', soGoogleUserModalKeyHandler);
        soGoogleUserModalKeyHandler = null;
    }

    window.openSoGoogleTrialManage = function(uid) {
        if (!soRequireSuperAdmin()) return;
        const row = soGoogleTrials.find(r => r.uid === uid);
        if (!row) return soToast('Google user not found.');
        soGoogleTrialManageUid = uid;
        const adjustEl = document.getElementById('so-google-user-credits-adjust');
        if (adjustEl) adjustEl.value = '';
        const extendEl = document.getElementById('so-google-user-extend-days');
        if (extendEl) extendEl.value = '';
        soRefreshGoogleUserModalLabels();
        const modal = soEnsureGoogleUserModalPortal();
        if (modal) {
            modal.hidden = false;
            modal.style.display = 'flex';
            document.body.classList.add('so-google-user-modal-open');
            soBindGoogleUserModalDismiss();
            const closeBtn = modal.querySelector('.so-modal-close-btn');
            if (closeBtn) closeBtn.focus();
        }
    };

    window.openSoGoogleTrialCredits = function(uid) {
        openSoGoogleTrialManage(uid);
    };

    window.closeSoGoogleTrialManage = function() {
        soGoogleTrialManageUid = null;
        soUnbindGoogleUserModalDismiss();
        const modal = document.getElementById('so-google-user-modal');
        if (modal) {
            modal.hidden = true;
            modal.style.display = 'none';
        }
        document.body.classList.remove('so-google-user-modal-open');
    };

    window.closeSoGoogleTrialCredits = function() {
        closeSoGoogleTrialManage();
    };

    window.soSetGoogleTrialUnlimitedTime = async function(unlimited) {
        const el = document.getElementById('so-google-user-unlimited-time');
        if (el) el.checked = !!unlimited;
        soOnGoogleUserUnlimitedTimeToggle();
    };

    window.soExtendGoogleTrialDays = function(days) {
        soGoogleUserPreviewExtendDays(days);
    };

    window.soApplyGoogleTrialExtendDays = function() {
        soGoogleUserPreviewExtendDaysInput();
    };

    window.soApplyGoogleTrialExpiryDate = function() {
        return saveSoGoogleUserAccessTime();
    };

    window.soResetGoogleTrialUsed = async function() {
        const usedEl = document.getElementById('so-google-user-credits-used');
        const balanceEl = document.getElementById('so-google-user-credits-balance');
        const totalEl = document.getElementById('so-google-user-total-credits');
        if (usedEl && totalEl) {
            usedEl.value = '0';
            if (balanceEl) balanceEl.value = totalEl.value;
            soUpdateGoogleUserCreditsBreakdown();
            return soToast('Used reset in form — tap Save credits to apply.');
        }
        if (!soRequireExtensionWrite()) return;
        const uid = soGoogleTrialManageUid;
        if (!uid) return;
        if (!confirm('Reset credits used to 0 for this user?')) return;
        try {
            await soDb().collection(SO_GOOGLE_TRIALS_COL).doc(uid).set({
                images_used: 0,
                adjusted_at: firebase.firestore.FieldValue.serverTimestamp(),
                adjusted_by: soAuthEmail()
            }, { merge: true });
            await soLoadGoogleTrials();
            soRefreshGoogleUserModalLabels();
            renderSoGoogleTrialsRegistry();
            soToast('Credits used reset to 0.');
        } catch (e) {
            soToast('Reset failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.soResetGoogleTrialDevicesFromModal = async function() {
        const uid = soGoogleTrialManageUid;
        if (!uid) return;
        await soResetGoogleTrialDevices(uid);
        soRefreshGoogleUserModalLabels();
    };

    window.soRevokeGoogleTrialFromModal = async function() {
        const uid = soGoogleTrialManageUid;
        if (!uid) return;
        await soRevokeGoogleTrial(uid);
        soRefreshGoogleUserModalLabels();
    };

    window.soReactivateGoogleTrialFromModal = async function() {
        if (!soRequireExtensionWrite()) return;
        const uid = soGoogleTrialManageUid;
        if (!uid) return;
        try {
            await soDb().collection(SO_GOOGLE_TRIALS_COL).doc(uid).set({
                active: true,
                reactivated_at: firebase.firestore.FieldValue.serverTimestamp(),
                reactivated_by: soAuthEmail()
            }, { merge: true });
            await soLoadGoogleTrials();
            soRefreshGoogleUserModalLabels();
            renderSoGoogleTrialsRegistry();
            soToast('Google user reactivated.');
        } catch (e) {
            soToast('Reactivate failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.soLinkGoogleTrialToLicenseFromModal = async function() {
        const uid = soGoogleTrialManageUid;
        const row = soGoogleTrials.find(r => r.uid === uid);
        if (!uid) return;
        closeSoGoogleTrialManage();
        soLinkGoogleTrialToLicense(uid, row?.email || '');
    };

    window.confirmSoGoogleTrialCredits = async function(mode) {
        const map = { add: 'add-total', remove: 'remove-total', set: 'add-balance' };
        if (mode === 'set') {
            const amount = parseInt(document.getElementById('so-google-user-credits-adjust')?.value, 10);
            const totalEl = document.getElementById('so-google-user-total-credits');
            const usedEl = document.getElementById('so-google-user-credits-used');
            const balanceEl = document.getElementById('so-google-user-credits-balance');
            if (totalEl && Number.isFinite(amount)) {
                const used = Math.max(0, parseInt(usedEl?.value, 10) || 0);
                if (amount < used) return soToast(`Cannot set total below used (${used}).`);
                totalEl.value = amount;
                if (balanceEl) balanceEl.value = Math.max(0, amount - used);
                soUpdateGoogleUserCreditsBreakdown();
                return soToast('Total set in form — tap Save credits.');
            }
        }
        if (map[mode]) {
            soGoogleUserQuickAdjust(map[mode]);
            return;
        }
        return saveSoGoogleUserCredits();
    };

    window.soRevokeGoogleTrial = async function(uid) {
        if (!soRequireExtensionWrite()) return;
        if (!uid) return soToast('Missing trial uid.');
        if (!confirm(`Revoke Google trial for uid ${uid}? User will be blocked from using trial credits.`)) return;
        try {
            await soDb().collection(SO_GOOGLE_TRIALS_COL).doc(uid).set({
                active: false,
                revoked_at: firebase.firestore.FieldValue.serverTimestamp(),
                revoked_by: soAuthEmail()
            }, { merge: true });
            await soLoadGoogleTrials();
            renderSoGoogleTrialsRegistry();
            soToast('Google trial revoked.');
        } catch (e) {
            soToast('Revoke failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.soResetGoogleTrialDevices = async function(uid) {
        if (!soRequireExtensionWrite()) return;
        const row = soGoogleTrials.find(r => r.uid === uid);
        const email = row?.email || uid;
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Reset Google trial device bindings',
            bodyHtml: `<p>Clear all bound devices for <strong>${soEsc(email)}</strong>?</p>
                <p class="so-admin-muted">User can sign in again on a new device. Device <em>limit</em> is unchanged.</p>`,
            confirmLabel: 'Reset bindings in Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        if (!uid) return soToast('Missing trial uid.');
        try {
            await soDb().collection(SO_GOOGLE_TRIALS_COL).doc(uid).set({
                machine_ids: []
            }, { merge: true });
            await soLoadGoogleTrials();
            renderSoGoogleTrialsRegistry();
            soToast('Trial devices reset.');
        } catch (e) {
            soToast('Reset failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.soLinkGoogleTrialToLicense = async function(uid, email) {
        if (!soRequireExtensionWrite()) return;
        if (!uid) return soToast('Missing trial uid.');
        const hint = email ? ` for ${email}` : '';
        const key = String(prompt(`Paid license key to link${hint}:`, '') || '').trim().toUpperCase();
        if (!key) return;
        if (!/^MEESHO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
            return soToast('License key must match MEESHO-XXXX-XXXX-XXXX.');
        }
        try {
            const licSnap = await soDb().collection(SO_LICENSE_COL).doc(key).get();
            if (!licSnap.exists) return soToast(`License ${key} not found.`);
            await soDb().collection(SO_GOOGLE_TRIALS_COL).doc(uid).set({
                license_key: key,
                linked_license_at: firebase.firestore.FieldValue.serverTimestamp(),
                linked_by: soAuthEmail()
            }, { merge: true });
            await soLoadGoogleTrials();
            renderSoGoogleTrialsRegistry();
            soToast(`Trial linked to license ${key}.`);
        } catch (e) {
            soToast('Link failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.filterSoGoogleTrials = function() {
        renderSoGoogleTrialsRegistry();
    };

    window.soRefreshGoogleTrials = async function() {
        if (!soRequireSuperAdmin()) return;
        try {
            await soLoadGoogleTrials();
            renderSoGoogleTrialsRegistry();
            soToast('Google trial registry refreshed.');
        } catch (e) {
            soToast('Refresh failed: ' + (e.message || 'Unknown error'));
        }
    };

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
        setVal('so-min-version', soConfig.min_extension_version || DEFAULT_MIN_VERSION);
        setVal('so-announcement', soConfig.announcement || '');
        const enabledEl = document.getElementById('so-extension-enabled');
        if (enabledEl) enabledEl.checked = soConfig.extension_enabled !== false;
        const googleLoginGeneral = document.getElementById('so-google-login-general');
        if (googleLoginGeneral) {
            const trial = soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL);
            googleLoginGeneral.checked = trial.google_login_enabled;
        }
    }

    function soBindCreditsForm() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val != null ? val : '';
        };
        const credits = soCredits || DEFAULT_CREDITS;
        const enabledEl = document.getElementById('so-credits-enabled');
        if (enabledEl) enabledEl.checked = credits.enabled !== false;
        const packScopesEl = document.getElementById('so-pack-scopes-enabled');
        if (packScopesEl) packScopesEl.checked = credits.pack_scopes_enabled === true;
        const addonScopesEl = document.getElementById('so-addon-scopes-enabled');
        if (addonScopesEl) addonScopesEl.checked = credits.addon_scopes_enabled === true;
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

    function soGetAddonCatalogEditorList() {
        const fromDom = soReadAddonCatalogFromDom();
        if (fromDom.length) return fromDom;
        return soGetAddonCatalogState();
    }

    function soReadAddonCatalogFromDom() {
        const container = document.getElementById('so-addon-catalog-editor');
        if (!container) return [];
        const rows = container.querySelectorAll('.so-addon-catalog-row');
        return Array.from(rows).map((row, idx) => {
            const get = (field) => {
                const el = row.querySelector(`[data-field="${field}"]`);
                if (!el) return '';
                if (el.type === 'checkbox') return el.checked;
                return el.value;
            };
            return soNormalizeCreditAddon({
                id: get('id'),
                credits: get('credits'),
                price: get('price'),
                label: get('label'),
                name: get('name'),
                card_subtitle: get('card_subtitle'),
                description: get('description'),
                save: get('save'),
                offer_badges: soParsePlanFeaturesText(get('offer_badges_text')),
                active: get('active'),
                best: get('best'),
                default_selected: get('default_selected'),
                scope: get('scope'),
                plan_ids: soReadPlanIdsFromRow(row),
                hide: get('hide'),
                disabled: get('disabled'),
                order: idx
            }, idx);
        });
    }

    function soRenderAddonCatalogRowHtml(addon, idx) {
        const open = soExpandedAddonCatalogIds.has(addon.id);
        const priceLabel = '₹' + (addon.price || 0).toLocaleString('en-IN');
        return `
            <div class="so-plan-card so-addon-catalog-row so-collapsible-row ${open ? 'so-collapsible-row--open' : ''}" data-addon-catalog-idx="${idx}">
                <div class="so-plan-card-head-wrap">
                    <button type="button" class="so-plan-card-head" onclick="toggleSoAddonCatalogRow(${idx})" aria-expanded="${open ? 'true' : 'false'}">
                        <span class="so-plan-order" aria-hidden="true">${idx + 1}</span>
                        <div class="so-plan-card-summary">
                            <div class="so-plan-card-title-row">
                                <strong class="so-plan-card-name">${soEsc(addon.label || addon.id)}</strong>
                                <span class="so-plan-card-price">${soEsc(priceLabel)}</span>
                            </div>
                            <div class="so-plan-card-meta">
                                <code class="so-plan-id-tag">${soEsc(addon.id)}</code>
                                <span class="so-meta-chip">${addon.credits} credits</span>
                                ${addon.best ? '<span class="so-badge so-badge--on">Best</span>' : ''}
                            </div>
                            <div class="so-plan-card-badges">
                                ${addon.active !== false ? '<span class="so-badge so-badge--on">Active</span>' : '<span class="so-badge so-badge--off">Hidden</span>'}
                            </div>
                        </div>
                        <i class="fa fa-chevron-down so-plan-chevron" aria-hidden="true"></i>
                    </button>
                    <div class="so-plan-reorder" onclick="event.stopPropagation()">
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoAddonCatalogItem(${idx}, -1)" title="Move up" aria-label="Move add-on up">▲</button>
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoAddonCatalogItem(${idx}, 1)" title="Move down" aria-label="Move add-on down">▼</button>
                    </div>
                </div>
                <div class="so-plan-card-body" onclick="event.stopPropagation()">
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-plus-circle"></i> Add-on details</div>
                        <div class="so-plan-fields so-plan-fields--basic">
                            <label><span>Id (slug)</span><input type="text" data-field="id" value="${soAttr(addon.id)}" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>Credits</span><input type="number" min="1" step="1" data-field="credits" value="${addon.credits}" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>Price (INR)</span><input type="number" min="0" step="1" data-field="price" value="${addon.price}" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>Button label</span><input type="text" data-field="label" value="${soAttr(addon.label || '')}" placeholder="+25 credits" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>Name (optional)</span><input type="text" data-field="name" value="${soAttr(addon.name || '')}" placeholder="+25 Credits" oninput="soMarkTabDirty('credits')"></label>
                            <label class="so-field-full"><span>Card subtitle (extension)</span><input type="text" data-field="card_subtitle" value="${soAttr(addon.card_subtitle || '')}" placeholder="25 credits · ₹40" oninput="soMarkTabDirty('credits')"></label>
                            <label class="so-field-full"><span>Save line (optional)</span><input type="text" data-field="save" value="${soAttr(addon.save || '')}" placeholder="Save ₹30 vs 5×10" oninput="soMarkTabDirty('credits')"></label>
                            <label class="so-field-full"><span>Description</span><textarea rows="2" data-field="description" oninput="soMarkTabDirty('credits')">${soEsc(addon.description || '')}</textarea></label>
                            <label class="so-field-full"><span>Offer badges (one per line)</span><textarea rows="2" data-field="offer_badges_text" placeholder="Popular&#10;20% off" oninput="soMarkTabDirty('credits')">${soEsc((addon.offer_badges || []).join('\n'))}</textarea></label>
                            <label><span>Scope</span><select data-field="scope" onchange="soOnAddonCatalogScopeChange(this)"><option value="global" ${(addon.scope || 'global') !== 'plan' ? 'selected' : ''}>Global (main screen)</option><option value="plan" ${addon.scope === 'plan' ? 'selected' : ''}>Plan-only (detail)</option></select></label>
                            <div class="so-field-full" data-so-plan-ids-wrap style="${addon.scope === 'plan' ? '' : 'display:none;'}">
                                <span>Subscription plans (when scope = plan)</span>
                                ${soRenderPlanIdsPickerHtml(addon.plan_ids, 'soOnAddonCatalogPlanIdsChange(this)')}
                            </div>
                        </div>
                        <div class="so-plan-flags so-plan-flags--simple">
                            <label class="so-plan-check"><input type="checkbox" data-field="active" ${addon.active !== false ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Active (shown in extension)</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="hide" ${addon.hide ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Hide (admin only)</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="disabled" ${addon.disabled ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Disabled</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="best" ${addon.best ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Best value badge</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="default_selected" ${addon.default_selected ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Pre-select on new license</label>
                        </div>
                    </div>
                    <div class="so-plan-actions-bar">
                        <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="removeSoAddonCatalogItem(${idx})"><i class="fa fa-trash"></i> Remove add-on</button>
                    </div>
                </div>
            </div>`;
    }

    function renderSoAddonCatalogEditor() {
        const container = document.getElementById('so-addon-catalog-editor');
        const countEl = document.getElementById('so-addon-catalog-count');
        const catalog = soGetAddonCatalogState();
        if (countEl) {
            countEl.textContent = catalog.length === 1 ? '1 add-on' : `${catalog.length} add-ons`;
        }
        if (!container) return;
        if (!catalog.length) {
            container.innerHTML = '<p class="so-admin-muted">No add-ons in catalog yet. Tap + Add catalog item or Load defaults.</p>';
            return;
        }
        container.innerHTML = catalog.map((addon, idx) => soRenderAddonCatalogRowHtml(addon, idx)).join('');
    }

    window.toggleSoAddonCatalogRow = function(idx) {
        const catalog = soGetAddonCatalogEditorList();
        const addon = catalog[idx];
        if (!addon) return;
        if (soExpandedAddonCatalogIds.has(addon.id)) soExpandedAddonCatalogIds.delete(addon.id);
        else soExpandedAddonCatalogIds.add(addon.id);
        renderSoAddonCatalogEditor();
    };

    window.expandAllSoAddonCatalog = function() {
        soGetAddonCatalogEditorList().forEach(a => soExpandedAddonCatalogIds.add(a.id));
        renderSoAddonCatalogEditor();
    };

    window.collapseAllSoAddonCatalog = function() {
        soExpandedAddonCatalogIds.clear();
        renderSoAddonCatalogEditor();
    };

    window.addSoAddonCatalogItem = function() {
        const catalog = soReadAddonCatalogFromDom();
        const next = catalog.length + 1;
        const added = soNormalizeCreditAddon({
            id: `addon_${next * 10}`,
            credits: next * 10,
            price: next * 20,
            label: `+${next * 10} credits`,
            active: true,
            order: catalog.length
        }, catalog.length);
        if (!soCredits) soCredits = Object.assign({}, DEFAULT_CREDITS);
        soCredits.addon_catalog = catalog.concat([added]);
        soExpandedAddonCatalogIds.add(added.id);
        renderSoAddonCatalogEditor();
        soMarkTabDirty('credits');
    };

    window.removeSoAddonCatalogItem = function(idx) {
        const catalog = soReadAddonCatalogFromDom();
        if (!catalog[idx]) return;
        if (!confirm(`Remove add-on "${catalog[idx].label || catalog[idx].id}" from catalog?`)) return;
        catalog.splice(idx, 1);
        if (!soCredits) soCredits = Object.assign({}, DEFAULT_CREDITS);
        soCredits.addon_catalog = catalog;
        renderSoAddonCatalogEditor();
        soMarkTabDirty('credits');
    };

    window.moveSoAddonCatalogItem = function(idx, delta) {
        const catalog = soReadAddonCatalogFromDom();
        const next = idx + delta;
        if (next < 0 || next >= catalog.length) return;
        const tmp = catalog[idx];
        catalog[idx] = catalog[next];
        catalog[next] = tmp;
        if (!soCredits) soCredits = Object.assign({}, DEFAULT_CREDITS);
        soCredits.addon_catalog = catalog;
        renderSoAddonCatalogEditor();
        soMarkTabDirty('credits');
    };

    window.saveShippingOptimizerAddonCatalog = async function() {
        const catalog = soReadAddonCatalogFromDom();
        if (!soCredits) soCredits = Object.assign({}, DEFAULT_CREDITS);
        soCredits.addon_catalog = catalog;
        await soSaveTabToFirebase('credits');
    };

    function renderSoCreditPacksEditor() {
        soSyncCreditPacksFromDom();
        const container = document.getElementById('so-credit-packs-editor');
        if (!container) return;
        if (!soCreditPacks.length) {
            container.innerHTML = '<p class="so-admin-muted">No credit packs yet. Tap + Add credit pack.</p>';
            return;
        }
        container.innerHTML = soCreditPacks.map((pack, idx) => {
            const open = soExpandedPackIds.has(pack.id);
            const priceLabel = '₹' + (pack.price || 0).toLocaleString('en-IN');
            const scopeBadge = soScopePlanBadgeHtml(pack.scope, pack.plan_ids);
            const planScope = pack.scope === 'plan';
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
                                ${scopeBadge}
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
                            <label><span>Scope</span><select data-field="scope" onchange="soOnCreditPackScopeChange(this)"><option value="global" ${(pack.scope || 'global') !== 'plan' ? 'selected' : ''}>Global — main ⚡ BUY CREDITS section</option><option value="plan" ${pack.scope === 'plan' ? 'selected' : ''}>Plan-specific — map to subscription plans</option></select></label>
                            <div class="so-field-full" data-so-plan-ids-wrap style="${planScope ? '' : 'display:none;'}">
                                <span>Subscription plans (pick one or more)</span>
                                ${soRenderPlanIdsPickerHtml(pack.plan_ids, 'soOnCreditPackPlanIdsChange(this)')}
                            </div>
                            <p class="so-field-group-hint">Plans come from the <strong>Config</strong> tab. Map custom/credits-only packs to <code>credits_starter</code> or your credits plan id. Enable <strong>Pack plan mapping</strong> in Credit settings so the extension filters by active license.</p>
                        </div>
                        <div class="so-plan-flags so-plan-flags--simple">
                            <label class="so-plan-check"><input type="checkbox" data-field="active" ${pack.active ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Show in extension</label>
                        </div>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-mobile-screen"></i> Pack detail screen (extension)</div>
                        <p class="so-field-group-hint">Shown when customer taps a credit pack card — same pattern as subscription plans.</p>
                        <label class="so-field-full"><span>Short description</span><textarea rows="2" data-field="description" oninput="soMarkTabDirty('credits')">${soEsc(pack.description || '')}</textarea></label>
                        <label><span>Detail subtitle</span><input type="text" data-field="detail_subtitle" value="${soAttr(pack.detail_subtitle || '')}" placeholder="Under pack name on detail screen" oninput="soMarkTabDirty('credits')"></label>
                        <label class="so-field-full"><span>Highlights (one per line — pills)</span>
                            <textarea rows="3" data-field="highlights_text" oninput="soMarkTabDirty('credits')">${soEsc((pack.highlights || []).join('\n'))}</textarea></label>
                        <label class="so-field-full"><span>Features (one per line — plain text or <code>icon|title|text</code>)</span>
                            <textarea rows="4" data-field="features_text" oninput="soMarkTabDirty('credits')">${soEsc(soFormatPlanFeaturesForEditor(pack.features))}</textarea></label>
                        <div class="so-admin-subhead">Detail sections</div>
                        <div class="so-pack-detail-sections">
                            ${(pack.detail_sections || []).map((sec, sidx) => soRenderPackDetailSectionRow(sec, idx, sidx)).join('')}
                        </div>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="addSoPackDetailSection(${idx})">+ Add detail section</button>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-id-card"></i> Pack card &amp; CTA</div>
                        <div class="so-plan-fields so-plan-fields--basic">
                            <label><span>Card subtitle</span><input type="text" data-field="card_subtitle" value="${soAttr(pack.card_subtitle || '')}" placeholder="${pack.credits} credits · ₹${pack.price}" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>Card hint</span><input type="text" data-field="card_hint" value="${soAttr(pack.card_hint || '')}" placeholder="Tap for details · WhatsApp to buy" oninput="soMarkTabDirty('credits')"></label>
                            <label><span>WhatsApp button label</span><input type="text" data-field="cta_text" value="${soAttr(pack.cta_text || '')}" placeholder="Buy via WhatsApp" oninput="soMarkTabDirty('credits')"></label>
                            <label class="so-field-full"><span>Detail footer</span><input type="text" data-field="detail_footer" value="${soAttr(pack.detail_footer || '')}" oninput="soMarkTabDirty('credits')"></label>
                            <label class="so-plan-check"><input type="checkbox" data-field="show_whatsapp_icon" ${pack.show_whatsapp_icon !== false ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Show green WhatsApp icon on pack card</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="show_details_icon" ${pack.show_details_icon !== false ? 'checked' : ''} onchange="soMarkTabDirty('credits')"> Show details (ℹ️) icon on pack card</label>
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
                description: get('description'),
                detail_subtitle: get('detail_subtitle'),
                detail_footer: get('detail_footer'),
                cta_text: get('cta_text'),
                card_subtitle: get('card_subtitle'),
                card_hint: get('card_hint'),
                show_whatsapp_icon: get('show_whatsapp_icon'),
                show_details_icon: get('show_details_icon'),
                scope: get('scope'),
                plan_ids: soReadPlanIdsFromRow(row),
                highlights: soParsePlanFeaturesText(get('highlights_text')),
                features: soParsePlanFeaturesFromText(get('features_text')),
                detail_sections: soParsePlanDetailSectionsFromDom(row),
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

    window.addSoPackDetailSection = function(packIdx) {
        soCreditPacks = soReadCreditPacksFromDom();
        const pack = soCreditPacks[packIdx];
        if (!pack) return;
        if (!Array.isArray(pack.detail_sections)) pack.detail_sections = [];
        pack.detail_sections.push({ title: 'New section', items: [] });
        soExpandedPackIds.add(pack.id);
        renderSoCreditPacksEditor();
        soMarkTabDirty('credits');
    };

    window.removeSoPackDetailSection = function(packIdx, secIdx) {
        soCreditPacks = soReadCreditPacksFromDom();
        const pack = soCreditPacks[packIdx];
        if (!pack || !pack.detail_sections) return;
        pack.detail_sections.splice(secIdx, 1);
        soExpandedPackIds.add(pack.id);
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
            if ((p.offer_badges || []).length) {
                warnings.push(`Plan "${p.name}" has offer_badges — extension v1.7.8+ must render them on plan cards.`);
            }
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
        const packScopesOn = document.getElementById('so-pack-scopes-enabled')
            ? document.getElementById('so-pack-scopes-enabled').checked
            : credits.pack_scopes_enabled === true;
        const allPacks = (() => {
            soSyncCreditPacksFromDom();
            return soCreditPacks.filter(p => p.active !== false);
        })();
        const globalPacks = packScopesOn
            ? allPacks.filter(p => soPackAppliesToPlan(p, null, true) && (p.scope || 'global') !== 'plan')
            : allPacks;
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
        const googleLoginOn = document.getElementById('so-google-login-general')
            ? document.getElementById('so-google-login-general').checked
            : soNormalizeGoogleTrial(soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL).google_login_enabled;

        const plansHtml = activePlans.length
            ? `<div class="so-ext-preview-grid">${activePlans.map(p => {
                const bestClass = p.best ? ' so-ext-plan--best' : '';
                const durationLabel = soFormatPlanDurationLabel(p);
                const devicesLabel = soFormatPlanDevicesLabel(p);
                const addons = soGetActivePlanCreditAddons(p);
                const planPacks = packScopesOn
                    ? allPacks.filter(pk => pk.scope === 'plan' && soPackAppliesToPlan(pk, p.id, true))
                    : [];
                const offerBadges = (p.offer_badges || []).map(b =>
                    `<span class="so-ext-offer-badge">${soEsc(b)}</span>`
                ).join('');
                const addonsHtml = addons.length
                    ? `<div class="so-ext-plan-addons">${addons.map(a =>
                        `<span class="so-ext-addon-chip">+${a.credits} cr · ₹${a.price}</span>`
                    ).join('')}</div>`
                    : '';
                const planPacksHtml = planPacks.length
                    ? `<div class="so-ext-plan-addons">${planPacks.map(pk =>
                        `<span class="so-ext-addon-chip">${soEsc(pk.label || pk.id)} · ₹${pk.price}</span>`
                    ).join('')}</div>`
                    : '';
                return `<div class="so-ext-plan${bestClass}">
                    <div class="so-plan-card-badges-row" style="margin-bottom:4px;">
                    ${p.best ? '<span class="so-ext-plan-tag">BEST VALUE</span>' : ''}
                    ${p.show_details_icon !== false ? '<span class="so-ext-details-icon" title="Plan details">ℹ️</span>' : ''}
                    ${p.show_whatsapp_icon !== false ? '<span class="so-ext-wa-icon" title="WhatsApp quick buy">WA</span>' : ''}
                    </div>
                    ${offerBadges ? `<div class="so-ext-offer-badges">${offerBadges}</div>` : ''}
                    <div class="so-ext-plan-name">${soEsc(p.name)}</div>
                    <div class="so-ext-plan-price">₹${(p.price || 0).toLocaleString('en-IN')}</div>
                    <div class="so-ext-plan-note">${soEsc(p.card_subtitle || p.save || `${durationLabel} · ${devicesLabel}`)}</div>
                    ${p.card_hint ? `<div class="so-ext-plan-hint">${soEsc(p.card_hint)}</div>` : ''}
                    <div class="so-ext-plan-meta"><code>${soEsc(p.id)}</code> · ${soEsc(p.billing_mode || 'subscription')}${soGetPlanIncludedCredits(p) > 0 ? ` · ${soGetPlanIncludedCredits(p)} base cr` : ''}</div>
                    ${addonsHtml}
                    ${planPacksHtml ? `<div class="so-admin-muted" style="font-size:10px;margin-top:4px;">Plan credit packs:</div>${planPacksHtml}` : ''}
                </div>`;
            }).join('')}</div>`
            : '<p class="so-admin-muted">No active plans — extension shows default built-in plans.</p>';

        const creditsHtml = credits.enabled !== false
            ? `<div class="so-ext-preview-block">
                <div class="so-ext-preview-label">Credits top-up${packScopesOn ? ' (global packs)' : ''}</div>
                <p class="so-admin-muted">₹${credits.price_per_credit}/credit · min ${credits.min_purchase} · ${credits.cost_per_operation} per operation${packScopesOn ? ' · plan mapping ON' : ''}</p>
                ${globalPacks.length ? `<div class="so-ext-preview-grid so-ext-preview-grid--packs">${globalPacks.map(p =>
                    `<div class="so-ext-plan so-ext-plan--pack">
                        ${p.show_details_icon !== false ? '<span class="so-ext-details-icon" title="Pack details">ℹ️</span>' : ''}
                        ${p.show_whatsapp_icon !== false ? '<span class="so-ext-wa-icon" title="WhatsApp quick buy">WA</span>' : ''}
                        <div class="so-ext-plan-name">${soEsc(p.label || `${p.credits} credits`)}</div>
                        <div class="so-ext-plan-price">₹${p.price}</div>
                        <div class="so-ext-plan-note">${soEsc(p.card_subtitle || `${p.credits} credits`)}</div>
                        ${p.card_hint ? `<div class="so-ext-plan-hint">${soEsc(p.card_hint)}</div>` : ''}
                    </div>`
                ).join('')}</div>` : '<p class="so-admin-muted">No active credit packs.</p>'}
            </div>`
            : '<p class="so-admin-muted">Credits disabled — extension hides credit packs section.</p>';

        const imgGen = soReadImageGenerationFromDom();
        const smartMode = soReadSmartModeFromDom();
        const batchMax = Number(imgGen.max_batch_size) || 0;
        let variantOptions = (smartMode.variant_options || []).filter(o => o.active !== false);
        if (batchMax > 0) {
            variantOptions = variantOptions.filter(o => o.value <= batchMax);
        }
        const smartModeHtml = variantOptions.length
            ? `<div class="so-ext-preview-block">
                <div class="so-ext-preview-label">Smart Mode variant dropdown (extension)</div>
                <label class="so-ext-smart-label">${soEsc(smartMode.label || 'Max Variants')}</label>
                <select class="so-ext-smart-select" disabled aria-label="Smart mode variants preview">
                    ${variantOptions.map(o =>
                        `<option value="${o.value}"${o.value === smartMode.default_variant ? ' selected' : ''}>${soEsc(o.label)} (${o.value})</option>`
                    ).join('')}
                </select>
                ${smartMode.hint ? `<p class="so-admin-muted so-admin-tip">${soEsc(smartMode.hint)}</p>` : ''}
                ${batchMax > 0 ? `<p class="so-admin-muted so-admin-tip">Options above ${batchMax} variants hidden (max variants per run).</p>` : ''}
            </div>`
            : '';

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
                · Google sign-in: <strong>${googleLoginOn ? 'Visible' : 'Hidden'}</strong>
            </div>
            ${announcement ? `<div class="so-ext-announce">${soEsc(announcement)}</div>` : ''}
            <div class="so-ext-preview-block">
                <div class="so-ext-preview-label">Pricing plans (active only, as in popup)</div>
                ${plansHtml}
            </div>
            ${creditsHtml}
            ${imgGenHtml}
            ${smartModeHtml}
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
        const out = {
            whatsapp_number: whatsappRaw,
            whatsapp_message: String(document.getElementById('so-whatsapp-message')?.value || '').trim(),
            extension_enabled: !!document.getElementById('so-extension-enabled')?.checked,
            min_extension_version: String(document.getElementById('so-min-version')?.value || DEFAULT_MIN_VERSION).trim(),
            announcement: String(document.getElementById('so-announcement')?.value || '').trim()
        };
        const googleLoginGeneral = document.getElementById('so-google-login-general');
        if (googleLoginGeneral) {
            const trial = soNormalizeGoogleTrial(Object.assign({}, soConfig?.google_trial || DEFAULT_GOOGLE_TRIAL, {
                google_login_enabled: !!googleLoginGeneral.checked
            }));
            out.google_trial = soGoogleTrialToFirestore(trial);
        }
        return out;
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
        if (patch.google_trial) {
            soConfig = Object.assign({}, soConfig, { google_trial: patch.google_trial });
            soBindGoogleTrialForm();
            soBindConfigForm();
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
            if (patch.support) {
                snap.support = soSupportToFirestore(patch.support);
            }
            if (soPatchTouchesGeneral(patch)) {
                snap.general = soReadGeneralConfigLenient();
            }
            soTabSnapshots.config = JSON.stringify(snap);
            soSyncDirtyFromSnapshots();
        }
        if (!soDirtyTabs.config && !soDirtyTabs.credits) soClearDraftStorage();
        else if (soDirtyTabs.config || soDirtyTabs.credits) soWriteDraftToStorage();
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
        soSyncCreditPacksFromDom();
        const creditsPayload = soBuildCreditsPayloadFromDom();
        const smartModePayload = soSmartModeToFirestore(soReadSmartModeFromDom());
        const smartErr = soValidateSmartMode(smartModePayload);
        if (smartErr) return soToast(smartErr);
        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                credits: creditsPayload,
                smart_mode: smartModePayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }, { merge: true });
            soCredits = creditsPayload;
            soSmartMode = smartModePayload;
            soConfig = Object.assign({}, soConfig, { credits: creditsPayload, smart_mode: smartModePayload });
            soAfterTabSaved('credits');
            renderSoExtensionPreview();
            soToast('Credit settings saved.');
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.saveShippingOptimizerCreditPacks = async function() {
        if (!soRequireExtensionWrite()) return;
        soSyncCreditPacksFromDom();
        const packErr = soValidateCreditPacks(soCreditPacks);
        if (packErr) return soToast(packErr);
        const creditsPayload = soBuildCreditsPayloadFromDom(soCreditPacks);
        const smartModePayload = soSmartModeToFirestore(soReadSmartModeFromDom());
        const smartErr = soValidateSmartMode(smartModePayload);
        if (smartErr) return soToast(smartErr);
        const packCount = (creditsPayload.packs || []).length;
        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                credits: creditsPayload,
                smart_mode: smartModePayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }, { merge: true });
            soCredits = creditsPayload;
            soSmartMode = smartModePayload;
            soConfig = Object.assign({}, soConfig, { credits: creditsPayload, smart_mode: smartModePayload });
            soAfterTabSaved('credits');
            renderSoExtensionPreview();
            soToast(`Saved ${packCount} credit pack${packCount === 1 ? '' : 's'} to Firebase. Close and reopen the extension popup to refresh.`);
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.renderSoExtensionPreview = renderSoExtensionPreview;
    window.renderSoCreditPacksEditor = renderSoCreditPacksEditor;

    function soPlanMetaChips(plan) {
        const chips = [];
        chips.push(plan.billing_mode || 'subscription');
        if (soIsUnlimitedTime(plan)) chips.push('No expiry');
        else if (plan.duration) chips.push(plan.duration);
        else if (plan.days > 0) chips.push(`${plan.days} days`);
        if (soIsUnlimitedDevices(plan)) chips.push('Unlimited devices');
        else chips.push(`${plan.max_devices != null ? plan.max_devices : 1} device${(plan.max_devices || 1) !== 1 ? 's' : ''}`);
        const inc = soGetPlanIncludedCredits(plan);
        if (inc > 0) chips.push(`${inc} base cr`);
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

    window.soTogglePlanActive = function(planIdx) {
        soPlans = soReadPlansFromDom();
        const plan = soPlans[planIdx];
        if (!plan) return;
        plan.active = !plan.active;
        soMarkTabDirty('config');
        renderSoPlansEditor();
        soToast(plan.active ? `Plan "${plan.name}" is now visible.` : `Plan "${plan.name}" is hidden.`);
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
            const planCredits = soGetPlanIncludedCredits(plan);
            const creditsBadge = planCredits > 0 && !soIsUnlimitedCredits(plan)
                ? `<span class="so-badge so-badge--credits">${planCredits} credits</span>`
                : (soIsUnlimitedCredits(plan) ? '<span class="so-badge so-badge--credits">∞ credits</span>' : '');
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
                                <div class="so-plan-card-badges-row">
                                    ${creditsBadge}
                                    ${plan.best ? '<span class="so-badge so-badge--best">Best value</span>' : ''}
                                    ${plan.active ? '<span class="so-badge so-badge--on">Visible</span>' : '<span class="so-badge so-badge--off">Hidden</span>'}
                                </div>
                                <div class="so-plan-card-badges-row">
                                    ${(plan.offer_badges || []).map(b => `<span class="so-badge so-badge--offer">${soEsc(b)}</span>`).join('')}
                                    ${plan.save ? `<span class="so-meta-chip so-meta-chip--gold">${soEsc(plan.save)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <i class="fa fa-chevron-down so-plan-chevron" aria-hidden="true"></i>
                    </button>
                    <div class="so-plan-reorder" onclick="event.stopPropagation()">
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoPlan(${idx}, -1)" title="Move up in list" aria-label="Move plan up">▲</button>
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="moveSoPlan(${idx}, 1)" title="Move down in list" aria-label="Move plan down">▼</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="soTogglePlanActive(${idx})" title="${plan.active ? 'Hide plan' : 'Show plan'}">${plan.active ? 'Hide' : 'Show'}</button>
                    </div>
                </div>
                <div class="so-plan-card-body" onclick="event.stopPropagation()">
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-circle-info"></i> Basic info</div>
                        <div class="so-plan-fields so-plan-fields--basic">
                            <label>${soFieldLabelHtml('Id (slug) — never rename after use', 'plan-id', idx)}<input type="text" data-field="id" value="${soAttr(plan.id)}" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Display name</span><input type="text" data-field="name" value="${soAttr(plan.name)}" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Price (INR)</span><input type="number" min="0" step="1" data-field="price" value="${plan.price}" oninput="soMarkTabDirty('config')"></label>
                            <label>${soFieldLabelHtml('Included credits (granted on license activation)', 'plan-included-credits', idx)}<input type="number" min="0" step="1" data-field="included_credits" value="${soGetPlanIncludedCredits(plan)}" oninput="soOnPlanIncludedCreditsInput(${idx})"></label>
                            <label><span>Days (0 = unlimited)</span><input type="number" min="0" step="1" data-field="days" value="${plan.days}" oninput="soOnPlanDaysInput(${idx})"></label>
                            <label><span>Duration label</span><input type="text" data-field="duration" value="${soAttr(plan.duration || '')}" placeholder="1 Year, Forever" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Save badge</span><input type="text" data-field="save" value="${soAttr(plan.save || '')}" placeholder="Save ₹8000" oninput="soMarkTabDirty('config')"></label>
                            <label class="so-field-full"><span>Offer badges (one per line — e.g. 20% OFF, Limited time)</span>
                                <textarea rows="2" data-field="offer_badges_text" placeholder="Flash sale&#10;20% OFF" oninput="soMarkTabDirty('config')">${soEsc((plan.offer_badges || []).join('\n'))}</textarea></label>
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
                            <label><span>Plan kind</span><input type="text" data-field="plan_kind" value="${soAttr(plan.plan_kind || '')}" placeholder="lifetime, unlimited" oninput="soMarkTabDirty('config')"></label>
                            <label class="so-field-full"><span>Short description (plan detail screen)</span><textarea rows="2" data-field="description" oninput="soMarkTabDirty('config')">${soEsc(plan.description || '')}</textarea></label>
                            <label><span>Detail subtitle</span><input type="text" data-field="detail_subtitle" value="${soAttr(plan.detail_subtitle || '')}" placeholder="Under plan name on detail screen" oninput="soMarkTabDirty('config')"></label>
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
                        <div class="so-field-group-title"><i class="fa fa-id-card"></i> Plan card &amp; CTA (extension v1.5.9+)</div>
                        <p class="so-field-group-hint">Controls plan card subtitles, WhatsApp button text, and quick-buy icon on the extension popup.</p>
                        <div class="so-plan-fields so-plan-fields--basic">
                            <label><span>Card subtitle</span><input type="text" data-field="card_subtitle" value="${soAttr(plan.card_subtitle || '')}" placeholder="Else duration · devices" oninput="soMarkTabDirty('config')"></label>
                            <label><span>Card hint</span><input type="text" data-field="card_hint" value="${soAttr(plan.card_hint || '')}" placeholder="Tap for details · WhatsApp to buy" oninput="soMarkTabDirty('config')"></label>
                            <label><span>WhatsApp button label</span><input type="text" data-field="cta_text" value="${soAttr(plan.cta_text || '')}" placeholder="Buy via WhatsApp" oninput="soMarkTabDirty('config')"></label>
                            <label class="so-field-full"><span>Detail footer (small text under WhatsApp button)</span><input type="text" data-field="detail_footer" value="${soAttr(plan.detail_footer || '')}" oninput="soMarkTabDirty('config')"></label>
                            <label class="so-plan-check"><input type="checkbox" data-field="show_whatsapp_icon" ${plan.show_whatsapp_icon !== false ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Show green WhatsApp quick button on plan card</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="show_details_icon" ${plan.show_details_icon !== false ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Show details (ℹ️) icon on plan card</label>
                        </div>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-eye"></i> Visibility &amp; badges</div>
                        <p class="so-field-group-hint">Uncheck <strong>Show in extension</strong> to hide a plan without deleting it. Hidden plans stay in Firebase but customers won't see them.</p>
                        <div class="so-plan-flags so-plan-flags--simple">
                            <label class="so-plan-check"><input type="checkbox" data-field="active" ${plan.active ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Show in extension (visible to customers)</label>
                            <label class="so-plan-check"><input type="checkbox" data-field="best" ${plan.best ? 'checked' : ''} onchange="soMarkTabDirty('config')"> Best value badge (only one plan)</label>
                        </div>
                    </div>
                    <div class="so-field-group">
                        <div class="so-field-group-title"><i class="fa fa-coins"></i> Credit add-ons (per plan)</div>
                        <p class="so-field-group-hint">Optional extra credit bundles for this plan. Extension shows these in plan detail (ℹ️). Set <code>scope: plan</code> + <code>plan_ids</code> on shared catalog items when <code>addon_scopes_enabled</code> is on, or map credit packs on Credits tab when <code>pack_scopes_enabled</code> is on. Leave empty to use the shared catalog from Credits tab.</p>
                        <div class="so-plan-flags so-plan-flags--simple">
                            ${soCheckboxInfoHtml('Allow credit add-ons', 'plan-allow-addons', 'allow_credit_addons', plan.allow_credit_addons, idx)}
                            ${soCheckboxInfoHtml('Allow plan add-ons in detail', 'plan-allow-plan-addons', 'allow_plan_addons', plan.allow_plan_addons != null ? plan.allow_plan_addons : plan.allow_credit_addons, idx)}
                            ${soCheckboxInfoHtml('Hide add-ons in plan detail', 'plan-hide-plan-addons', 'hide_plan_addons_in_detail', plan.hide_plan_addons_in_detail, idx)}
                            ${soCheckboxInfoHtml('Disable add-ons (show grayed)', 'plan-disable-plan-addons', 'disable_plan_addons', plan.disable_plan_addons, idx)}
                            ${soCheckboxInfoHtml('Show custom plan block', 'plan-allow-custom-plan', 'allow_custom_plan', plan.allow_custom_plan != null ? plan.allow_custom_plan : true, idx)}
                            ${soCheckboxInfoHtml('Hide custom plan block', 'plan-hide-custom-plan', 'hide_custom_plan', plan.hide_custom_plan, idx)}
                            ${soCheckboxInfoHtml('Disable custom plan (visible but inactive)', 'plan-disable-custom-plan', 'disable_custom_plan', plan.disable_custom_plan, idx)}
                        </div>
                        <label>${soFieldLabelHtml('Max add-on selections (0 = unlimited)', 'plan-max-addon-selections', idx)}
                            <input type="number" min="0" step="1" data-field="max_addon_selections" value="${plan.max_addon_selections || 0}" oninput="soMarkTabDirty('config')"></label>
                        <div class="so-plan-addon-list">
                            ${(plan.credit_addons || []).map((addon, aidx) => soRenderPlanCreditAddonRowHtml(addon, idx, aidx)).join('')}
                        </div>
                        <div class="so-plan-addon-toolbar">
                            <button type="button" class="so-btn-sm so-btn-touch" onclick="addSoPlanCreditAddon(${idx})">+ Add credit add-on</button>
                            <button type="button" class="so-btn-sm so-btn-touch" onclick="soCopyPlanAddonsFromCatalog(${idx})" title="Copy credits.addon_catalog into this plan">Copy from shared catalog</button>
                        </div>
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
                offer_badges: soParsePlanFeaturesText(get('offer_badges_text')),
                plan_kind: get('plan_kind'),
                description: get('description'),
                detail_subtitle: get('detail_subtitle'),
                detail_footer: get('detail_footer'),
                cta_text: get('cta_text'),
                card_subtitle: get('card_subtitle'),
                card_hint: get('card_hint'),
                show_whatsapp_icon: get('show_whatsapp_icon'),
                show_details_icon: get('show_details_icon'),
                highlights: soParsePlanFeaturesText(get('highlights_text')),
                features: soParsePlanFeaturesFromText(get('features_text')),
                detail_sections: soParsePlanDetailSectionsFromDom(row),
                device_tier: get('device_tier'),
                max_devices: get('max_devices'),
                billing_mode: get('billing_mode'),
                included_credits: get('included_credits'),
                allow_credit_addons: get('allow_credit_addons'),
                allow_plan_addons: get('allow_plan_addons'),
                hide_plan_addons_in_detail: get('hide_plan_addons_in_detail'),
                disable_plan_addons: get('disable_plan_addons'),
                allow_custom_plan: get('allow_custom_plan'),
                hide_custom_plan: get('hide_custom_plan'),
                disable_custom_plan: get('disable_custom_plan'),
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

    window.soCopyPlanAddonsFromCatalog = function(planIdx) {
        soPlans = soReadPlansFromDom();
        const plan = soPlans[planIdx];
        if (!plan) return;
        plan.credit_addons = soDeepClone(soGetAddonCatalogState());
        plan.allow_credit_addons = true;
        renderSoPlansEditor();
        soMarkTabDirty('config');
        soToast('Copied shared catalog to this plan — edit per plan if needed.');
    };

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
        const addon = plan.credit_addons[addonIdx];
        const label = addon ? (addon.label || `+${addon.credits} credits`) : 'this add-on';
        if (!confirm(`Remove credit add-on "${label}" from plan "${plan.name}"?\n\nExisting licenses keep credits already granted. Only new purchases use updated add-ons.`)) return;
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

    window.soOnPlanIncludedCreditsInput = function(idx) {
        soMarkTabDirty('config');
        const row = document.querySelector(`.so-pricing-plan-row[data-plan-idx="${idx}"]`);
        if (!row) return;
        const credits = parseInt(row.querySelector('[data-field="included_credits"]')?.value, 10) || 0;
        const billingSel = row.querySelector('[data-field="billing_mode"]');
        if (billingSel && credits > 0 && billingSel.value === 'subscription') {
            billingSel.value = 'hybrid';
        }
        if (soActiveTab === 'licenses') soUpdateLicenseCreditsBreakdown();
    };

    window.soOnPlanDaysInput = function(idx) {
        soMarkTabDirty('config');
        const row = document.querySelector(`.so-pricing-plan-row[data-plan-idx="${idx}"]`);
        if (!row) return;
        const days = parseInt(row.querySelector('[data-field="days"]')?.value, 10) || 0;
        const creditsEl = row.querySelector('[data-field="included_credits"]');
        if (!creditsEl) return;
        const current = parseInt(creditsEl.value, 10) || 0;
        if (current === 0 && days > 0) {
            creditsEl.value = soSuggestCreditsForPlanDays(days);
            soOnPlanIncludedCreditsInput(idx);
        }
    };

    window.addSoPlan = function() {
        soPlans = soReadPlansFromDom();
        const nextOrder = soPlans.length;
        const days = 30;
        const newPlan = soNormalizePlan({
            id: `plan_${nextOrder + 1}`,
            name: 'New Plan',
            price: 499,
            days,
            duration: '1 Month',
            device_tier: 'standard',
            max_devices: 1,
            billing_mode: 'hybrid',
            included_credits: soSuggestCreditsForPlanDays(days),
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
        await soConfirmSaveWithReview('config', async () => {
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
        });
    };

    window.saveShippingOptimizerCredits = async function() {
        if (!soRequireExtensionWrite()) return;
        await soConfirmSaveWithReview('credits', async () => {
        soSyncCreditPacksFromDom();
        const packErr = soValidateCreditPacks(soCreditPacks);
        if (packErr) return soToast(packErr);

        const creditsPayload = soBuildCreditsPayloadFromDom(soCreditPacks);
        const smartModePayload = soSmartModeToFirestore(soReadSmartModeFromDom());
        const smartErr = soValidateSmartMode(smartModePayload);
        if (smartErr) return soToast(smartErr);
        const packCount = (creditsPayload.packs || []).length;

        try {
            await soDb().collection(SO_CONFIG_DOC).doc(SO_CONFIG_ID).set({
                credits: creditsPayload,
                smart_mode: smartModePayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: soAuthEmail()
            }, { merge: true });
            soCredits = creditsPayload;
            soSmartMode = smartModePayload;
            soConfig = Object.assign({}, soConfig, { credits: creditsPayload, smart_mode: smartModePayload });
            soAfterTabSaved('credits');
            renderSoExtensionPreview();
            soToast(`Credits & ${packCount} pack${packCount === 1 ? '' : 's'} saved. Reopen extension popup to refresh.`);
        } catch (e) {
            soToast('Save failed: ' + (e.message || 'Unknown error'));
        }
        });
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

    function soPlanSelectBadges(plan) {
        const badges = [];
        if (soIsUnlimitedTime(plan) || plan.plan_kind === 'lifetime') badges.push('Lifetime');
        if (plan.unlimited_credits || soIsUnlimitedCredits(plan)) badges.push('∞ credits');
        if (plan.billing_mode === 'hybrid') badges.push('Hybrid');
        else if (plan.billing_mode === 'credits') badges.push('Credits');
        const inc = soGetPlanIncludedCredits(plan);
        if (inc > 0) badges.push(`${inc} cr`);
        if (plan.best) badges.push('Best');
        return badges.length ? ` [${badges.join(' · ')}]` : '';
    }

    function soPopulateLicensePlanSelect() {
        const sel = document.getElementById('so-license-plan');
        if (!sel) return;
        const plans = soGetAllPlansForSelect();
        sel.innerHTML = plans.map(p => {
            const inactive = p.active === false ? ' (hidden)' : '';
            const daysLabel = soIsUnlimitedTime(p) ? '∞' : `${p.days}d`;
            const badges = soPlanSelectBadges(p);
            const inc = soGetPlanIncludedCredits(p);
            return `<option value="${soAttr(p.id)}" data-days="${p.days}" data-included-credits="${inc}">${soEsc(p.name)} — ₹${p.price} (${daysLabel})${soEsc(badges)}${inactive}</option>`;
        }).join('');
        if (!soEditingLicenseKey) {
            const hasCurrent = sel.value && plans.some(p => p.id === sel.value);
            if (!hasCurrent) {
                const preferred = plans.find(p => p.id === SO_DEFAULT_LICENSE_PLAN_ID)
                    || plans.find(p => p.active !== false)
                    || plans[0];
                if (preferred) sel.value = preferred.id;
            }
        }
        soUpdateLicensePlanHint();
    }

    function soGetLicenseExpiryMode() {
        const checked = document.querySelector('input[name="so-license-expiry-mode"]:checked');
        return checked ? checked.value : 'activation';
    }

    function soSetLicenseExpiryMode(mode) {
        const el = document.querySelector(`input[name="so-license-expiry-mode"][value="${mode}"]`);
        if (el) el.checked = true;
        soOnLicenseExpiryModeChange();
    }

    window.soOnLicenseExpiryModeChange = function() {
        const mode = soGetLicenseExpiryMode();
        const dateWrap = document.getElementById('so-license-expires-at-wrap');
        const unlimitedEl = document.getElementById('so-license-unlimited-time');
        if (dateWrap) dateWrap.style.display = mode === 'fixed' ? 'block' : 'none';
        if (unlimitedEl) {
            unlimitedEl.checked = mode === 'never';
            unlimitedEl.disabled = mode === 'never';
        }
    };

    window.soOnLicenseUnlimitedTimeToggle = function() {
        const unlimitedEl = document.getElementById('so-license-unlimited-time');
        if (unlimitedEl && unlimitedEl.checked) soSetLicenseExpiryMode('never');
        else if (soGetLicenseExpiryMode() === 'never') soSetLicenseExpiryMode('activation');
    };

    function soReadLicenseExpiryFields() {
        const mode = soGetLicenseExpiryMode();
        const unlimitedEl = document.getElementById('so-license-unlimited-time');
        const unlimitedTime = !!(unlimitedEl && unlimitedEl.checked) || mode === 'never';
        let expiresAt = '';
        let expiryStartsOnActivation = true;
        if (mode === 'fixed') {
            const raw = String(document.getElementById('so-license-expires-at')?.value || '').trim();
            if (!raw) throw new Error('Pick a fixed expiry date or choose another expiry mode.');
            expiresAt = raw;
            expiryStartsOnActivation = false;
        } else if (mode === 'open') {
            expiresAt = '';
            expiryStartsOnActivation = false;
        } else if (mode === 'never') {
            expiresAt = '';
            expiryStartsOnActivation = true;
        }
        return { unlimited_time: unlimitedTime, expiresAt, expiry_starts_on_activation: expiryStartsOnActivation };
    }

    function soApplyLicenseExpiryFromDoc(lic) {
        if (!lic) {
            soSetLicenseExpiryMode('activation');
            return;
        }
        if (lic.unlimited_time || soIsUnlimitedTime(lic)) {
            soSetLicenseExpiryMode('never');
            return;
        }
        const expRaw = lic.expiresAt;
        let expStr = '';
        if (expRaw && typeof expRaw === 'string') expStr = expRaw.trim();
        else if (expRaw && expRaw.toDate) {
            const d = expRaw.toDate();
            expStr = d.toISOString().slice(0, 10);
        }
        if (expStr) {
            soSetLicenseExpiryMode('fixed');
            const dateEl = document.getElementById('so-license-expires-at');
            if (dateEl) dateEl.value = expStr.slice(0, 10);
            return;
        }
        if (lic.expiry_starts_on_activation === false) {
            soSetLicenseExpiryMode('open');
            return;
        }
        soSetLicenseExpiryMode('activation');
    }

    function soSetLicenseFormMode(editingKey) {
        soEditingLicenseKey = editingKey || null;
        if (editingKey) {
            const lic = soLicenses.find(l => l.key === editingKey);
            soLicenseEditBaselinePlanId = lic ? (lic.planId || lic.planType || null) : null;
        } else {
            soLicenseEditBaselinePlanId = null;
        }
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
        const genBtn = document.getElementById('so-license-generate-btn');
        if (genBtn) {
            genBtn.disabled = !!soEditingLicenseKey;
            genBtn.title = soEditingLicenseKey
                ? 'Cannot generate a new key while editing an existing license'
                : 'Generate a unique MEESHO-XXXX-XXXX-XXXX key';
        }
    }

    function soReadLicenseAddonFlags() {
        return {
            hide_plan_addons: !!document.getElementById('so-license-hide-plan-addons')?.checked,
            disable_plan_addons: !!document.getElementById('so-license-disable-plan-addons')?.checked,
            hide_custom_plan: !!document.getElementById('so-license-hide-custom-plan')?.checked,
            disable_custom_plan: !!document.getElementById('so-license-disable-custom-plan')?.checked,
            hide_license_custom_plans: !!document.getElementById('so-license-hide-license-custom-plans')?.checked,
            disable_license_custom_plans: !!document.getElementById('so-license-disable-license-custom-plans')?.checked
        };
    }

    function soApplyLicenseAddonFlagsToForm(lic) {
        const src = lic || {};
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };
        set('so-license-hide-plan-addons', src.hide_plan_addons);
        set('so-license-disable-plan-addons', src.disable_plan_addons);
        set('so-license-hide-custom-plan', src.hide_custom_plan);
        set('so-license-disable-custom-plan', src.disable_custom_plan);
        set('so-license-hide-license-custom-plans', src.hide_license_custom_plans);
        set('so-license-disable-license-custom-plans', src.disable_license_custom_plans);
        soApplyLicenseCustomPlansToForm(lic);
    }

    function soResolveLicenseCustomPlansFromDoc(lic) {
        const src = lic || {};
        const rawArr = src.license_custom_plans || src.licenseCustomPlans;
        if (Array.isArray(rawArr) && rawArr.length) {
            return rawArr.map((p, i) => soNormalizeLicenseCustomPlanEntry(p, i)).filter(Boolean);
        }
        const legacy = src.license_custom_plan || src.licenseCustomPlan;
        if (legacy && typeof legacy === 'object' && legacy.enabled !== false) {
            return [soNormalizeLicenseCustomPlanEntry(Object.assign({ id: 'custom_plan' }, legacy), 0)].filter(Boolean);
        }
        return [];
    }

    function soParseLicenseCustomPlanOptionsText(text) {
        const lines = String(text || '').split(/\r?\n/);
        const out = [];
        lines.forEach((line, i) => {
            const raw = line.trim();
            if (!raw || raw.startsWith('#')) return;
            const parts = raw.split(',').map(s => s.trim());
            const credits = Math.max(0, parseInt(parts[0], 10) || 0);
            const price = Math.max(0, parseInt(parts[1], 10) || 0);
            if (credits <= 0 && price <= 0) return;
            const label = parts.slice(2).join(',').trim()
                || `${credits} Credits · ₹${price}`;
            out.push(soNormalizeLicenseCustomPlanOption({
                id: soSlugifyId(`opt_${credits}_${price}_${i}`) || `opt_${i + 1}`,
                credits,
                price,
                label
            }, i, {}));
        });
        return out;
    }

    function soNormalizeLicenseCustomPlanOption(raw, index, planDefaults) {
        const defs = planDefaults || {};
        const credits = Math.max(0, parseInt(raw?.credits, 10) || 0);
        const price = Math.max(0, parseInt(raw?.price, 10) || 0);
        const label = String(raw?.label || `${credits} Credits · ₹${price}`).trim();
        const cardSubtitle = String(
            raw?.card_subtitle || raw?.cardSubtitle ||
            `${credits} credits · ₹${price}`
        ).trim();
        const cardHint = String(
            raw?.card_hint || raw?.cardHint || defs.card_hint || ''
        ).trim();
        const ctaText = String(
            raw?.cta_text || raw?.ctaText ||
            `Buy ${credits} credits on WhatsApp`
        ).trim();
        let showWhatsapp = defs.show_whatsapp_icon !== false;
        if (raw?.show_whatsapp_icon === false || raw?.showWhatsappIcon === false) showWhatsapp = false;
        else if (raw?.show_whatsapp_icon === true || raw?.showWhatsappIcon === true) showWhatsapp = true;
        let showDetails = defs.show_details_icon !== false;
        if (raw?.show_details_icon === false || raw?.showDetailsIcon === false) showDetails = false;
        else if (raw?.show_details_icon === true || raw?.showDetailsIcon === true) showDetails = true;
        return {
            id: soSlugifyId(raw?.id || `opt_${credits}_${price}_${index}`) || `opt_${index + 1}`,
            credits,
            price,
            label,
            card_subtitle: cardSubtitle,
            card_hint: cardHint,
            cta_text: ctaText,
            show_whatsapp_icon: showWhatsapp,
            show_details_icon: showDetails
        };
    }

    function soFormatLicenseCustomPlanOptionsForEditor(options) {
        return (options || []).map(o =>
            o.label && o.label !== `${o.credits} Credits · ₹${o.price}`
                ? `${o.credits},${o.price},${o.label}`
                : `${o.credits},${o.price}`
        ).join('\n');
    }

    function soRenderLicenseCustomPlanOptionRowHtml(opt, idx) {
        const o = opt || {};
        return `
            <div class="so-plan-addon-row so-lic-cplan-option-row" data-opt-idx="${idx}">
                <label><span>Credits</span><input type="number" min="1" step="1" data-opt-field="credits" value="${o.credits || 10}"></label>
                <label><span>Price ₹</span><input type="number" min="0" step="1" data-opt-field="price" value="${o.price || 0}"></label>
                <label class="so-field-full"><span>Card label (extension)</span><input type="text" data-opt-field="label" value="${soAttr(o.label || '')}" placeholder="80 Credits · ₹70"></label>
                <label class="so-field-full"><span>Card subtitle</span><input type="text" data-opt-field="card_subtitle" value="${soAttr(o.card_subtitle || '')}" placeholder="80 credits · ₹70"></label>
                <label class="so-field-full"><span>Card hint</span><input type="text" data-opt-field="card_hint" value="${soAttr(o.card_hint || '')}" placeholder="Tap to select · WhatsApp below"></label>
                <label class="so-field-full"><span>WhatsApp button label (this option)</span><input type="text" data-opt-field="cta_text" value="${soAttr(o.cta_text || '')}" placeholder="Buy 80 credits on WhatsApp"></label>
                <label class="so-plan-check"><input type="checkbox" data-opt-field="show_whatsapp_icon" ${o.show_whatsapp_icon !== false ? 'checked' : ''}> Show WhatsApp icon</label>
                <label class="so-plan-check"><input type="checkbox" data-opt-field="show_details_icon" ${o.show_details_icon !== false ? 'checked' : ''}> Show details icon</label>
                <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="soRemoveLicenseCustomPlanOptionRow(${idx})">Remove option</button>
            </div>`;
    }

    function soRenderLicenseCustomPlanOptionsEditor(options) {
        const container = document.getElementById('so-lic-cplan-modal-options-editor');
        if (!container) return;
        const list = options || [];
        if (!list.length) {
            container.innerHTML = '<p class="so-admin-muted">No credit options yet. Tap <strong>+ Add credit option</strong> or import lines.</p>';
            return;
        }
        container.innerHTML = list.map((o, i) => soRenderLicenseCustomPlanOptionRowHtml(o, i)).join('');
    }

    function soReadLicenseCustomPlanOptionsFromModal() {
        const container = document.getElementById('so-lic-cplan-modal-options-editor');
        const planDefaults = {
            card_hint: String(document.getElementById('so-lic-cplan-modal-card-hint')?.value || '').trim(),
            show_whatsapp_icon: !!document.getElementById('so-lic-cplan-modal-show-whatsapp-icon')?.checked,
            show_details_icon: !!document.getElementById('so-lic-cplan-modal-show-details-icon')?.checked
        };
        if (!container) return [];
        const rows = container.querySelectorAll('.so-lic-cplan-option-row');
        return Array.from(rows).map((row, idx) => {
            const get = (field) => {
                const el = row.querySelector(`[data-opt-field="${field}"]`);
                if (!el) return '';
                if (el.type === 'checkbox') return el.checked;
                return el.value;
            };
            return soNormalizeLicenseCustomPlanOption({
                id: get('id') || undefined,
                credits: get('credits'),
                price: get('price'),
                label: get('label'),
                card_subtitle: get('card_subtitle'),
                card_hint: get('card_hint'),
                cta_text: get('cta_text'),
                show_whatsapp_icon: get('show_whatsapp_icon'),
                show_details_icon: get('show_details_icon')
            }, idx, planDefaults);
        }).filter(o => o.credits > 0 || o.price > 0);
    }

    window.soAddLicenseCustomPlanOptionRow = function() {
        const planDefaults = {
            card_hint: String(document.getElementById('so-lic-cplan-modal-card-hint')?.value || '').trim(),
            show_whatsapp_icon: !!document.getElementById('so-lic-cplan-modal-show-whatsapp-icon')?.checked,
            show_details_icon: !!document.getElementById('so-lic-cplan-modal-show-details-icon')?.checked
        };
        const current = soReadLicenseCustomPlanOptionsFromModal();
        current.push(soNormalizeLicenseCustomPlanOption({ credits: 10, price: 20 }, current.length, planDefaults));
        soRenderLicenseCustomPlanOptionsEditor(current);
    };

    window.soRemoveLicenseCustomPlanOptionRow = function(idx) {
        const current = soReadLicenseCustomPlanOptionsFromModal();
        current.splice(idx, 1);
        soRenderLicenseCustomPlanOptionsEditor(current);
    };

    window.soImportLicenseCustomPlanOptionsFromTextarea = function() {
        const planDefaults = {
            card_hint: String(document.getElementById('so-lic-cplan-modal-card-hint')?.value || '').trim(),
            show_whatsapp_icon: !!document.getElementById('so-lic-cplan-modal-show-whatsapp-icon')?.checked,
            show_details_icon: !!document.getElementById('so-lic-cplan-modal-show-details-icon')?.checked
        };
        const parsed = soParseLicenseCustomPlanOptionsText(
            document.getElementById('so-lic-cplan-modal-options')?.value || ''
        ).map((o, i) => soNormalizeLicenseCustomPlanOption(o, i, planDefaults));
        soRenderLicenseCustomPlanOptionsEditor(parsed);
        soToast(parsed.length ? `Imported ${parsed.length} option(s).` : 'No valid lines to import.');
    };

    function soNormalizeLicenseCustomPlanEntry(raw, index) {
        if (!raw || typeof raw !== 'object') return null;
        const id = soSlugifyId(raw.id || raw.slug || `license_custom_${index + 1}`);
        if (!id) return null;
        const planDefaults = {
            card_hint: String(raw.card_hint || raw.cardHint || 'Tap to select · WhatsApp below').trim(),
            show_whatsapp_icon: raw.show_whatsapp_icon !== false && raw.showWhatsappIcon !== false,
            show_details_icon: raw.show_details_icon !== false && raw.showDetailsIcon !== false
        };
        let options = Array.isArray(raw.options) ? raw.options : [];
        options = options.map((o, i) => soNormalizeLicenseCustomPlanOption(o, i, planDefaults))
            .filter(o => o.credits > 0 || o.price > 0);
        return {
            id,
            enabled: raw.enabled !== false && raw.active !== false,
            disabled: raw.disabled === true || raw.disable === true || raw.disable_block === true,
            label: String(raw.label || 'Request Custom Plan via WhatsApp').trim(),
            whatsapp_title: String(raw.whatsapp_title || raw.whatsappTitle || 'My Plans').trim(),
            description: String(raw.description || 'Pick a bundle below and send via WhatsApp.').trim(),
            detail_footer: String(raw.detail_footer || raw.detailFooter || '').trim(),
            card_hint: planDefaults.card_hint,
            show_whatsapp_icon: planDefaults.show_whatsapp_icon,
            show_details_icon: planDefaults.show_details_icon,
            order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
            options
        };
    }

    function soSuggestNextLicenseCustomPlanId() {
        const used = new Set(soLicenseCustomPlans.map(p => p.id));
        for (let i = 1; i <= 99; i++) {
            const id = `license${i}`;
            if (!used.has(id)) return id;
        }
        return `license_${Date.now().toString(36)}`;
    }

    function soDefaultLicenseCustomPlanOption(planDefaults, index) {
        return soNormalizeLicenseCustomPlanOption(
            { credits: 10, price: 20 },
            index,
            planDefaults || {}
        );
    }

    function soApplyLicenseCustomPlansToForm(lic) {
        soLicenseCustomPlans = soResolveLicenseCustomPlansFromDoc(lic);
        soExpandedLicenseCustomPlanIds = new Set(soLicenseCustomPlans.map(p => p.id));
        soRenderLicenseCustomPlansEditor();
    }

    function soRenderLicenseCustomPlansEditor() {
        const container = document.getElementById('so-license-custom-plans-editor');
        const countEl = document.getElementById('so-license-custom-plans-count');
        const plans = soLicenseCustomPlans.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        if (countEl) countEl.textContent = `${plans.length} custom plan${plans.length === 1 ? '' : 's'}`;
        if (!container) return;
        if (!plans.length) {
            container.innerHTML = '<p class="so-admin-muted">No license custom plans yet. Tap <strong>+ Add custom plan</strong>.</p>';
            return;
        }
        container.innerHTML = plans.map((plan, idx) => {
            const open = soExpandedLicenseCustomPlanIds.has(plan.id);
            return `
            <div class="so-plan-card so-license-custom-plan-row so-collapsible-row ${open ? 'so-collapsible-row--open' : ''}" data-lic-cplan-id="${soAttr(plan.id)}">
                <div class="so-plan-card-head-wrap">
                    <button type="button" class="so-plan-card-head" onclick="soToggleLicenseCustomPlanRow('${soAttr(plan.id)}')" aria-expanded="${open ? 'true' : 'false'}">
                        <span class="so-plan-order" aria-hidden="true">${idx + 1}</span>
                        <div class="so-plan-card-summary">
                            <div class="so-plan-card-title-row">
                                <strong class="so-plan-card-name">${soEsc(plan.whatsapp_title || plan.id)}</strong>
                            </div>
                            <div class="so-plan-card-meta">
                                <code class="so-plan-id-tag">${soEsc(plan.id)}</code>
                                · ${(plan.options || []).length} pack${(plan.options || []).length === 1 ? '' : 's'}
                            </div>
                            <div class="so-plan-card-badges">
                                ${plan.enabled !== false ? '<span class="so-badge so-badge--on">Visible</span>' : '<span class="so-badge so-badge--off">Hidden</span>'}
                                ${plan.disabled ? '<span class="so-badge so-badge--warn">Disabled</span>' : ''}
                            </div>
                        </div>
                        <i class="fa fa-chevron-down so-plan-chevron" aria-hidden="true"></i>
                    </button>
                    <div class="so-plan-reorder" onclick="event.stopPropagation()">
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="soMoveLicenseCustomPlan('${soAttr(plan.id)}', -1)" title="Move up">▲</button>
                        <button type="button" class="so-btn-icon so-btn-touch" onclick="soMoveLicenseCustomPlan('${soAttr(plan.id)}', 1)" title="Move down">▼</button>
                    </div>
                </div>
                <div class="so-plan-card-body" onclick="event.stopPropagation()">
                    <p class="so-admin-muted"><strong>WhatsApp CTA:</strong> ${soEsc(plan.label || 'Request Custom Plan via WhatsApp')}</p>
                    ${(plan.options || []).length
                        ? `<div class="so-ext-plan-addons">${plan.options.map(o =>
                            `<span class="so-ext-addon-chip">${soEsc(o.label || `${o.credits} Credits · ₹${o.price}`)}</span>`
                        ).join('')}</div>`
                        : '<p class="so-admin-muted">No credit packs yet — tap <strong>+ Add credit pack</strong> below.</p>'}
                    <div class="so-plan-actions-bar">
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="soQuickAddLicenseCustomPlanOption('${soAttr(plan.id)}')"><i class="fa fa-plus"></i> Add credit pack</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="soOpenLicenseCustomPlanModalById('${soAttr(plan.id)}')"><i class="fa fa-pen"></i> Edit block</button>
                        <button type="button" class="so-btn-sm so-btn-sm--danger so-btn-touch" onclick="soRemoveLicenseCustomPlan('${soAttr(plan.id)}')"><i class="fa fa-trash"></i> Remove block</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    window.soToggleLicenseCustomPlanRow = function(id) {
        if (soExpandedLicenseCustomPlanIds.has(id)) soExpandedLicenseCustomPlanIds.delete(id);
        else soExpandedLicenseCustomPlanIds.add(id);
        soRenderLicenseCustomPlansEditor();
    };

    window.soExpandAllLicenseCustomPlans = function() {
        soLicenseCustomPlans.forEach(p => soExpandedLicenseCustomPlanIds.add(p.id));
        soRenderLicenseCustomPlansEditor();
    };

    window.soCollapseAllLicenseCustomPlans = function() {
        soExpandedLicenseCustomPlanIds.clear();
        soRenderLicenseCustomPlansEditor();
    };

    window.soMoveLicenseCustomPlan = function(id, delta) {
        const idx = soLicenseCustomPlans.findIndex(p => p.id === id);
        if (idx < 0) return;
        const next = idx + delta;
        if (next < 0 || next >= soLicenseCustomPlans.length) return;
        const arr = soLicenseCustomPlans.slice();
        const tmp = arr[idx];
        arr[idx] = arr[next];
        arr[next] = tmp;
        arr.forEach((p, i) => { p.order = i; });
        soLicenseCustomPlans = arr;
        soRenderLicenseCustomPlansEditor();
    };

    window.soRemoveLicenseCustomPlan = function(id) {
        soLicenseCustomPlans = soLicenseCustomPlans.filter(p => p.id !== id);
        soExpandedLicenseCustomPlanIds.delete(id);
        soRenderLicenseCustomPlansEditor();
    };

    window.soQuickAddLicenseCustomPlanOption = function(planId) {
        const idx = soLicenseCustomPlans.findIndex(p => p.id === planId);
        if (idx < 0) return soToast('Custom plan block not found.');
        const plan = soLicenseCustomPlans[idx];
        const planDefaults = {
            card_hint: plan.card_hint || '',
            show_whatsapp_icon: plan.show_whatsapp_icon !== false,
            show_details_icon: plan.show_details_icon !== false
        };
        const options = (plan.options || []).slice();
        options.push(soDefaultLicenseCustomPlanOption(planDefaults, options.length));
        soLicenseCustomPlans[idx] = soNormalizeLicenseCustomPlanEntry(Object.assign({}, plan, { options }), idx);
        soExpandedLicenseCustomPlanIds.add(planId);
        soRenderLicenseCustomPlansEditor();
        soOpenLicenseCustomPlanModal(idx);
        soToast('Added another credit pack row — set credits/price, then Save plan.');
    };

    window.soOpenLicenseCustomPlanModalById = function(id) {
        const idx = soLicenseCustomPlans.findIndex(p => p.id === id);
        soOpenLicenseCustomPlanModal(idx >= 0 ? idx : -1);
    };

    window.soOpenLicenseCustomPlanModal = function(idx) {
        soLicenseCustomPlanModalIdx = typeof idx === 'number' ? idx : -1;
        const modal = document.getElementById('so-license-custom-plan-modal');
        const title = document.getElementById('so-license-custom-plan-modal-title');
        const plan = soLicenseCustomPlanModalIdx >= 0 ? soLicenseCustomPlans[soLicenseCustomPlanModalIdx] : null;
        if (title) {
            title.textContent = plan
                ? `Edit MY PLANS block · ${plan.whatsapp_title || plan.id}`
                : 'Add MY PLANS block';
        }
        const suggestedId = plan?.id || soSuggestNextLicenseCustomPlanId();
        document.getElementById('so-lic-cplan-modal-id').value = suggestedId;
        document.getElementById('so-lic-cplan-modal-id').readOnly = !!plan;
        document.getElementById('so-lic-cplan-modal-label').value = plan?.label || 'Request Custom Plan via WhatsApp';
        document.getElementById('so-lic-cplan-modal-whatsapp-title').value = plan?.whatsapp_title || 'My Plans';
        document.getElementById('so-lic-cplan-modal-description').value = plan?.description || '';
        document.getElementById('so-lic-cplan-modal-card-hint').value = plan?.card_hint || 'Tap to select · WhatsApp below';
        document.getElementById('so-lic-cplan-modal-detail-footer').value = plan?.detail_footer || '';
        document.getElementById('so-lic-cplan-modal-show-whatsapp-icon').checked = plan ? plan.show_whatsapp_icon !== false : true;
        document.getElementById('so-lic-cplan-modal-show-details-icon').checked = plan ? plan.show_details_icon !== false : true;
        document.getElementById('so-lic-cplan-modal-options').value = plan
            ? soFormatLicenseCustomPlanOptionsForEditor(plan.options)
            : '';
        const defaultOpts = plan?.options?.length
            ? plan.options
            : [soDefaultLicenseCustomPlanOption({ card_hint: 'Tap to select · WhatsApp below' }, 0)];
        soRenderLicenseCustomPlanOptionsEditor(defaultOpts);
        document.getElementById('so-lic-cplan-modal-active').checked = plan ? plan.enabled !== false : true;
        document.getElementById('so-lic-cplan-modal-disabled').checked = !!plan?.disabled;
        if (modal) {
            modal.style.display = '';
            modal.hidden = false;
            document.body.classList.add('so-modal-open');
        }
    };

    window.soCloseLicenseCustomPlanModal = function() {
        const modal = document.getElementById('so-license-custom-plan-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.hidden = true;
        }
        document.body.classList.remove('so-modal-open');
        soLicenseCustomPlanModalIdx = -1;
    };

    window.soSaveLicenseCustomPlanModal = function() {
        const idRaw = String(document.getElementById('so-lic-cplan-modal-id')?.value || '').trim();
        const id = soSlugifyId(idRaw || `license_custom_${Date.now().toString(36)}`);
        if (!id) return soToast('Plan id is required.');
        const label = String(document.getElementById('so-lic-cplan-modal-label')?.value || '').trim();
        const whatsappTitle = String(document.getElementById('so-lic-cplan-modal-whatsapp-title')?.value || '').trim();
        const description = String(document.getElementById('so-lic-cplan-modal-description')?.value || '').trim();
        const cardHint = String(document.getElementById('so-lic-cplan-modal-card-hint')?.value || '').trim();
        const detailFooter = String(document.getElementById('so-lic-cplan-modal-detail-footer')?.value || '').trim();
        const showWhatsappIcon = !!document.getElementById('so-lic-cplan-modal-show-whatsapp-icon')?.checked;
        const showDetailsIcon = !!document.getElementById('so-lic-cplan-modal-show-details-icon')?.checked;
        const options = soReadLicenseCustomPlanOptionsFromModal();
        const enabled = !!document.getElementById('so-lic-cplan-modal-active')?.checked;
        const disabled = !!document.getElementById('so-lic-cplan-modal-disabled')?.checked;
        const entry = soNormalizeLicenseCustomPlanEntry({
            id,
            enabled,
            disabled,
            label: label || 'Request Custom Plan via WhatsApp',
            whatsapp_title: whatsappTitle || 'My Plans',
            description: description || 'Pick a bundle below and send via WhatsApp.',
            card_hint: cardHint,
            detail_footer: detailFooter,
            show_whatsapp_icon: showWhatsappIcon,
            show_details_icon: showDetailsIcon,
            options,
            order: soLicenseCustomPlanModalIdx >= 0
                ? (soLicenseCustomPlans[soLicenseCustomPlanModalIdx]?.order ?? soLicenseCustomPlanModalIdx)
                : soLicenseCustomPlans.length
        }, soLicenseCustomPlans.length);
        if (!entry) return soToast('Invalid custom plan.');
        const dup = soLicenseCustomPlans.findIndex(p => p.id === entry.id);
        if (dup >= 0 && dup !== soLicenseCustomPlanModalIdx) {
            return soToast(`Plan id "${entry.id}" already exists — use a unique slug (e.g. ${soSuggestNextLicenseCustomPlanId()}) or add another credit pack to the existing block.`);
        }
        const wasEdit = soLicenseCustomPlanModalIdx >= 0;
        if (wasEdit) {
            soLicenseCustomPlans[soLicenseCustomPlanModalIdx] = entry;
        } else {
            soLicenseCustomPlans.push(entry);
        }
        soExpandedLicenseCustomPlanIds.add(entry.id);
        soRenderLicenseCustomPlansEditor();
        soCloseLicenseCustomPlanModal();
        const saveHint = soEditingLicenseKey
            ? ' — tap Update license (or Save to Firebase) to write Firebase.'
            : ' — save license to write Firebase.';
        soToast((wasEdit ? 'Custom plan updated on form' : 'Custom plan added') + saveHint);
    };

    window.soClearLicenseCustomPlan = function() {
        soLicenseCustomPlans = [];
        soExpandedLicenseCustomPlanIds.clear();
        soCloseLicenseCustomPlanModal();
        soRenderLicenseCustomPlansEditor();
    };

    function soReadLicenseCustomPlanFields(forUpdate) {
        const plans = soLicenseCustomPlans
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((p, i) => ({
                id: p.id,
                enabled: p.enabled !== false,
                disabled: !!p.disabled,
                label: p.label,
                whatsapp_title: p.whatsapp_title,
                description: p.description,
                detail_footer: p.detail_footer || '',
                card_hint: p.card_hint || '',
                show_whatsapp_icon: p.show_whatsapp_icon !== false,
                show_details_icon: p.show_details_icon !== false,
                order: i,
                options: (p.options || []).map((o, oi) => {
                    const row = {
                        id: o.id || `opt_${oi + 1}`,
                        credits: o.credits,
                        price: o.price,
                        label: o.label,
                        card_subtitle: o.card_subtitle || '',
                        card_hint: o.card_hint || '',
                        cta_text: o.cta_text || ''
                    };
                    if (o.show_whatsapp_icon === false) row.show_whatsapp_icon = false;
                    if (o.show_details_icon === false) row.show_details_icon = false;
                    return row;
                })
            }));
        if (!plans.length) {
            if (forUpdate) {
                return {
                    license_custom_plans: firebase.firestore.FieldValue.delete(),
                    license_custom_plan: firebase.firestore.FieldValue.delete()
                };
            }
            return {};
        }
        const out = { license_custom_plans: plans };
        if (forUpdate) out.license_custom_plan = firebase.firestore.FieldValue.delete();
        return out;
    }

    function soReadLicenseFormFields() {
        soSyncLicenseBillingModeFromCredits();
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

    function soBuildLicenseCreditFields(plan, formFields, existingLic) {
        const selectedIds = formFields.addon_credit_ids || [];
        const calc = plan ? soCalculatePlanCredits(plan, selectedIds) : { included: 0, addon: 0, total: 0 };
        const custom = soReadLicenseCustomCredits();
        const customLabel = soReadLicenseCustomCreditsLabel();
        const planTotal = calc.included + calc.addon;
        const manualTotal = Math.max(0, parseInt(document.getElementById('so-license-total-credits')?.value, 10) || 0);
        const used = Math.max(0, parseInt(formFields.credits_used, 10) || 0);
        const balanceRaw = formFields.credits_balance != null
            ? Math.max(0, parseInt(formFields.credits_balance, 10) || 0)
            : null;
        let effectiveTotal = planTotal + custom;
        if (manualTotal > effectiveTotal) effectiveTotal = manualTotal;
        if (balanceRaw != null && (balanceRaw + used) > effectiveTotal) {
            effectiveTotal = balanceRaw + used;
        }
        const out = {
            included_credits: calc.included,
            addon_credits: calc.addon,
            addon_credit_ids: selectedIds,
            custom_credits: custom
        };
        if (customLabel) out.custom_credits_label = customLabel;
        if (effectiveTotal > planTotal + custom && custom === 0) {
            out.bonus_credits = effectiveTotal - planTotal;
        }
        if (!soIsUnlimitedCredits(plan) && !formFields.unlimited_credits) {
            out.credits_balance = balanceRaw != null ? balanceRaw : Math.max(0, effectiveTotal - used);
            out.credits_used = used;
            const breakdown = {
                included: calc.included,
                addon: calc.addon,
                custom,
                grantTotal: effectiveTotal
            };
            const pools = soResolveLicenseConsumedPools(existingLic || null, breakdown, used);
            out.included_credits_used = pools.includedUsed;
            out.addon_credits_used = pools.addonUsed;
            out.custom_credits_used = pools.customUsed;
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
        if (billingEl) {
            soLicenseBillingManualOverride = false;
            billingEl.value = 'subscription';
        }
        const maxEl = document.getElementById('so-license-max-devices');
        if (maxEl) {
            maxEl.value = plan.max_devices != null
                ? plan.max_devices
                : (SO_DEVICE_TIER_MAX[plan.device_tier] != null ? SO_DEVICE_TIER_MAX[plan.device_tier] : 1);
        }
        soSetLicenseUnlimitedCheckboxes(plan);
        if (!soEditingLicenseKey) {
            if (soIsUnlimitedTime(plan)) soSetLicenseExpiryMode('never');
            else soSetLicenseExpiryMode('activation');
        }
        const preselected = (plan.credit_addons || []).filter(a => a.default_selected).map(a => a.id);
        soRenderLicenseAddonPicks(plan, preselected);
        if (!soEditingLicenseKey) {
            soPrefillLicenseCreditsFromPlan(plan, preselected);
        }
        soUpdateLicenseCreditsBreakdown();
        soSyncLicenseBillingModeFromCredits();
    }

    function soApplyPlanDefaultsToLicenseFormOnEdit(plan) {
        if (!plan || !soEditingLicenseKey) return;
        const lic = soLicenses.find(l => l.key === soEditingLicenseKey);
        const used = Math.max(
            0,
            parseInt(document.getElementById('so-license-credits-used')?.value, 10)
                || parseInt(lic?.credits_used, 10)
                || 0
        );
        const custom = soReadLicenseCustomCredits();
        const billingEl = document.getElementById('so-license-billing-mode');
        if (billingEl && lic?.billing_mode === 'credits') {
            soLicenseBillingManualOverride = true;
            billingEl.value = 'credits';
        } else if (billingEl) {
            soLicenseBillingManualOverride = false;
        }
        const maxEl = document.getElementById('so-license-max-devices');
        if (maxEl && !lic?.activatedAt) {
            maxEl.value = plan.max_devices != null
                ? plan.max_devices
                : (SO_DEVICE_TIER_MAX[plan.device_tier] != null ? SO_DEVICE_TIER_MAX[plan.device_tier] : maxEl.value);
        }
        if (!lic?.activatedAt && !lic?.expiresAt) {
            if (soIsUnlimitedTime(plan)) soSetLicenseExpiryMode('never');
            else if (soGetLicenseExpiryMode() === 'never' && !soIsUnlimitedTime(plan)) soSetLicenseExpiryMode('activation');
        }
        const prevSelected = soReadSelectedLicenseAddonIds();
        const newPlanAddons = soGetActivePlanCreditAddons(plan);
        const kept = prevSelected.filter(id => newPlanAddons.some(a => a.id === id));
        const preselected = kept.length
            ? kept
            : newPlanAddons.filter(a => a.default_selected).map(a => a.id);
        soRenderLicenseAddonPicks(plan, preselected);
        const calc = soCalculatePlanCredits(plan, preselected);
        const grantTotal = calc.included + calc.addon + custom;
        const includedEl = document.getElementById('so-license-included-credits');
        const addonEl = document.getElementById('so-license-addon-credits');
        const totalEl = document.getElementById('so-license-total-credits');
        const balEl = document.getElementById('so-license-credits-balance');
        if (includedEl) includedEl.value = calc.included;
        if (addonEl) addonEl.value = calc.addon;
        if (totalEl) totalEl.value = grantTotal;
        if (balEl) balEl.value = Math.max(0, grantTotal - used);
        soLicenseCreditsTotalDirty = false;
        soUpdateLicenseCreditsBreakdown();
        soSyncLicenseBillingModeFromCredits();
    }

    function soOpenLicenseCreateAccordion(options) {
        const opts = options || {};
        soOpenSections.add('license-create');
        const formSection = document.querySelector('.so-section-accordion[data-so-section="license-create"]');
        if (formSection) formSection.classList.add('so-section-accordion--open');
        if (opts.scroll !== false) {
            requestAnimationFrame(() => {
                const target = document.getElementById('so-license-key-input')
                    || document.getElementById('so-license-form-title');
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    function soCloseLicenseCreateAccordion(options) {
        const opts = options || {};
        const formSection = document.querySelector('.so-section-accordion[data-so-section="license-create"]');
        if (formSection) formSection.classList.remove('so-section-accordion--open');
        soOpenSections.delete('license-create');
        if (opts.scrollToKey) {
            requestAnimationFrame(() => {
                const rows = document.querySelectorAll('.so-license-row[data-license-key]');
                const row = Array.from(rows).find(r => r.getAttribute('data-license-key') === opts.scrollToKey);
                if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                else document.getElementById('so-licenses-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        } else if (opts.scrollToList) {
            requestAnimationFrame(() => {
                document.getElementById('so-licenses-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
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
        if (plan && soGetPlanIncludedCredits(plan) > 0) {
            hint.textContent += ` · ${soGetPlanIncludedCredits(plan)} credits included in plan.`;
        }
        if (soEditingLicenseKey) {
            if (plan && soLicensePlanChangedOnEdit(plan)) {
                soApplyPlanDefaultsToLicenseFormOnEdit(plan);
            } else {
                soUpdateLicenseCreditsBreakdown();
            }
        } else if (plan) {
            soApplyPlanDefaultsToLicenseForm(plan);
        } else {
            soUpdateLicenseCreditsBreakdown();
        }
    };

    window.cancelSoLicenseEdit = function() {
        const wasEdit = !!soEditingLicenseKey;
        soSetLicenseFormMode(null);
        document.getElementById('so-license-key-input').value = '';
        document.getElementById('so-license-customer-name').value = '';
        document.getElementById('so-license-customer-phone').value = '';
        document.getElementById('so-license-customer-email').value = '';
        const addrEl = document.getElementById('so-license-customer-address');
        if (addrEl) addrEl.value = '';
        const locEl = document.getElementById('so-license-customer-location');
        if (locEl) locEl.value = soGuessAdminLocation();
        const ipEl = document.getElementById('so-license-customer-ip');
        if (ipEl) ipEl.value = '';
        soLicenseBillingManualOverride = false;
        soLicenseCreditsTotalDirty = false;
        document.getElementById('so-license-support-notes').value = '';
        document.getElementById('so-license-max-devices').value = '';
        document.getElementById('so-license-credits-balance').value = '0';
        document.getElementById('so-license-credits-used').value = '0';
        const customEl = document.getElementById('so-license-custom-credits');
        const customLabelEl = document.getElementById('so-license-custom-credits-label');
        if (customEl) customEl.value = '0';
        if (customLabelEl) customLabelEl.value = '';
        document.getElementById('so-license-billing-mode').value = 'subscription';
        soSetLicenseUnlimitedCheckboxes({});
        soSetLicenseExpiryMode('activation');
        const dateEl = document.getElementById('so-license-expires-at');
        if (dateEl) dateEl.value = '';
        soRenderLicenseAddonPicks(null, []);
        soApplyLicenseAddonFlagsToForm({});
        soClearLicenseCustomPlan();
        soUpdateLicensePlanHint();
        soUpdateLicenseCreditsBreakdown();
        if (wasEdit) soCloseLicenseCreateAccordion();
    };

    window.editSoLicense = async function(key) {
        await openShippingOptimizerPanel();
        const lic = soLicenses.find(l => l.key === key);
        if (!lic) return soToast('License not found.');
        soSetLicenseFormMode(key);
        document.getElementById('so-license-key-input').value = lic.key;
        const planSel = document.getElementById('so-license-plan');
        if (planSel && (lic.planId || lic.planType)) planSel.value = lic.planId || lic.planType;
        document.getElementById('so-license-billing-mode').value = lic.billing_mode || 'subscription';
        soLicenseBillingManualOverride = lic.billing_mode === 'credits';
        document.getElementById('so-license-max-devices').value = lic.max_devices != null ? lic.max_devices : '';
        document.getElementById('so-license-credits-balance').value = lic.credits_balance != null ? lic.credits_balance : 0;
        document.getElementById('so-license-credits-used').value = lic.credits_used != null ? lic.credits_used : 0;
        const includedEl = document.getElementById('so-license-included-credits');
        const addonEl = document.getElementById('so-license-addon-credits');
        const totalEl = document.getElementById('so-license-total-credits');
        if (includedEl) includedEl.value = lic.included_credits != null ? lic.included_credits : 0;
        if (addonEl) addonEl.value = lic.addon_credits != null ? lic.addon_credits : 0;
        const customEl = document.getElementById('so-license-custom-credits');
        const customLabelEl = document.getElementById('so-license-custom-credits-label');
        const customStored = lic.custom_credits != null ? lic.custom_credits : lic.bonus_credits;
        if (customEl) customEl.value = customStored != null ? customStored : 0;
        if (customLabelEl) customLabelEl.value = lic.custom_credits_label || lic.customCreditsLabel || '';
        const grantTotal = (parseInt(lic.included_credits, 10) || 0)
            + (parseInt(lic.addon_credits, 10) || 0)
            + (parseInt(customStored, 10) || 0);
        soLicenseCreditsTotalDirty = false;
        if (totalEl) {
            totalEl.value = grantTotal > 0
                ? grantTotal
                : ((parseInt(lic.credits_balance, 10) || 0) + (parseInt(lic.credits_used, 10) || 0));
        }
        soSetLicenseUnlimitedCheckboxes(lic);
        const addonIds = Array.isArray(lic.addon_credit_ids) ? lic.addon_credit_ids
            : (Array.isArray(lic.addonCreditIds) ? lic.addonCreditIds : []);
        const plan = soPlans.find(p => p.id === (lic.planId || lic.planType));
        soRenderLicenseAddonPicks(plan, addonIds);
        document.getElementById('so-license-customer-name').value = lic.customer_name || '';
        document.getElementById('so-license-customer-phone').value = lic.customer_phone || '';
        document.getElementById('so-license-customer-email').value = lic.customer_email || '';
        const addrEl = document.getElementById('so-license-customer-address');
        if (addrEl) addrEl.value = lic.customer_address || lic.customerAddress || '';
        const locEl = document.getElementById('so-license-customer-location');
        if (locEl) locEl.value = lic.customer_location || lic.customerLocation || '';
        const ipEl = document.getElementById('so-license-customer-ip');
        if (ipEl) ipEl.value = lic.customer_ip || lic.customerIp || '';
        document.getElementById('so-license-support-notes').value = lic.support_notes || '';
        soApplyLicenseExpiryFromDoc(lic);
        soApplyLicenseAddonFlagsToForm(lic);
        soPrefillLicenseCustomerFields(lic);
        soSyncLicenseBillingModeFromCredits();
        soUpdateLicensePlanHint();
        soUpdateLicenseCreditsBreakdown();
        switchShippingOptimizerTab('licenses');
        soOpenLicenseCreateAccordion({ scroll: true });
        soToast(`Editing ${key} — change plan or credits, then tap Update license.`);
    };

    window.generateSoLicenseKey = async function() {
        if (!soRequireSuperAdmin()) return;
        if (soEditingLicenseKey) {
            return soToast('Cannot generate a new key while editing an existing license.');
        }
        try {
            await soLoadConfig();
            const key = await soGenerateUniqueLicenseKey();
            const el = document.getElementById('so-license-key-input');
            if (el) el.value = key;
            const planId = document.getElementById('so-license-plan')?.value;
            const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
            if (plan && !soEditingLicenseKey) {
                soApplyPlanDefaultsToLicenseForm(plan);
            } else {
                soUpdateLicenseCreditsBreakdown();
            }
            soToast('Unique key generated — credits prefilled from plan.');
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
        const unlimitedDevices = formFields.unlimited_devices !== false;
        let maxDevices = unlimitedDevices
            ? 0
            : (formFields.max_devices != null
                ? formFields.max_devices
                : (plan.max_devices != null ? plan.max_devices : 1));
        let expiryFields;
        try {
            expiryFields = soReadLicenseExpiryFields();
        } catch (e) {
            return soToast(e.message || 'Invalid expiry settings.');
        }
        const customerFields = soReadLicenseCustomerFields();
        const addonFlags = soReadLicenseAddonFlags();
        const customPlanFields = soReadLicenseCustomPlanFields(false);
        const payload = Object.assign({
            active: true,
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
            billing_mode: formFields.billing_mode || 'subscription',
            max_devices: maxDevices,
            credits_used: formFields.credits_used,
            unlimited_time: expiryFields.unlimited_time || formFields.unlimited_time || soIsUnlimitedTime(plan),
            unlimited_devices: unlimitedDevices,
            unlimited_credits: formFields.unlimited_credits || soIsUnlimitedCredits(plan),
            device_ids: [],
            expiry_starts_on_activation: expiryFields.expiry_starts_on_activation,
            expiresAt: expiryFields.expiresAt,
            machineId: '',
            activatedAt: '',
            images_generated_total: 0,
            images_generated_today: 0,
            images_generated_today_date: '',
            images_generated_month: 0,
            images_generated_month_key: '',
            support_notes: String(document.getElementById('so-license-support-notes')?.value || '').trim(),
            issued_at: firebase.firestore.FieldValue.serverTimestamp(),
            shared_at: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: soAuthEmail()
        }, customerFields, addonFlags, customPlanFields, soBuildLicenseCreditFields(plan, formFields, null));
        payload.key = key;
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Create license → Firebase',
            bodyHtml: soBuildLicenseSavePreviewHtml(payload, 'create'),
            confirmLabel: 'Create license in Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        delete payload.key;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set(payload);
            cancelSoLicenseEdit();
            await soLoadLicenses();
            soRefreshLicenseUIs();
            renderSoCustomerRegistry();
            soCloseLicenseCreateAccordion({ scrollToKey: key });
            const custLabel = soCustomerDetailsComplete(payload) ? 'Customer mapped.' : 'License created — add customer name/email anytime.';
            soToast(`License ${key} created. ${custLabel}`);
        } catch (e) {
            soToast('Create failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.updateSoLicense = async function() {
        if (!soRequireExtensionWrite()) return;
        const key = soEditingLicenseKey;
        if (!key) return createSoLicense();
        const existingLic = soLicenses.find(l => l.key === key);
        if (!soConfirmLicenseCustomerClear(existingLic)) return;
        const planId = String(document.getElementById('so-license-plan')?.value || '').trim();
        const plan = soPlans.find(p => p.id === planId) || soGetAllPlansForSelect().find(p => p.id === planId);
        if (!plan) return soToast('Select a valid plan.');
        const formFields = soReadLicenseFormFields();
        let maxDevices = formFields.max_devices;
        if (maxDevices == null) {
            maxDevices = soIsUnlimitedDevices(plan) ? 0 : (plan.max_devices != null ? plan.max_devices : 1);
        }
        if (formFields.unlimited_devices) maxDevices = 0;
        let expiryFields;
        try {
            expiryFields = soReadLicenseExpiryFields();
        } catch (e) {
            return soToast(e.message || 'Invalid expiry settings.');
        }
        const customerFields = soReadLicenseCustomerFields();
        const addonFlags = soReadLicenseAddonFlags();
        const customPlanFields = soReadLicenseCustomPlanFields(true);
        const payload = Object.assign({
            planId: plan.id,
            planType: plan.id,
            planDays: plan.days,
            billing_mode: formFields.billing_mode,
            max_devices: maxDevices,
            credits_used: formFields.credits_used,
            unlimited_time: expiryFields.unlimited_time,
            unlimited_devices: formFields.unlimited_devices,
            unlimited_credits: formFields.unlimited_credits,
            expiresAt: expiryFields.expiresAt,
            expiry_starts_on_activation: expiryFields.expiry_starts_on_activation,
            support_notes: String(document.getElementById('so-license-support-notes')?.value || '').trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: soAuthEmail()
        }, customerFields, addonFlags, customPlanFields, soBuildLicenseCreditFields(plan, formFields, existingLic));
        payload.key = key;
        const previewOk = await soConfirmActionPreviewModal({
            title: 'Update license → Firebase',
            bodyHtml: soBuildLicenseSavePreviewHtml(payload, 'update', existingLic),
            confirmLabel: 'Update license in Firebase',
            dangerous: true
        });
        if (!previewOk) return;
        delete payload.key;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set(payload, { merge: true });
            cancelSoLicenseEdit();
            await soLoadLicenses();
            soRefreshLicenseUIs();
            renderSoCustomerRegistry();
            soCloseLicenseCreateAccordion({ scrollToKey: key });
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
        soLicenseListPage = 1;
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
        const filtered = soGetFilteredLicenses();
        const pageData = soPaginateSlice(filtered, soLicenseListPage, SO_LICENSE_LIST_PAGE_SIZE);
        soLicenseListPage = soRenderPaginationControls(
            'so-license-list-pagination',
            pageData.page,
            SO_LICENSE_LIST_PAGE_SIZE,
            pageData.total,
            (p) => { soLicenseListPage = p; renderSoLicensesList(); },
            (p) => { soLicenseListPage = p; renderSoLicensesList(); }
        );
        if (!pageData.items.length) {
            container.innerHTML = '<p class="so-admin-muted">No licenses found.</p>';
            return;
        }
        container.innerHTML = pageData.items.map(lic => {
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
            const createdLabel = soFormatLicenseCreated(lic);
            const expiryDetail = soFormatLicenseExpiryDetail(lic);
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
            return `<div class="so-license-row so-collapsible-row ${open ? 'so-collapsible-row--open' : ''}" data-license-key="${soAttr(lic.key)}">
                <div class="so-license-head" onclick="toggleSoLicenseRow('${soAttr(lic.key)}')" style="cursor:pointer;">
                    <code class="so-license-key-copy-inline" onclick="event.stopPropagation(); soCopyText('${soAttr(lic.key)}')" title="Click to copy">${soEsc(lic.key)}</code>
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
                        <strong>Created:</strong> ${soEsc(createdLabel)}
                        · <strong>Expires:</strong> ${soEsc(expiryDetail.label)}${expiryDetail.sub ? ` (${soEsc(expiryDetail.sub)})` : ''}
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
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="grantSoLicenseLifetime('${soAttr(lic.key)}')">Grant lifetime</button>
                        <button type="button" class="so-btn-sm so-btn-touch" onclick="clearSoLicenseExpiry('${soAttr(lic.key)}')">Clear expiry</button>
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
        soOnLicenseListSearchInput();
    };

    window.toggleSoLicenseActive = async function(key, currentlyActive) {
        if (!soRequireExtensionWrite()) return;
        if (currentlyActive) {
            if (!confirm(`Revoke license ${key}? Extension will reject this key.`)) return;
        }
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({ active: !currentlyActive }, { merge: true });
            await soLoadLicenses();
            soRefreshLicenseUIs();
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
            soRefreshLicenseUIs();
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
            soRefreshLicenseUIs();
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
            soRefreshLicenseUIs();
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
            soRefreshLicenseUIs();
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
        const modal = soEnsureModalPortal('so-add-credits-modal');
        if (modal) modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.soSelectAddCreditsPack = function(credits) {
        const el = document.getElementById('so-add-credits-amount');
        if (el) el.value = credits;
    };

    window.closeSoAddCreditsModal = function() {
        soAddCreditsLicenseKey = null;
        const modal = document.getElementById('so-add-credits-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
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
            soRefreshLicenseUIs();
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
        const modal = soEnsureModalPortal('so-license-overrides-modal');
        if (modal) modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.closeSoLicenseOverrides = function() {
        soOverridesLicenseKey = null;
        const modal = document.getElementById('so-license-overrides-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
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
            soRefreshLicenseUIs();
            soToast(`Overrides saved for ${key}.`);
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.deleteSoLicense = async function(key) {
        if (!soRequireExtensionWrite()) return;
        const lic = soLicenses.find(l => l.key === key);
        const cust = lic
            ? [lic.customer_name, lic.customer_phone, lic.customer_email].filter(Boolean).join(' · ')
            : '';
        if (!confirm(
            `Delete license ${key}?${cust ? `\n\nCustomer mapping:\n${cust}` : ''}\n\nThis permanently removes the license and customer link from Firebase.`
        )) return;
        const typed = prompt(`Type DELETE to permanently remove license ${key}:`);
        if (typed !== 'DELETE') return soToast('Delete cancelled.');
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).delete();
            await soLoadLicenses();
            soRefreshLicenseUIs();
            renderSoCustomerRegistry();
            soToast('License deleted.');
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.grantSoLicenseLifetime = async function(key) {
        if (!soRequireExtensionWrite()) return;
        if (!confirm(`Grant lifetime (never expires) for ${key}?`)) return;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({
                unlimited_time: true,
                expiresAt: ''
            }, { merge: true });
            await soLoadLicenses();
            soRefreshLicenseUIs();
            renderSoCustomerRegistry();
            soToast(`${key} is now lifetime / never expires.`);
        } catch (e) {
            soToast('Failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.clearSoLicenseExpiry = async function(key) {
        if (!soRequireExtensionWrite()) return;
        if (!confirm(`Clear expiry for ${key}? License stays open-ended until you set a date.`)) return;
        try {
            await soDb().collection(SO_LICENSE_COL).doc(key).set({
                expiresAt: '',
                expiry_starts_on_activation: false,
                unlimited_time: false
            }, { merge: true });
            await soLoadLicenses();
            soRefreshLicenseUIs();
            renderSoCustomerRegistry();
            soToast(`Expiry cleared for ${key}.`);
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
            soRefreshLicenseUIs();
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
            const hay = [lic.key, lic.customer_name, lic.customer_phone, lic.customer_email, lic.customer_location, lic.customer_ip, lic.planId, lic.planType]
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
            const hasCustomer = !!(lic.customer_name || lic.customer_phone || lic.customer_email);
            const name = hasCustomer && lic.customer_name
                ? soEsc(lic.customer_name)
                : (hasCustomer
                    ? soEsc(lic.customer_phone || lic.customer_email || 'Customer')
                    : '<span class="so-admin-muted">Unassigned customer</span>');
            const phone = lic.customer_phone ? soEsc(lic.customer_phone) : '—';
            const email = lic.customer_email ? soEsc(lic.customer_email) : '—';
            const location = lic.customer_location || lic.customerLocation || '';
            const ip = lic.customer_ip || lic.customerIp || '';
            const shared = soIsLicenseShared(lic);
            const activated = soIsLicenseActivated(lic);
            return `<div class="so-customer-row">
                <div class="so-customer-row-head">
                    <div>
                        <strong>${name}</strong>
                        <div class="so-admin-muted">${phone}${email !== '—' ? ` · ${email}` : ''}</div>
                        ${location || ip ? `<div class="so-admin-muted" style="font-size:10px;margin-top:2px;">${location ? soEsc(location) : ''}${location && ip ? ' · ' : ''}${ip ? `IP: ${soEsc(ip)}` : ''}</div>` : ''}
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
                    <button type="button" class="so-btn-sm so-btn-touch" onclick="switchShippingOptimizerTab('licenses'); editSoLicense('${soAttr(lic.key)}')">Open license</button>
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
        openShippingOptimizerPanel().then(() => switchShippingOptimizerTab('customers'));
    };

    window.soRefreshShippingOptimizerAdmin = function() {
        soLoaded = false;
        return loadShippingOptimizerAdmin(true);
    };

    window.loadShippingOptimizerAdmin = async function(forceReload) {
        if (!soRequireSuperAdmin()) return;
        if (soLoadInProgress) {
            if (soLoaded && !forceReload) return;
            return;
        }
        if (soLoaded && !forceReload) {
            soSyncDirtyFromSnapshots();
            return;
        }
        if (typeof soGetExtensionDb !== 'function' || !soGetExtensionDb()) {
            soToast('Extension Firebase (extension-e6e32) not ready.');
            return;
        }
        if (typeof soWarmExtensionFirebaseInBackground === 'function') {
            soWarmExtensionFirebaseInBackground();
        }
        if (typeof soEnsureExtensionFirebaseReady === 'function') {
            await soEnsureExtensionFirebaseReady();
        }
        soLoadInProgress = true;
        soLoadGeneration += 1;
        soSnapshotsReady = false;
        soAllowDirtyMark = false;
        soUserEditedSinceLoad = false;
        soClearAllDirty();
        clearTimeout(soDirtyCheckTimer);
        clearTimeout(soDraftSaveTimer);
        soUpdateUnsavedBanner();
        try {
            await Promise.all([
                soLoadConfig(),
                soLoadDemoKeys(),
                soLoadLicenses(),
                soLoadGoogleTrials(),
            ]);
            soHydrating = true;
            soPopulateLicensePlanSelect();
        soSetLicenseFormMode(null);
        soSetLicenseExpiryMode('activation');
        soInitLicenseCreateForm();
        soUpdateCustomCreditCalc();
            soRestoreSectionAccordions();
            renderSoDemoPendingKeysEditor();
            renderSoDemoKeysList();
            renderSoExtensionPreview();
            soRefreshLicenseUIs();
            renderSoGoogleTrialsRegistry();
            renderSoCustomerRegistry();
            soHydrating = false;
            soBindFieldInfoDismiss();
            soFinalizeAdminLoadState();
            soLoaded = true;
        } catch (e) {
            soToast('Load failed: ' + (e.message || 'Unknown error'));
        } finally {
            soLoadInProgress = false;
        }
    };

    window.addEventListener('beforeunload', (e) => {
        if (typeof soHasUnsavedChanges === 'function' && soHasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
})();
