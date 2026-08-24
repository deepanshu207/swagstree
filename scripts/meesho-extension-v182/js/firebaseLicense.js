// ============================================
// SHIPPING OPTIMIZER — Firebase license service
// Dedicated project: extension-e6e32.
// Reads/writes ONLY shipping_optimizer_* collections
// (shipping_optimizer_config, _demo_keys, _licenses).
// REST base URL is derived from CONFIG.FIREBASE.projectId.
// ============================================

const FirebaseLicense = {
  COLLECTION_PREFIX: "shipping_optimizer",

  _configCache: null,
  _configCacheTime: 0,
  _cacheTtlMs: 5 * 60 * 1000,

  get firebase() {
    return typeof CONFIG !== "undefined" ? CONFIG.FIREBASE : null;
  },

  isEnabled() {
    return (
      CONFIG?.USE_FIREBASE_LICENSE === true &&
      !!this.firebase?.projectId &&
      !!this.firebase?.apiKey
    );
  },

  collectionPath(name) {
    return `${this.COLLECTION_PREFIX}_${name}`;
  },

  documentsBaseUrl() {
    const projectId = this.firebase.projectId;
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  },

  docUrl(collection, docId) {
    return `${this.documentsBaseUrl()}/${this.collectionPath(collection)}/${encodeURIComponent(docId)}`;
  },

  collectionUrl(collection) {
    return `${this.documentsBaseUrl()}/${this.collectionPath(collection)}`;
  },

  parseFirestoreValue(field) {
    if (!field || typeof field !== "object") return null;
    if ("stringValue" in field) return field.stringValue;
    if ("integerValue" in field) return parseInt(field.integerValue, 10);
    if ("doubleValue" in field) return Number(field.doubleValue);
    if ("booleanValue" in field) return field.booleanValue;
    if ("timestampValue" in field) return field.timestampValue;
    if ("nullValue" in field) return null;
    if ("mapValue" in field) {
      const out = {};
      const inner = field.mapValue.fields || {};
      for (const [k, v] of Object.entries(inner)) {
        out[k] = this.parseFirestoreValue(v);
      }
      return out;
    }
    if ("arrayValue" in field) {
      return (field.arrayValue.values || []).map((v) =>
        this.parseFirestoreValue(v),
      );
    }
    return null;
  },

  toFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (value instanceof Date) {
      return { timestampValue: value.toISOString() };
    }
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return { timestampValue: value };
      }
      return { stringValue: value };
    }
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") {
      if (Number.isInteger(value)) return { integerValue: String(value) };
      return { doubleValue: value };
    }
    if (Array.isArray(value)) {
      return {
        arrayValue: { values: value.map((v) => this.toFirestoreValue(v)) },
      };
    }
    if (typeof value === "object") {
      const fields = {};
      for (const [k, v] of Object.entries(value)) {
        fields[k] = this.toFirestoreValue(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
  },

  parseDocument(doc) {
    if (!doc?.fields) return null;
    const out = {};
    for (const [k, v] of Object.entries(doc.fields)) {
      out[k] = this.parseFirestoreValue(v);
    }
    return out;
  },

  async fetchDoc(collection, docId) {
    if (!this.isEnabled()) return null;
    const url = `${this.docUrl(collection, docId)}?key=${encodeURIComponent(this.firebase.apiKey)}`;
    try {
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (res.status === 404) return null;
      if (!res.ok) {
        console.warn("Firebase read failed:", collection, docId, res.status);
        return null;
      }
      return this.parseDocument(await res.json());
    } catch (e) {
      console.warn("Firebase read error:", e.message);
      return null;
    }
  },

  async listDocs(collection) {
    if (!this.isEnabled()) return [];
    const url = `${this.collectionUrl(collection)}?key=${encodeURIComponent(this.firebase.apiKey)}&pageSize=200`;
    try {
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.documents || []).map((doc) => {
        const id = (doc.name || "").split("/").pop();
        return { id, ...this.parseDocument(doc) };
      });
    } catch (e) {
      console.warn("Firebase list error:", e.message);
      return [];
    }
  },

  async patchDoc(collection, docId, partial, updateFields) {
    if (!this.isEnabled()) return false;
    const fields = {};
    for (const [k, v] of Object.entries(partial)) {
      fields[k] = this.toFirestoreValue(v);
    }
    const mask = (updateFields || Object.keys(partial))
      .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
      .join("&");
    const url = `${this.docUrl(collection, docId)}?key=${encodeURIComponent(this.firebase.apiKey)}&${mask}`;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      return res.ok;
    } catch (e) {
      console.warn("Firebase patch error:", e.message);
      return false;
    }
  },

  async fetchDocAuth(collection, docId, idToken) {
    if (!this.isEnabled() || !idToken) return null;
    const url = `${this.docUrl(collection, docId)}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Cache-Control": "no-cache",
        },
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        console.warn("Firebase auth read failed:", collection, docId, res.status);
        return null;
      }
      return this.parseDocument(await res.json());
    } catch (e) {
      console.warn("Firebase auth read error:", e.message);
      return null;
    }
  },

  async createDocAuth(collection, docId, data, idToken) {
    if (!this.isEnabled() || !idToken) return { ok: false, status: 0 };
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      fields[k] = this.toFirestoreValue(v);
    }
    const url = `${this.collectionUrl(collection)}?documentId=${encodeURIComponent(docId)}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fields }),
      });
      if (res.ok) {
        return { ok: true, status: res.status, doc: this.parseDocument(await res.json()) };
      }
      const err = await res.json().catch(() => ({}));
      return { ok: false, status: res.status, error: err };
    } catch (e) {
      return { ok: false, status: 0, error: { message: e.message } };
    }
  },

  async patchDocAuth(collection, docId, partial, updateFields, idToken) {
    if (!this.isEnabled() || !idToken) return { ok: false, status: 0 };
    const fields = {};
    for (const [k, v] of Object.entries(partial)) {
      fields[k] = this.toFirestoreValue(v);
    }
    const mask = (updateFields || Object.keys(partial))
      .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
      .join("&");
    const url = `${this.docUrl(collection, docId)}?${mask}`;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fields }),
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, status: 0, error: e.message };
    }
  },

  defaultPlans() {
    return this.sortPlans(
      Object.entries(this.richPlanTemplates()).map(([id, tpl], i) =>
        this.normalizePlanEntry({ id, ...tpl }, id, i),
      ),
    );
  },

  /** Rich metadata templates — Firebase price/name/save override; missing fields are filled in enrichPlan(). */
  richPlanTemplates() {
    return {
      monthly: {
        name: "Monthly",
        price: 199,
        days: 30,
        duration: "1 Month",
        included_credits: 200,
        allow_credit_addons: true,
        offer_badges: ["Starter"],
        card_subtitle: "30 days · 200 credits",
        card_hint: "Tap for plan details · Add-ons inside ℹ️",
        description:
          "Try Smart Mode with live Meesho shipping checks — ideal for new sellers testing AI variant previews.",
        detail_subtitle: "30 days · 200 credits",
        detail_footer:
          "Credits deduct per generation run. Buy credit packs anytime from the popup while your plan is active.",
        highlights: ["200 credits included", "30 days access", "Smart Mode on Meesho"],
        features: [
          { icon: "📅", title: "30 days access", text: "Renews every month" },
          { icon: "⚡", title: "200 credits", text: "One credit = one AI generation run" },
          { icon: "🚚", title: "Smart Mode", text: "Preview up to 200 variants per run" },
        ],
        detail_sections: [
          {
            title: "What's included",
            items: [
              "Smart Mode on Meesho catalog",
              "Apply lowest-shipping variant to listing",
              "Top up anytime with credit packs while your plan is active",
            ],
          },
          {
            title: "Already on Monthly?",
            body: "Existing monthly customers can buy credit packs (⚡ BUY CREDITS) in the extension popup without changing plan.",
            items: [
              "Credit packs stack on your license",
              "Optional credit add-ons appear above — tap to select before WhatsApp",
            ],
          },
        ],
        active: true,
        order: 0,
      },
      quarterly: {
        name: "3 Months",
        price: 549,
        days: 90,
        duration: "3 Months",
        save: "Save ₹48 (8% off)",
        included_credits: 600,
        allow_credit_addons: true,
        offer_badges: ["Popular", "8% off"],
        card_subtitle: "90 days · 600 credits",
        card_hint: "Tap for plan details · Add-ons inside ℹ️",
        description:
          "Three months of Smart Mode — 600 credits with a lower price than paying monthly three times.",
        detail_subtitle: "90 days · 600 credits",
        detail_footer:
          "Full 600-credit pack. Price discount applies to rupees only — credits stay at 200/month × 3.",
        highlights: ["600 credits", "90 days access", "Lower price vs monthly"],
        features: [
          { icon: "📅", title: "90 days access", text: "One payment, three months" },
          { icon: "⚡", title: "600 credits", text: "200 credits per month equivalent" },
          { icon: "💰", title: "8% off price", text: "vs paying monthly three times" },
        ],
        detail_sections: [
          {
            title: "Plan summary",
            body: "₹549 for 90 days · 600 credits included.",
            items: ["Unused credits stay until used", "Credit packs available anytime"],
          },
          {
            title: "Why 3 months?",
            body: "Lower ₹/month than paying monthly three times — same 200 credits/month volume.",
            items: ["Optional credit add-ons at checkout", "Smart Mode on all Meesho listings"],
          },
        ],
        active: true,
        order: 1,
      },
      halfyearly: {
        name: "6 Months",
        price: 1045,
        days: 180,
        duration: "6 Months",
        save: "Save ₹149 (12.5% off)",
        included_credits: 1200,
        allow_credit_addons: true,
        max_addon_selections: 1,
        offer_badges: ["12.5% off"],
        card_subtitle: "180 days · 1,200 credits",
        card_hint: "Tap for plan details · Add-ons inside ℹ️",
        description:
          "Half-year access for serious Meesho sellers — 1,200 credits with 12.5% price discount.",
        detail_subtitle: "180 days · 1,200 credits",
        detail_footer:
          "Price discount applies to rupees only — credits stay at 200/month × 6.",
        highlights: ["1,200 credits", "180 days access", "12.5% off price"],
        features: [
          { icon: "📅", title: "180 days access", text: "Six months in one payment" },
          { icon: "⚡", title: "1,200 credits", text: "200 credits per month equivalent" },
          { icon: "📈", title: "Volume pricing", text: "Lower cost than quarterly" },
        ],
        detail_sections: [
          {
            title: "Plan summary",
            body: "₹1,045 for 180 days · 1,200 credits included.",
            items: ["Smart Mode up to 200 variants per run", "Credit top-ups available"],
          },
          {
            title: "Add-ons",
            body: "This plan allows one optional credit add-on at checkout.",
            items: ["Pick add-ons in plan details before WhatsApp", "Stacks on included credits"],
          },
        ],
        active: true,
        order: 2,
      },
      yearly: {
        name: "Yearly",
        price: 1980,
        days: 365,
        duration: "1 Year",
        save: "Save ₹408 (17% off)",
        best: true,
        included_credits: 2400,
        allow_credit_addons: true,
        max_addon_selections: 2,
        offer_badges: ["Best deal", "17% off"],
        card_subtitle: "1 year · 2,400 credits",
        card_hint: "Tap for plan details · Add-ons inside ℹ️",
        description:
          "Best for full-time Meesho sellers — one year access with 2,400 credits.",
        detail_subtitle: "1 year · 2,400 credits",
        detail_footer:
          "Optional add-ons are selected in this plan detail before WhatsApp checkout.",
        highlights: ["2,400 credits", "1 year access", "BEST VALUE"],
        features: [
          { icon: "📅", title: "1 year access", text: "Single annual payment" },
          { icon: "⚡", title: "2,400 credits", text: "200 credits per month equivalent" },
          { icon: "🚚", title: "Smart Mode", text: "Use credits across the full year" },
        ],
        detail_sections: [
          {
            title: "What's included",
            items: [
              "Live Meesho shipping on all variants",
              "Apply best image to catalog",
              "Credit packs anytime",
            ],
          },
          {
            title: "Plan summary",
            body: "₹1,980 for 1 year · 2,400 credits included.",
            items: ["Best long-term value for full-time sellers"],
          },
          {
            title: "Add-ons",
            body: "Yearly plan allows up to two optional credit add-ons at checkout.",
            items: ["Select add-ons below before WhatsApp", "Same add-on catalog as other plans"],
          },
        ],
        active: true,
        order: 3,
      },
    };
  },

  resolvePlanTemplateId(plan) {
    const id = this.slugifyPlanId(plan?.id);
    if (this.richPlanTemplates()[id]) return id;
    const days = Number(plan?.days) || 0;
    if (days === 30) return "monthly";
    if (days === 90) return "quarterly";
    if (days === 180) return "halfyearly";
    if (days === 365 || days === 360) return "yearly";
    const name = String(plan?.name || "").toLowerCase();
    if (name.includes("month") && !name.includes("3") && !name.includes("6")) {
      return "monthly";
    }
    if (name.includes("3 month") || name.includes("quarter")) return "quarterly";
    if (name.includes("6 month") || name.includes("half")) return "halfyearly";
    if (name.includes("year") || name.includes("annual")) return "yearly";
    return id;
  },

  enrichPlan(plan) {
    if (!plan || typeof plan !== "object") return plan;
    const tplId = this.resolvePlanTemplateId(plan);
    const tpl = this.richPlanTemplates()[tplId] || {};
    const out = Object.assign({}, tpl, plan, { id: plan.id || tplId });
    const fillStr = (key) => {
      const v = plan[key];
      const t = tpl[key];
      if ((v == null || v === "") && t != null && t !== "") out[key] = t;
    };
    const fillArr = (key) => {
      const v = plan[key];
      const t = tpl[key];
      if ((!Array.isArray(v) || !v.length) && Array.isArray(t) && t.length) {
        out[key] = t.slice();
      }
    };
    [
      "description",
      "detail_subtitle",
      "detail_footer",
      "card_hint",
      "card_subtitle",
      "save",
      "duration",
      "name",
    ].forEach(fillStr);
    ["features", "highlights", "detail_sections", "offer_badges"].forEach(fillArr);
    if (out.allow_plan_addons == null && out.allow_credit_addons != null) {
      out.allow_plan_addons = out.allow_credit_addons;
    }
    if (out.allow_custom_plan == null) out.allow_custom_plan = true;
    if (tpl.allow_credit_addons) {
      out.allow_credit_addons = true;
      if (out.allow_plan_addons == null) out.allow_plan_addons = true;
    } else if (
      plan.allow_credit_addons === false ||
      plan.allowCreditAddons === false
    ) {
      out.allow_credit_addons = false;
    } else if (
      plan.allow_credit_addons === true ||
      plan.allowCreditAddons === true
    ) {
      out.allow_credit_addons = true;
    }
    if (out.allow_credit_addons !== false && !out.unlimited_credits) {
      const fullEntries = (out.credit_addons || []).filter(
        (a) => a && a.active !== false && !a._ref,
      );
      const refEntries = (out.credit_addons || []).filter((a) => a && a._ref);
      if (!fullEntries.length && !refEntries.length) {
        out.credit_addons = this.defaultAddonCatalog().map((a, i) =>
          this.normalizeCreditAddon(a, a.id, i),
        );
      }
    }
    const days = Number(out.days) || 0;
    if (!out.included_credits && days > 0) {
      out.included_credits = Math.max(1, Math.round((days / 30) * 200));
    }
    if (!out.card_subtitle) out.card_subtitle = this.formatPlanCardSubtitle(out);
    if (!out.detail_subtitle) out.detail_subtitle = out.card_subtitle;
    if (!out.highlights?.length && out.included_credits > 0) {
      out.highlights = [
        `${Number(out.included_credits).toLocaleString("en-IN")} credits`,
        this.formatPlanDurationLabel(out),
        out.best ? "BEST VALUE" : "Smart Mode on Meesho",
      ].filter(Boolean);
    }
    return out;
  },

  planDetailFeaturesFallback(plan) {
    const credits = Number(plan?.included_credits ?? 0) || 0;
    const duration = this.formatPlanDurationLabel(plan);
    const feats = [];
    if (duration) {
      feats.push({
        icon: "📅",
        title: `${duration} access`,
        text: plan.days === 30 ? "Renews every month" : "One payment for full term",
      });
    }
    if (credits > 0) {
      feats.push({
        icon: "⚡",
        title: `${credits.toLocaleString("en-IN")} credits`,
        text: "One credit = one AI generation run",
      });
    }
    feats.push({
      icon: "🚚",
      title: "Smart Mode",
      text: "Live Meesho shipping checks on variants",
    });
    return feats;
  },

  planOfferBadgesSlotHtml(planOrAddon, basePricePerCredit) {
    const explicit = this.parseOfferBadges(
      planOrAddon?.offer_badges ?? planOrAddon?.offerBadges,
    );
    const badges = explicit.length
      ? explicit
      : planOrAddon?.credits != null
        ? (() => {
            const computed = this.formatAddonValueBadge(
              planOrAddon,
              basePricePerCredit,
            );
            return computed && computed !== "Add-on" ? [computed] : [];
          })()
        : [];
    const inner = badges.length
      ? badges
          .map((b) => `<span class="plan-offer-badge">${this.escapeHtml(b)}</span>`)
          .join("")
      : '<span class="plan-offer-badge plan-offer-badge--spacer" aria-hidden="true">&nbsp;</span>';
    return `<div class="plan-offer-badges">${inner}</div>`;
  },

  planSaveSlotHtml(saveLabel, muted) {
    const text = saveLabel ? this.escapeHtml(saveLabel) : "&nbsp;";
    const spacer = saveLabel ? "" : " plan-note--spacer";
    const color = muted ? "var(--mso-muted)" : "var(--mso-success)";
    const weight = muted ? "400" : "700";
    return `<div class="plan-note plan-save-slot${spacer}" style="color:${color};font-weight:${weight};">${text}</div>`;
  },

  slugifyPlanId(id) {
    return String(id || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "");
  },

  isUnlimitedFlag(val) {
    return val === true || val === "true" || val === 1 || val === "1";
  },

  normalizePlanEntry(p, idFallback, index) {
    const id = this.slugifyPlanId(p?.id || idFallback || `plan_${index}`);
    const rawMax = p?.max_devices ?? p?.maxDevices;
    const unlimitedDevices = this.isUnlimitedFlag(
      p?.unlimited_devices ?? p?.unlimitedDevices,
    ) || rawMax === 0 || rawMax === "0";
    const maxDevices = unlimitedDevices
      ? 0
      : Math.max(1, Number(rawMax) || 1);
    const rawDays = p?.days;
    const unlimitedTime =
      this.isUnlimitedFlag(p?.unlimited_time ?? p?.unlimitedTime) ||
      rawDays === 0 ||
      rawDays === "0";
    const planKind = String(
      p?.plan_kind || p?.planKind || p?.type || "subscription",
    ).toLowerCase();
    const normalized = {
      id: id || `plan_${index}`,
      name: p?.name || p?.title || "Plan",
      price: Number(p?.price) || 0,
      days: unlimitedTime ? 0 : Number(rawDays) || 30,
      duration:
        p?.duration ||
        (unlimitedTime ? "Unlimited" : p?.name || "Plan"),
      save: p?.save || p?.saveLabel || "",
      description: p?.description || p?.note || "",
      best: !!p?.best,
      active: p?.active !== false,
      order: p?.order != null ? Number(p.order) : index,
      max_devices: maxDevices,
      unlimited_devices: unlimitedDevices,
      unlimited_time: unlimitedTime || planKind === "lifetime" || planKind === "unlimited",
      unlimited_credits: this.isUnlimitedFlag(
        p?.unlimited_credits ?? p?.unlimitedCredits,
      ),
      device_tier:
        p?.device_tier ||
        p?.deviceTier ||
        (unlimitedDevices
          ? "unlimited"
          : maxDevices <= 1
            ? "standard"
            : maxDevices <= 3
              ? "family"
              : "friends"),
      billing_mode: p?.billing_mode || p?.billingMode || "subscription",
      plan_kind: planKind,
      included_credits:
        Number(p?.included_credits ?? p?.includedCredits ?? 0) || 0,
      hide: p?.hide === true,
      disabled: p?.disabled === true,
      allow_credit_addons:
        p?.allow_credit_addons != null || p?.allowCreditAddons != null
          ? !!(p?.allow_credit_addons ?? p?.allowCreditAddons)
          : undefined,
      allow_plan_addons:
        p?.allow_plan_addons != null || p?.allowPlanAddons != null
          ? !!(p?.allow_plan_addons ?? p?.allowPlanAddons)
          : undefined,
      hide_plan_addons_in_detail:
        p?.hide_plan_addons_in_detail === true ||
        p?.hidePlanAddonsInDetail === true,
      disable_plan_addons:
        p?.disable_plan_addons === true || p?.disablePlanAddons === true,
      allow_custom_plan:
        p?.allow_custom_plan != null || p?.allowCustomPlan != null
          ? !!(p?.allow_custom_plan ?? p?.allowCustomPlan)
          : undefined,
      hide_custom_plan:
        p?.hide_custom_plan === true || p?.hideCustomPlan === true,
      disable_custom_plan:
        p?.disable_custom_plan === true || p?.disableCustomPlan === true,
      custom_plan_enabled:
        p?.custom_plan_enabled !== false && p?.customPlanEnabled !== false,
      max_addon_selections:
        Number(p?.max_addon_selections ?? p?.maxAddonSelections ?? 0) || 0,
      credit_addons: this.parsePlanCreditAddonRefs(
        p?.credit_addons ?? p?.creditAddons,
      ),
      features: this.parsePlanFeatures(p?.features ?? p?.plan_features),
      detail_sections: this.parsePlanDetailSections(
        p?.detail_sections ?? p?.detailSections,
      ),
      highlights: this.parsePlanHighlights(p?.highlights),
      offer_badges: this.parseOfferBadges(p?.offer_badges ?? p?.offerBadges),
      card_hint: p?.card_hint || p?.cardHint || "",
      card_subtitle: p?.card_subtitle || p?.cardSubtitle || "",
      cta_text: p?.cta_text || p?.ctaText || "Buy via WhatsApp",
      detail_subtitle: p?.detail_subtitle || p?.detailSubtitle || "",
      detail_footer: p?.detail_footer || p?.detailFooter || "",
      show_whatsapp_icon:
        p?.show_whatsapp_icon !== false && p?.showWhatsappIcon !== false,
      show_details_icon:
        p?.show_details_icon !== false && p?.showDetailsIcon !== false,
      card_icon: p?.card_icon || p?.cardIcon || "",
    };
    return this.enrichPlan(normalized);
  },

  normalizePlanFeature(item, index) {
    if (typeof item === "string") {
      return { icon: "✓", title: item, text: "" };
    }
    if (!item || typeof item !== "object") return null;
    const title = item.title || item.label || item.name || item.text || "";
    if (!title) return null;
    return {
      icon: item.icon || item.emoji || "✓",
      title,
      text: item.text || item.description || item.detail || "",
    };
  },

  parsePlanFeatures(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((f, i) => this.normalizePlanFeature(f, i))
      .filter(Boolean);
  },

  parsePlanDetailSections(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s, i) => {
        if (!s || typeof s !== "object") return null;
        const title = s.title || s.heading || s.label || "";
        const body = s.body || s.text || s.content || "";
        const items = Array.isArray(s.items)
          ? s.items.map((x) => String(x)).filter(Boolean)
          : [];
        if (!title && !body && !items.length) return null;
        return {
          title: title || `Details ${i + 1}`,
          body,
          items,
        };
      })
      .filter(Boolean);
  },

  parsePlanHighlights(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((h) => String(h)).filter(Boolean);
  },

  parseOfferBadges(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((b) => String(b || "").trim()).filter(Boolean);
  },

  planOfferBadgesHtml(plan) {
    const badges = this.parseOfferBadges(plan?.offer_badges ?? plan?.offerBadges);
    if (!badges.length) return "";
    return `<div class="plan-offer-badges">${badges
      .map(
        (b) =>
          `<span class="plan-offer-badge">${this.escapeHtml(b)}</span>`,
      )
      .join("")}</div>`;
  },

  normalizeSupportUser(u, idFallback, index) {
    if (!u || typeof u !== "object") return null;
    const id = this.slugifyPlanId(u.id || idFallback || `user_${index}`);
    const number =
      u.whatsapp_number ||
      u.whatsappNumber ||
      u.phone ||
      u.mobile ||
      "";
    if (!number && !u.name) return null;
    return {
      id: id || `user_${index}`,
      name: u.name || u.title || "Support",
      role: u.role || u.department || "",
      label: u.label || u.topic || u.description || "",
      whatsapp_number: this.normalizeWhatsAppNumber(number),
      whatsapp_message: u.whatsapp_message || u.whatsappMessage || "",
      active: u.active !== false,
      order: u.order != null ? Number(u.order) : index,
    };
  },

  normalizeWhatsAppNumber(number) {
    let digits = String(number || "").replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    return digits;
  },

  parseSupportConfig(app) {
    const raw =
      app?.support ||
      app?.support_users ||
      app?.supportUsers ||
      {};
    const usersRaw =
      raw.users ||
      raw.contacts ||
      raw.list ||
      (Array.isArray(raw) ? raw : null);
    let users = [];
    if (Array.isArray(usersRaw)) {
      users = usersRaw
        .map((u, i) => this.normalizeSupportUser(u, u?.id || `user_${i}`, i))
        .filter(Boolean);
    } else if (usersRaw && typeof usersRaw === "object") {
      users = Object.entries(usersRaw)
        .map(([id, u]) => this.normalizeSupportUser({ ...u, id }, id, 0))
        .filter(Boolean);
    }
    users = this.sortPlans(users);
    return {
      enabled: raw.enabled !== false,
      title: raw.title || "Support team",
      page_size: Math.max(1, Number(raw.page_size ?? raw.pageSize ?? 5) || 5),
      users,
    };
  },

  async getSupportConfig(forceFresh = false) {
    const app = await this.getAppConfig(forceFresh);
    return this.parseSupportConfig(app || {});
  },

  getSupportUsersPage(config, page) {
    const users = (config?.users || []).filter((u) => u.active !== false);
    const pageSize = Math.max(1, Number(config?.page_size) || 5);
    const totalPages = Math.max(1, Math.ceil(users.length / pageSize) || 1);
    const p = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (p - 1) * pageSize;
    return {
      users: users.slice(start, start + pageSize),
      page: p,
      totalPages,
      total: users.length,
      pageSize,
      hasPrev: p > 1,
      hasNext: p < totalPages,
    };
  },

  buildDefaultPlanFeatures(plan) {
    const out = [];
    const duration = this.formatPlanDurationLabel(plan);
    const credits = this.formatPlanCreditsLabel(plan);
    if (plan.unlimited_time || plan.days === 0) {
      out.push({ icon: "♾️", title: "Never expires", text: "Lifetime access" });
    } else if (duration) {
      out.push({ icon: "📅", title: duration, text: "" });
    }
    if (credits) {
      out.push({ icon: "⚡", title: credits, text: "" });
    }
    if (plan.unlimited_credits) {
      out.push({ icon: "∞", title: "Unlimited credits", text: "" });
    }
    const mode = plan.billing_mode || "subscription";
    if (mode === "hybrid") {
      out.push({
        icon: "💳",
        title: "Plan + credits",
        text: "Time-based access with credit balance",
      });
    } else if (mode === "credits") {
      out.push({
        icon: "💳",
        title: "Credits only",
        text: "Pay as you go",
      });
    }
    return out;
  },

  renderPlanDetailHtml(plan, options = {}) {
    if (!plan) {
      return '<p style="font-size:12px;color:#6b7280;">Plan not found.</p>';
    }
    plan = this.enrichPlan(plan);
    const duration = this.formatPlanDurationLabel(plan);
    const credits = this.formatPlanCreditsLabel(plan);
    const features =
      (plan.features || []).length > 0
        ? plan.features
        : this.planDetailFeaturesFallback(plan);
    const highlights = (plan.highlights || []).filter(
      (h) => h !== duration && h !== credits,
    );
    const sections = plan.detail_sections || [];
    const bestTag = plan.best
      ? '<span class="plan-detail-badge">BEST VALUE</span>'
      : "";
    const offerBadges = this.planOfferBadgesSlotHtml(plan);
    const save = plan.save
      ? `<div class="plan-detail-save">${this.escapeHtml(this.formatPlanSaveLabel(plan))}</div>`
      : "";
    const cta = plan.cta_text || "Buy via WhatsApp";
    const metaParts = [duration, credits].filter(Boolean);
    const subtitle =
      plan.detail_subtitle ||
      plan.card_subtitle ||
      this.formatPlanCardSubtitle(plan);

    let html = `<div class="plan-detail-card">
      <div class="plan-detail-header">
      ${bestTag}
      ${offerBadges}
      <h2 class="plan-detail-name">${this.escapeHtml(plan.name)}</h2>
      ${subtitle ? `<p class="plan-detail-subtitle">${this.escapeHtml(subtitle)}</p>` : ""}
      <div class="plan-detail-price">₹${plan.price}</div>
      ${save}
      ${metaParts.length ? `<p class="plan-detail-meta">${this.escapeHtml(metaParts.join(" · "))}</p>` : ""}
    </div>`;

    if (plan.description) {
      html += `<p class="plan-detail-desc">${this.escapeHtml(plan.description)}</p>`;
    }

    if (highlights.length) {
      html += `<div class="plan-detail-highlights">${highlights
        .map(
          (h) =>
            `<span class="plan-detail-pill">${this.escapeHtml(h)}</span>`,
        )
        .join("")}</div>`;
    }

    if (features.length) {
      html += `<div class="plan-detail-features">${features
        .map(
          (f) => `<div class="plan-detail-feature">
          <span class="plan-detail-feature-icon">${this.escapeHtml(f.icon || "✓")}</span>
          <div>
            <div class="plan-detail-feature-title">${this.escapeHtml(f.title)}</div>
            ${f.text ? `<div class="plan-detail-feature-text">${this.escapeHtml(f.text)}</div>` : ""}
          </div>
        </div>`,
        )
        .join("")}</div>`;
    }

    const creditsConfig = options.creditsConfig || null;
    const allPlans = options.allPlans || null;
    const licenseContext = options.licenseContext || options.license || null;
    const resolvedCatalog =
      options.addonCatalog ??
      (creditsConfig
        ? creditsConfig.addon_catalog ||
          this.resolveFullAddonCatalog(creditsConfig, allPlans)
        : undefined);
    const addons = creditsConfig
      ? this.getPlanDetailCreditAddons(plan, creditsConfig, allPlans, licenseContext)
      : !plan.unlimited_credits
        ? this.getPlanCreditAddonsLegacy(plan, resolvedCatalog)
        : [];
    const basePpc = Number(options.pricePerCredit) || 2;
    const addonsInteractive = !this.planAddonsDisabled(plan, licenseContext);
    if (addons.length) {
      const maxSel = Number(plan.max_addon_selections) || 0;
      const limitNote = addonsInteractive
        ? (maxSel === 1
            ? "Pick one add-on (optional)."
            : maxSel > 1
              ? `Pick up to ${maxSel} add-ons (optional).`
              : "Pick any add-ons (optional).")
        : "Add-ons are visible but disabled for this plan/license.";
      html += `<div class="plan-detail-section plan-detail-section--addons">
        <div class="plan-detail-section-title">⚡ OPTIONAL CREDIT ADD-ONS</div>
        <p class="plan-detail-section-body">${this.escapeHtml(limitNote)} Tap cards to select, then buy via WhatsApp below.</p>
        <div class="plan-grid plan-detail-addon-cards" style="grid-template-columns:${this.planGridColumns(addons.length)};">`;
      addons.forEach((a) => {
        html += this.renderAddonCreditCard(a, plan, {
          enabled: addonsInteractive,
          selected: addonsInteractive ? !!a.default_selected : false,
          pricePerCredit: basePpc,
        });
      });
      html += `</div></div>`;
    }

    const planCreditPacks = creditsConfig
      ? this.getPlanDetailCreditPacks(plan, creditsConfig)
      : [];
    if (planCreditPacks.length) {
      html += `<div class="plan-detail-section plan-detail-section--packs">
        <div class="plan-detail-section-title">⚡ CREDIT PACKS FOR THIS PLAN</div>
        <p class="plan-detail-section-body">Top-up bundles mapped to <strong>${this.escapeHtml(plan.name || plan.id)}</strong>. Tap a pack for details or buy via WhatsApp.</p>
        <div class="plan-grid plan-detail-pack-cards" style="grid-template-columns:${this.planGridColumns(planCreditPacks.length)};">`;
      planCreditPacks.forEach((p) => {
        html += this.renderCreditPackCardHtml(p, "plan_detail");
      });
      html += `</div></div>`;
    }

    const customBlocks = this.resolveCustomPlanBlocks(
      plan,
      creditsConfig,
      licenseContext,
    );
    if (customBlocks.length) {
      html += this.renderCustomPlanSectionHtml(plan, customBlocks, licenseContext);
    }

    sections.forEach((sec) => {
      html += `<div class="plan-detail-section">
        <div class="plan-detail-section-title">${this.escapeHtml(sec.title)}</div>`;
      if (sec.body) {
        html += `<p class="plan-detail-section-body">${this.escapeHtml(sec.body)}</p>`;
      }
      if (sec.items?.length) {
        html += `<ul class="plan-detail-list">${sec.items
          .map((item) => `<li>${this.escapeHtml(item)}</li>`)
          .join("")}</ul>`;
      }
      html += `</div>`;
    });

    const durationLabel = this.formatPlanDurationLabel(plan);
    html += this.planDetailWhatsAppBtnHtml(
      cta,
      this.planDataAttrs(plan, durationLabel),
    );
    if (plan.detail_footer) {
      html += `<p class="plan-detail-footer">${this.escapeHtml(plan.detail_footer)}</p>`;
    }
    html += `</div>`;

    return html;
  },

  renderCreditPackDetailHtml(pack, options = {}) {
    if (!pack) {
      return '<p style="font-size:12px;color:#6b7280;">Credit pack not found.</p>';
    }
    const label = pack.label || `${pack.credits} Credits`;
    const features = pack.features || [];
    const highlights = pack.highlights || [];
    const sections = pack.detail_sections || [];
    const cta = pack.cta_text || "Buy via WhatsApp";
    const perCredit =
      pack.credits > 0
        ? (Number(pack.price) / Number(pack.credits)).toFixed(1)
        : "0";

    let html = `<div class="plan-detail-card">
      <div class="plan-detail-header">
        <span class="plan-detail-badge" style="background:linear-gradient(135deg,#ffd700,#e67e22);">CREDIT PACK</span>
        <h2 class="plan-detail-name">${this.escapeHtml(label)}</h2>
        ${pack.detail_subtitle ? `<p class="plan-detail-subtitle">${this.escapeHtml(pack.detail_subtitle)}</p>` : ""}
        <div class="plan-detail-price">₹${pack.price}</div>
        <p class="plan-detail-meta">${pack.credits} credits · ~₹${perCredit}/credit</p>
      </div>`;

    if (pack.description) {
      html += `<p class="plan-detail-desc">${this.escapeHtml(pack.description)}</p>`;
    }

    if (highlights.length) {
      html += `<div class="plan-detail-highlights">${highlights
        .map(
          (h) =>
            `<span class="plan-detail-pill">${this.escapeHtml(h)}</span>`,
        )
        .join("")}</div>`;
    }

    if (features.length) {
      html += `<div class="plan-detail-features">${features
        .map(
          (f) => `<div class="plan-detail-feature">
          <span class="plan-detail-feature-icon">${this.escapeHtml(f.icon || "✓")}</span>
          <div>
            <div class="plan-detail-feature-title">${this.escapeHtml(f.title)}</div>
            ${f.text ? `<div class="plan-detail-feature-text">${this.escapeHtml(f.text)}</div>` : ""}
          </div>
        </div>`,
        )
        .join("")}</div>`;
    }

    sections.forEach((sec) => {
      html += `<div class="plan-detail-section">
        <div class="plan-detail-section-title">${this.escapeHtml(sec.title)}</div>`;
      if (sec.body) {
        html += `<p class="plan-detail-section-body">${this.escapeHtml(sec.body)}</p>`;
      }
      if (sec.items?.length) {
        html += `<ul class="plan-detail-list">${sec.items
          .map((item) => `<li>${this.escapeHtml(item)}</li>`)
          .join("")}</ul>`;
      }
      html += `</div>`;
    });

    html += this.planDetailWhatsAppBtnHtml(
      cta,
      `data-pack="${this.escapeAttr(pack.id)}"`,
      "credit-pack-detail-buy-btn",
    );
    if (pack.detail_footer) {
      html += `<p class="plan-detail-footer">${this.escapeHtml(pack.detail_footer)}</p>`;
    }
    html += `</div>`;
    return html;
  },

  async getCreditPackById(packId) {
    const packs = await this.getCreditPacks(true);
    const id = this.slugifyPlanId(packId);
    return packs.find((p) => p.id === id || p.id === packId) || null;
  },

  buildCreditPackPurchaseMessage(packOrId, productName) {
    const pack =
      typeof packOrId === "object" && packOrId
        ? packOrId
        : { id: packOrId, label: String(packOrId || "Credits") };
    const label = pack.label || `${pack.credits || ""} Credits`;
    return `Hi! I want to buy credits for ${productName || "Shipping Optimizer"}.

⚡ *Credit Pack:* ${label}
💰 *Price:* ₹${pack.price ?? "—"}
🎫 *Credits:* ${pack.credits ?? "—"}

Please share payment details.`;
  },

  renderSupportUsersHtml(pageData, options = {}) {
    const { users, page, totalPages, total, hasPrev, hasNext } =
      pageData || {};
    const title = options.title || "Support team";
    if (!users?.length) {
      return `<p style="font-size:12px;color:#6b7280;text-align:center;padding:16px 0;">No support contacts configured.</p>`;
    }
    const rows = users
      .map((u) => {
        const role = u.role
          ? `<div class="support-user-role">${this.escapeHtml(u.role)}</div>`
          : "";
        const label = u.label
          ? `<div class="support-user-label">${this.escapeHtml(u.label)}</div>`
          : "";
        return `<button type="button" class="support-user-row" data-support-id="${this.escapeAttr(u.id)}" data-support-number="${this.escapeAttr(u.whatsapp_number)}" data-support-message="${this.escapeAttr(u.whatsapp_message || options.defaultMessage || "")}">
          <div class="support-user-avatar">💬</div>
          <div class="support-user-info">
            <div class="support-user-name">${this.escapeHtml(u.name)}</div>
            ${role}
            ${label}
          </div>
          <span class="support-user-chevron">›</span>
        </button>`;
      })
      .join("");

    const pager =
      totalPages > 1
        ? `<div class="support-pager">
          <button type="button" class="support-page-btn" data-support-page="${page - 1}" ${hasPrev ? "" : "disabled"}>← Prev</button>
          <span class="support-page-label">Page ${page} / ${totalPages} · ${total} contacts</span>
          <button type="button" class="support-page-btn" data-support-page="${page + 1}" ${hasNext ? "" : "disabled"}>Next →</button>
        </div>`
        : `<div class="support-page-label" style="text-align:center;margin-top:8px;">${total} contact${total === 1 ? "" : "s"}</div>`;

    return `<div class="support-users-wrap">
      <p class="support-users-intro">${this.escapeHtml(title)} — tap to chat on WhatsApp</p>
      <div class="support-users-list">${rows}</div>
      ${pager}
    </div>`;
  },

  normalizeCreditAddon(a, idFallback, index) {
    const id = this.slugifyPlanId(a?.id || idFallback || `addon_${index}`);
    const credits = Number(a?.credits ?? a?.credit ?? 0) || 0;
    const price = Number(a?.price) || 0;
    const cardSubtitle =
      a?.card_subtitle ||
      a?.cardSubtitle ||
      (credits > 0 ? `${credits} credits · ₹${price}` : "");
    const scopeRaw = String(a?.scope || "global").trim().toLowerCase();
    const scope = scopeRaw === "plan" || scopeRaw === "plan_detail" ? "plan" : "global";
    let visibleIn = a?.visible_in ?? a?.visibleIn ?? null;
    if (typeof visibleIn === "string") {
      visibleIn = visibleIn.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    }
    const planIdsRaw = a?.plan_ids ?? a?.planIds ?? [];
    const plan_ids = (Array.isArray(planIdsRaw) ? planIdsRaw : [planIdsRaw])
      .filter(Boolean)
      .map((x) => this.slugifyPlanId(x));
    return {
      id: id || `addon_${index}`,
      credits,
      price,
      label: a?.label || a?.name || `+${credits} credits`,
      name: a?.name || a?.label || `+${credits} credits`,
      card_subtitle: cardSubtitle,
      description: a?.description || "",
      save: a?.save || a?.saveLabel || "",
      best: !!a?.best,
      scope,
      plan_ids,
      visible_in: Array.isArray(visibleIn) ? visibleIn : null,
      hide: a?.hide === true,
      disabled: a?.disabled === true,
      show_on_main:
        a?.show_on_main !== false && a?.showOnMain !== false && a?.hide !== true,
      show_in_detail:
        a?.show_in_detail !== false &&
        a?.showInDetail !== false &&
        a?.hide !== true,
      offer_badges: this.parseOfferBadges(a?.offer_badges ?? a?.offerBadges),
      active: a?.active !== false && a?.hide !== true && a?.disabled !== true,
      default_selected: this.isUnlimitedFlag(
        a?.default_selected ?? a?.defaultSelected,
      ),
      order: a?.order != null ? Number(a.order) : index,
    };
  },

  parsePlanCreditAddonRefs(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw
        .map((entry, i) => {
          if (typeof entry === "string") {
            const id = this.slugifyPlanId(entry);
            return id ? { id, active: true, order: i, _ref: true } : null;
          }
          if (entry && typeof entry === "object") {
            return this.normalizeCreditAddon(entry, entry.id || `addon_${i}`, i);
          }
          return null;
        })
        .filter(Boolean);
    }
    if (typeof raw === "object") {
      return Object.entries(raw).map(([id, a], i) =>
        typeof a === "string"
          ? { id: this.slugifyPlanId(a), active: true, order: i, _ref: true }
          : this.normalizeCreditAddon({ ...a, id: a?.id || id }, id, i),
      );
    }
    return [];
  },

  normalizeAddonsConfig(creditsConfig) {
    const raw = creditsConfig && typeof creditsConfig === "object" ? creditsConfig : {};
    return {
      addons_enabled: raw.addons_enabled !== false && raw.addonsEnabled !== false,
      addons_require_license:
        raw.addons_require_license !== false &&
        raw.addonsRequireLicense !== false,
      global_addons_enabled:
        raw.global_addons_enabled !== false &&
        raw.globalAddonsEnabled !== false,
      plan_addons_enabled:
        raw.plan_addons_enabled !== false && raw.planAddonsEnabled !== false,
      addon_scopes_enabled:
        raw.addon_scopes_enabled === true || raw.addonScopesEnabled === true,
      pack_scopes_enabled:
        raw.pack_scopes_enabled === true || raw.packScopesEnabled === true,
      custom_plan: this.normalizeCustomPlanConfig(
        raw.custom_plan ?? raw.customPlan,
      ),
    };
  },

  normalizeCustomPlanConfig(raw) {
    const c = raw && typeof raw === "object" ? raw : {};
    const hidden = c.hide === true;
    const disabled =
      c.disabled === true ||
      c.disable === true ||
      c.disable_block === true;
    return {
      enabled: c.enabled !== false && !hidden,
      disabled,
      label: c.label || "Request Custom Plan via WhatsApp",
      whatsapp_title: c.whatsapp_title || c.whatsappTitle || "Custom Plan",
      description:
        c.description ||
        "Pick add-ons and send — we will confirm pricing and assign your license.",
      allow_addon_selection:
        c.allow_addon_selection !== false && c.allowAddonSelection !== false,
      assign_on_whatsapp:
        c.assign_on_whatsapp !== false && c.assignOnWhatsapp !== false,
      source: c.source || "global",
      id: c.id || c.slug || "",
    };
  },

  normalizeLicenseCustomPlanConfig(raw) {
    const c = raw && typeof raw === "object" ? raw : null;
    if (!c || c.enabled === false || c.active === false) return null;
    const blockDisabled =
      c.disabled === true ||
      c.disable === true ||
      c.disable_block === true;
    const planDefaults = {
      card_hint:
        String(c.card_hint || c.cardHint || "Tap to select · WhatsApp below").trim(),
      show_whatsapp_icon:
        c.show_whatsapp_icon !== false && c.showWhatsappIcon !== false,
      show_details_icon:
        c.show_details_icon !== false && c.showDetailsIcon !== false,
    };
    const options = Array.isArray(c.options)
      ? c.options
          .map((o, i) => {
            const credits = Math.max(0, Number(o?.credits) || 0);
            const price = Math.max(0, Number(o?.price) || 0);
            if (credits <= 0 && price <= 0) return null;
            const label =
              String(o?.label || "").trim() ||
              `${credits} Credits · ₹${price}`;
            const cardSubtitle =
              String(o?.card_subtitle || o?.cardSubtitle || "").trim() ||
              `${credits} credits · ₹${price}`;
            const cardHint = String(
              o?.card_hint || o?.cardHint || planDefaults.card_hint || "",
            ).trim();
            const ctaText =
              String(o?.cta_text || o?.ctaText || "").trim() ||
              `Buy ${credits} credits on WhatsApp`;
            let showWhatsapp = planDefaults.show_whatsapp_icon;
            if (
              o?.show_whatsapp_icon === false ||
              o?.showWhatsappIcon === false
            ) {
              showWhatsapp = false;
            } else if (
              o?.show_whatsapp_icon === true ||
              o?.showWhatsappIcon === true
            ) {
              showWhatsapp = true;
            }
            let showDetails = planDefaults.show_details_icon;
            if (
              o?.show_details_icon === false ||
              o?.showDetailsIcon === false
            ) {
              showDetails = false;
            } else if (
              o?.show_details_icon === true ||
              o?.showDetailsIcon === true
            ) {
              showDetails = true;
            }
            return {
              id: o?.id || `opt_${credits}_${price}_${i}`,
              credits,
              price,
              label,
              card_subtitle: cardSubtitle,
              card_hint: cardHint,
              cta_text: ctaText,
              show_whatsapp_icon: showWhatsapp,
              show_details_icon: showDetails,
            };
          })
          .filter(Boolean)
      : [];
    return {
      enabled: true,
      disabled: blockDisabled,
      label: String(c.label || "Request Custom Plan via WhatsApp").trim(),
      whatsapp_title: String(
        c.whatsapp_title || c.whatsappTitle || "My Plans",
      ).trim(),
      description: String(
        c.description || "Pick a bundle below and send via WhatsApp.",
      ).trim(),
      detail_footer: String(c.detail_footer || c.detailFooter || "").trim(),
      card_hint: planDefaults.card_hint,
      show_whatsapp_icon: planDefaults.show_whatsapp_icon,
      show_details_icon: planDefaults.show_details_icon,
      allow_addon_selection:
        c.allow_addon_selection !== false && c.allowAddonSelection !== false,
      assign_on_whatsapp:
        c.assign_on_whatsapp !== false && c.assignOnWhatsapp !== false,
      source: "license",
      id: c.id || c.slug || "",
      order: Number.isFinite(Number(c.order)) ? Number(c.order) : 0,
      options,
    };
  },

  resolveLicenseCustomPlanEntries(lic) {
    const src = lic || {};
    const rawArr = src.license_custom_plans || src.licenseCustomPlans;
    if (Array.isArray(rawArr) && rawArr.length) {
      return rawArr
        .map((entry, i) => this.normalizeLicenseCustomPlanConfig(entry, i))
        .filter(Boolean)
        .sort(
          (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) ||
            String(a.label || "").localeCompare(String(b.label || "")),
        );
    }
    const legacy = this.normalizeLicenseCustomPlanConfig(
      src.license_custom_plan ?? src.licenseCustomPlan,
    );
    return legacy ? [legacy] : [];
  },

  resolveCustomPlanBlocks(plan, creditsConfig, licenseContext) {
    const lic = licenseContext || null;
    const blocks = [];
    const globalCfg = this.normalizeCustomPlanConfig(
      creditsConfig?.custom_plan ?? creditsConfig?.customPlan,
    );
    if (this.planShowsCustomPlan(plan, creditsConfig, licenseContext)) {
      blocks.push({ ...globalCfg, source: "global", id: "global_custom_plan" });
    }
    if (!this.licenseMyPlansHidden(plan, lic)) {
      this.resolveLicenseCustomPlanEntries(lic).forEach((entry) => {
        blocks.push(entry);
      });
    }
    return blocks;
  },

  licenseMyPlansHidden(plan, licenseContext) {
    const lic = licenseContext || null;
    return !!(
      lic?.hide_license_custom_plans ||
      lic?.hideLicenseCustomPlans ||
      plan?.hide_license_custom_plans ||
      plan?.hideLicenseCustomPlans
    );
  },

  licenseMyPlansDisabled(plan, licenseContext, blockCfg) {
    const lic = licenseContext || null;
    const licenseLevel = !!(
      lic?.disable_license_custom_plans ||
      lic?.disableLicenseCustomPlans ||
      plan?.disable_license_custom_plans ||
      plan?.disableLicenseCustomPlans
    );
    const blockLevel =
      blockCfg?.disabled === true ||
      blockCfg?.disable === true ||
      blockCfg?.disable_block === true;
    return licenseLevel || blockLevel;
  },

  resolveLicenseCustomPlanEntryById(licenseContext, planCfgId) {
    const lic = licenseContext || null;
    if (!lic || !planCfgId) return null;
    const key = String(planCfgId);
    const slug = this.slugifyPlanId?.(key) || key;
    const entries = this.resolveLicenseCustomPlanEntries(lic);
    return (
      entries.find(
        (p) =>
          p &&
          (p.id === key ||
            this.slugifyPlanId?.(p.id) === slug ||
            p.id === planCfgId),
      ) || null
    );
  },

  isCustomPlanPurchaseAllowed(btn, plan, licenseContext) {
    if (!btn || btn.disabled) return false;
    const section = btn.closest(".plan-detail-section--custom");
    if (section?.classList.contains("plan-detail-section--disabled")) {
      return false;
    }
    const source =
      btn.dataset.customPlanSource ||
      section?.dataset?.customPlanSource ||
      "global";
    const planCfgId =
      btn.dataset.customPlanId || section?.dataset?.customPlanId || "";
    if (source === "license") {
      const match = this.resolveLicenseCustomPlanEntryById(
        licenseContext,
        planCfgId,
      );
      if (match?.disabled) return false;
      return !this.licenseMyPlansDisabled(plan, licenseContext, match);
    }
    return !this.planCustomPlanDisabled(plan, licenseContext);
  },

  groupLicenseCustomPlansForDisplay(blocks) {
    const list = (blocks || []).filter((b) => b && b.source === "license");
    return list.map((cfg) => ({
      ...cfg,
      options: (cfg.options || []).map((opt, oi) => ({
        ...opt,
        _cfgId: cfg.id,
        id: opt.id || `opt_${cfg.id}_${oi}`,
      })),
    }));
  },

  renderCustomPlanSectionHtml(plan, blocks, licenseContext) {
    if (!blocks?.length) return "";
    let html = "";
    const globalBlocks = blocks.filter((b) => b.source !== "license");
    const licenseBlocks = this.groupLicenseCustomPlansForDisplay(
      blocks.filter((b) => b.source === "license"),
    );
    globalBlocks.forEach((cfg) => {
      html += this.renderOneCustomPlanSectionHtml(
        plan,
        cfg,
        this.planCustomPlanDisabled(plan, licenseContext),
        false,
        licenseContext,
      );
    });
    licenseBlocks.forEach((cfg) => {
      html += this.renderOneCustomPlanSectionHtml(
        plan,
        cfg,
        this.licenseMyPlansDisabled(plan, licenseContext, cfg),
        true,
        licenseContext,
      );
    });
    return html;
  },

  renderOneCustomPlanSectionHtml(
    plan,
    cfg,
    customDisabled,
    isLicense,
    licenseContext,
  ) {
    const title = isLicense
      ? `🛠 ${cfg.whatsapp_title || cfg.label || "MY PLANS"}`
      : "🛠 CUSTOM PLAN";
    const planId = cfg.id || (isLicense ? "license_custom_plan" : "global_custom_plan");
    const options = Array.isArray(cfg.options) ? cfg.options : [];
    const sectionDisabled =
      customDisabled ||
      cfg?.disabled === true ||
      (isLicense && this.licenseMyPlansDisabled(plan, licenseContext, cfg));
    let html = `<div class="plan-detail-section plan-detail-section--custom${sectionDisabled ? " plan-detail-section--disabled" : ""}" data-custom-plan-source="${this.escapeAttr(cfg.source || "global")}" data-custom-plan-id="${this.escapeAttr(planId)}">
        <div class="plan-detail-section-title">${this.escapeHtml(title)}</div>
        ${cfg.description ? `<p class="plan-detail-section-body">${this.escapeHtml(cfg.description)}</p>` : ""}`;
    if (sectionDisabled && isLicense) {
      html += `<p class="plan-detail-section-body plan-detail-section-body--muted">MY PLANS are visible but disabled for this license.</p>`;
    } else if (sectionDisabled && !isLicense) {
      html += `<p class="plan-detail-section-body plan-detail-section-body--muted">Custom plan is visible but disabled.</p>`;
    }
    if (isLicense && options.length) {
      html += `<div class="plan-grid plan-detail-lic-custom-options" style="grid-template-columns:${this.planGridColumns(options.length)};margin-top:8px;">`;
      options.forEach((opt, oi) => {
        html += this.renderLicenseCustomPlanOptionCard(
          opt,
          cfg,
          plan,
          sectionDisabled,
          oi,
        );
      });
      html += `</div>`;
    } else if (!isLicense && cfg.allow_addon_selection !== false) {
      html += `<p class="plan-detail-section-body">Select add-ons above and request a tailored package via WhatsApp.</p>`;
    }
    html += `<button type="button" class="plan-detail-custom-plan-btn btn btn-secondary${sectionDisabled ? " plan-detail-custom-plan-btn--disabled" : ""}" ${sectionDisabled ? "disabled" : ""} data-custom-plan-source="${this.escapeAttr(cfg.source || "global")}" data-custom-plan-id="${this.escapeAttr(planId)}" ${this.planDataAttrs(plan, this.formatPlanDurationLabel(plan))} style="width:100%;margin-top:8px;padding:10px;font-size:12px;${sectionDisabled ? "opacity:0.55;cursor:not-allowed;" : ""}">
          ${this.escapeHtml(cfg.label || "Request Custom Plan via WhatsApp")}${sectionDisabled ? " (disabled)" : ""}
        </button>`;
    if (cfg.detail_footer) {
      html += `<p class="plan-detail-footer">${this.escapeHtml(cfg.detail_footer)}</p>`;
    }
    html += `</div>`;
    return html;
  },

  renderLicenseCustomPlanOptionCard(option, cfg, parentPlan, disabled, index) {
    const credits = Math.max(0, Number(option?.credits) || 0);
    const price = Math.max(0, Number(option?.price) || 0);
    const label =
      String(option?.label || "").trim() || `${credits} Credits · ₹${price}`;
    const optId = option?.id || `opt_${index}`;
    const cfgId = option?._cfgId || cfg?.id || "license_custom_plan";
    const pressed = index === 0 ? ' aria-pressed="true"' : ' aria-pressed="false"';
    const selectedClass = index === 0 ? " plan-btn--selected" : "";
    const subtitle =
      option?.card_subtitle ||
      `${credits} credits · ₹${price}`;
    const cardHint =
      option?.card_hint || cfg?.card_hint || "Tap to select · WhatsApp below";
    const btn = `<button type="button" class="plan-btn plan-lic-custom-option-btn plan-buy-btn plan-card-main${selectedClass}${disabled ? " plan-addon-card--disabled" : ""}"${disabled ? " disabled" : ""}${pressed}
      data-plan="${this.escapeAttr(parentPlan?.id || "")}"
      data-custom-plan-id="${this.escapeAttr(cfgId)}"
      data-option-id="${this.escapeAttr(optId)}"
      data-option-credits="${credits}"
      data-option-price="${price}"
      data-option-label="${this.escapeAttr(label)}"
      data-option-cta="${this.escapeAttr(option?.cta_text || "")}"
      style="width:100%;padding:10px;font-size:11px;text-align:center;cursor:pointer;">
      <div class="plan-name">${this.escapeHtml(label)}</div>
      <div class="plan-price">₹${price}</div>
      <div class="plan-note" style="color:var(--mso-muted);">${this.escapeHtml(subtitle)}</div>
      ${this.planCardFooterHtml({ card_hint: cardHint })}
    </button>`;
    return btn;
  },

  renderLicenseCustomPlanOptionChip(option, cfg, parentPlan, disabled, index) {
    return this.renderLicenseCustomPlanOptionCard(
      option,
      cfg,
      parentPlan,
      disabled,
      index,
    );
  },

  isPlanVisible(plan) {
    if (!plan) return false;
    if (plan.active === false) return false;
    if (plan.hide === true || plan.disabled === true) return false;
    return true;
  },

  planAllowsDetailAddons(plan, licenseContext) {
    if (!plan || plan.unlimited_credits) return false;
    const lic = licenseContext || null;
    if (lic?.hide_plan_addons || lic?.hidePlanAddons) return false;
    if (plan.hide_plan_addons_in_detail) return false;
    const allowPlan = plan.allow_plan_addons;
    const allowLegacy = plan.allow_credit_addons;
    if (allowPlan === false) return false;
    if (allowLegacy === false && allowPlan == null) return false;
    return true;
  },

  planAddonsDisabled(plan, licenseContext) {
    const lic = licenseContext || null;
    return !!(
      plan?.disable_plan_addons ||
      lic?.disable_plan_addons ||
      lic?.disablePlanAddons
    );
  },

  planShowsCustomPlan(plan, creditsConfig, licenseContext) {
    const cfg = this.normalizeAddonsConfig(creditsConfig);
    const lic = licenseContext || null;
    if (lic?.hide_custom_plan || lic?.hideCustomPlan) return false;
    if (plan?.hide_custom_plan || plan?.hideCustomPlan) return false;
    if (!cfg.custom_plan.enabled) return false;
    if (plan.allow_custom_plan === false) return false;
    if (plan.custom_plan_enabled === false) return false;
    return true;
  },

  planCustomPlanDisabled(plan, licenseContext) {
    const lic = licenseContext || null;
    return !!(
      plan?.disable_custom_plan ||
      plan?.disableCustomPlan ||
      lic?.disable_custom_plan ||
      lic?.disableCustomPlan
    );
  },

  catalogById(catalog) {
    const byId = {};
    (catalog || []).forEach((a) => {
      byId[a.id] = a;
      byId[this.slugifyPlanId(a.id)] = a;
    });
    return byId;
  },

  resolvePlanAddonEntries(plan, catalog) {
    const byId = this.catalogById(catalog);
    const out = [];
    (plan?.credit_addons || []).forEach((entry, i) => {
      if (typeof entry === "string") {
        const id = this.slugifyPlanId(entry);
        if (byId[id]) out.push(byId[id]);
        return;
      }
      if (entry?._ref) {
        const id = this.slugifyPlanId(entry.id);
        if (byId[id]) out.push(byId[id]);
        return;
      }
      if (entry && typeof entry === "object" && entry.active !== false) {
        out.push(this.normalizeCreditAddon(entry, entry.id, i));
      }
    });
    return out;
  },

  mergeAddonCatalogFromPlans(plans, catalog) {
    const byId = this.catalogById(catalog);
    (plans || []).forEach((plan) => {
      this.resolvePlanAddonEntries(plan, catalog).forEach((a) => {
        if (a?.id && !byId[a.id]) byId[a.id] = a;
      });
      (plan?.credit_addons || []).forEach((entry, i) => {
        if (entry && typeof entry === "object" && !entry._ref && entry.id) {
          const norm = this.normalizeCreditAddon(entry, entry.id, i);
          if (!byId[norm.id]) byId[norm.id] = norm;
        }
      });
    });
    return this.sortPlans(Object.values(byId));
  },

  resolveFullAddonCatalog(creditsConfig, plans) {
    const raw =
      creditsConfig?.addon_catalog ??
      creditsConfig?.addonCatalog ??
      null;
    let catalog = this.parseCreditAddons(raw);
    if (!catalog.length) {
      catalog = this.defaultAddonCatalog().map((a, i) =>
        this.normalizeCreditAddon(a, a.id, i),
      );
    }
    if (Array.isArray(plans) && plans.length) {
      catalog = this.mergeAddonCatalogFromPlans(plans, catalog);
    }
    return this.sortPlans(catalog.filter((a) => a.active !== false));
  },

  addonAppliesToPlan(addon, planId, scopesEnabled) {
    if (!addon || addon.active === false || addon.hide || addon.disabled) {
      return false;
    }
    if (!scopesEnabled) return true;
    const scope = addon.scope || "global";
    if (scope !== "plan") return scope === "global";
    const ids = addon.plan_ids || [];
    if (!ids.length) return false;
    const key = this.slugifyPlanId(planId);
    return ids.some((id) => this.slugifyPlanId(id) === key);
  },

  addonVisibleOnSurface(addon, surface, scopesEnabled) {
    if (!addon || addon.active === false || addon.hide || addon.disabled) {
      return false;
    }
    const vis = addon.visible_in;
    if (Array.isArray(vis) && vis.length) {
      const norm = vis.map((v) => String(v).toLowerCase());
      if (surface === "main") {
        return norm.some((v) => v === "main" || v === "global");
      }
      return norm.some(
        (v) => v === "plan_detail" || v === "detail" || v === "plan",
      );
    }
    if (scopesEnabled) {
      if (surface === "main") {
        return (
          (addon.scope === "global" || !addon.scope) && addon.show_on_main !== false
        );
      }
      return addon.scope === "plan" && addon.show_in_detail !== false;
    }
    if (surface === "main") return addon.show_on_main !== false;
    return addon.show_in_detail !== false;
  },

  getPlanDetailCreditAddons(plan, creditsConfig, allPlans, licenseContext) {
    const cfg = this.normalizeAddonsConfig(creditsConfig);
    const lic = licenseContext || null;
    if (lic?.hide_plan_addons || lic?.hidePlanAddons) return [];
    if (plan?.hide_plan_addons_in_detail) return [];
    if (!cfg.addons_enabled || !cfg.plan_addons_enabled) return [];
    if (!this.planAllowsDetailAddons(plan, lic)) return [];
    const catalog = this.resolveFullAddonCatalog(creditsConfig, allPlans);
    const planEntries = this.resolvePlanAddonEntries(plan, catalog);
    if (cfg.addon_scopes_enabled) {
      if (planEntries.length) {
        return this.sortPlans(
          planEntries.filter(
            (a) =>
              a.active !== false &&
              !a.hide &&
              this.addonAppliesToPlan(a, plan.id, true),
          ),
        );
      }
      return this.sortPlans(
        catalog.filter(
          (a) =>
            a.scope === "plan" &&
            this.addonAppliesToPlan(a, plan.id, true) &&
            this.addonVisibleOnSurface(a, "plan_detail", true),
        ),
      );
    }
    if (planEntries.length) {
      return this.sortPlans(planEntries.filter((a) => a.active !== false));
    }
    return this.getPlanCreditAddonsLegacy(plan, catalog);
  },

  getGlobalCreditAddons(creditsConfig, allPlans) {
    const cfg = this.normalizeAddonsConfig(creditsConfig);
    if (!cfg.addons_enabled || !cfg.global_addons_enabled) return [];
    const catalog = this.resolveFullAddonCatalog(creditsConfig, allPlans);
    if (cfg.addon_scopes_enabled) {
      return this.sortPlans(
        catalog.filter(
          (a) =>
            (a.scope === "global" || !a.scope) &&
            this.addonVisibleOnSurface(a, "main", true),
        ),
      );
    }
    return this.sortPlans(
      catalog.filter((a) => this.addonVisibleOnSurface(a, "main", false)),
    );
  },

  getPlanCreditAddonsLegacy(plan, catalog) {
    if (!plan || plan.unlimited_credits) return [];
    if (plan.allow_credit_addons === false && plan.allow_plan_addons !== true) {
      return [];
    }
    const planAddons = (plan.credit_addons || []).filter(
      (a) => a && a.active !== false && !a._ref,
    );
    if (planAddons.length) return this.sortPlans(planAddons);
    if (Array.isArray(catalog) && catalog.length) {
      const fromCatalog = this.sortPlans(
        catalog.filter((a) => a.active !== false),
      );
      if (fromCatalog.length) return fromCatalog;
    }
    return this.sortPlans(
      this.defaultAddonCatalog().map((a, i) =>
        this.normalizeCreditAddon(a, a.id, i),
      ),
    );
  },

  parseCreditAddons(raw) {
    if (!raw) return [];
    let list = [];
    if (Array.isArray(raw)) {
      list = raw
        .filter((a) => a && typeof a === "object")
        .map((a, i) => this.normalizeCreditAddon(a, a.id || `addon_${i}`, i));
    } else if (typeof raw === "object") {
      list = Object.entries(raw).map(([id, a], i) =>
        this.normalizeCreditAddon({ ...a, id: a?.id || id }, id, i),
      );
    }
    return this.sortPlans(list);
  },

  /** Active add-ons for a plan: per-plan list first, then shared catalog, then built-in defaults. */
  getPlanCreditAddons(plan, catalog, creditsConfig, allPlans) {
    if (creditsConfig) {
      return this.getPlanDetailCreditAddons(
        plan,
        creditsConfig,
        allPlans || (catalog ? null : null),
      );
    }
    return this.getPlanCreditAddonsLegacy(plan, catalog);
  },

  /** Credits + price for a plan given selected add-on ids. */
  calculatePlanCredits(plan, selectedAddonIds, catalog) {
    const included = Number(plan?.included_credits || 0) || 0;
    const addons = this.getPlanCreditAddons(plan, catalog);
    const selected = new Set((selectedAddonIds || []).map((x) => String(x)));
    let addon = 0;
    let addonPrice = 0;
    addons.forEach((a) => {
      if (selected.has(String(a.id))) {
        addon += Number(a.credits) || 0;
        addonPrice += Number(a.price) || 0;
      }
    });
    return { included, addon, total: included + addon, addonPrice };
  },

  getLicenseAddonIds(lic) {
    const ids = lic?.addon_credit_ids || lic?.addonCreditIds;
    if (Array.isArray(ids)) return ids.filter(Boolean).map((x) => String(x));
    return [];
  },

  /** Resolve credits to grant a license: existing balance, else included + addon. */
  resolveLicenseCredits(lic, plan) {
    const existingBalance = this.resolveCreditsBalance(lic);
    const addonIds = this.getLicenseAddonIds(lic);
    const hasLicIncluded =
      lic?.included_credits != null || lic?.includedCredits != null;
    const hasLicAddon =
      lic?.addon_credits != null || lic?.addonCredits != null;
    const included = hasLicIncluded
      ? Number(lic.included_credits ?? lic.includedCredits) || 0
      : Number(plan?.included_credits || 0) || 0;
    const addon = hasLicAddon
      ? Number(lic.addon_credits ?? lic.addonCredits) || 0
      : this.calculatePlanCredits(plan, addonIds).addon;
    const custom = Math.max(
      0,
      Number(lic?.custom_credits ?? lic?.customCredits ?? lic?.bonus_credits ?? lic?.bonusCredits ?? 0) || 0,
    );
    const grantSum = included + addon + custom;
    const used = Number(lic?.credits_used ?? lic?.creditsUsed ?? 0) || 0;
    const balance = this.resolveCreditsBalance(lic);
    const total = balance + used > 0 ? balance + used : grantSum;
    return { included, addon, custom, total, addonIds, existingBalance: balance };
  },

  escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  escapeHtml(value) {
    return this.escapeAttr(value);
  },

  parsePlansRaw(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) {
      return raw
        .filter((p) => p && typeof p === "object")
        .map((p, i) => this.normalizePlanEntry(p, p.id || `plan_${i}`, i));
    }
    if (typeof raw === "object") {
      return Object.entries(raw).map(([id, p], i) =>
        this.normalizePlanEntry({ ...p, id: p?.id || id }, id, i),
      );
    }
    return null;
  },

  sortPlans(plans) {
    return [...plans].sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        String(a.name).localeCompare(String(b.name)),
    );
  },

  ensureSingleBestPlan(plans) {
    let found = false;
    return plans.map((p) => {
      if (!p.best) return p;
      if (found) return { ...p, best: false };
      found = true;
      return p;
    });
  },

  defaultAddonCatalog() {
    return [
      {
        id: "addon_10",
        credits: 10,
        price: 20,
        label: "+10 credits",
        card_subtitle: "10 credits · ₹20",
        offer_badges: ["+10"],
        description:
          "Quick boost — 10 extra generation runs added at checkout. Stacks on your plan included credits.",
        active: true,
        order: 0,
        card_hint: "Tap ℹ️ for details · Tap card to select",
        show_details_icon: true,
      },
      {
        id: "addon_25",
        credits: 25,
        price: 40,
        label: "+25 credits",
        card_subtitle: "25 credits · ₹40",
        offer_badges: ["Popular", "20% off", "+25"],
        description:
          "Better value — 25 extra credits at checkout (₹1.60/credit vs ₹2 base).",
        active: true,
        order: 1,
        card_hint: "Tap ℹ️ for details · Tap card to select",
        show_details_icon: true,
      },
      {
        id: "addon_50",
        credits: 50,
        price: 70,
        label: "+50 credits",
        card_subtitle: "50 credits · ₹70",
        offer_badges: ["30% off", "+50"],
        description:
          "Add 50 credits at checkout — best mid-tier add-on value (₹1.40/credit).",
        active: true,
        order: 2,
        card_hint: "Tap ℹ️ for details · Tap card to select",
        show_details_icon: true,
      },
      {
        id: "addon_100",
        credits: 100,
        price: 170,
        label: "+100 credits",
        card_subtitle: "100 credits · best value",
        offer_badges: ["Best value", "15% off", "+100"],
        description:
          "Largest add-on pack — lowest ₹/credit for subscription checkout top-ups.",
        active: true,
        order: 3,
        card_hint: "Tap ℹ️ for details · Tap card to select",
        show_details_icon: true,
      },
    ];
  },

  resolveAddonCatalog(creditsConfig) {
    return this.resolveFullAddonCatalog(creditsConfig, null);
  },

  defaultCreditsConfig() {
    return {
      enabled: true,
      price_per_credit: 2,
      min_purchase: 10,
      cost_per_operation: 1,
      addon_catalog: this.defaultAddonCatalog(),
      packs: [
        {
          id: "pack_10",
          credits: 10,
          price: 20,
          label: "10 Credits",
          active: true,
          order: 0,
        },
        {
          id: "pack_20",
          credits: 20,
          price: 38,
          label: "20 Credits",
          active: true,
          order: 1,
        },
        {
          id: "pack_50",
          credits: 50,
          price: 90,
          label: "50 Credits",
          active: true,
          order: 2,
        },
        {
          id: "pack_100",
          credits: 100,
          price: 170,
          label: "100 Credits",
          active: true,
          order: 3,
        },
      ],
    };
  },

  normalizeCreditPack(p, idFallback, index) {
    const id = this.slugifyPlanId(p?.id || idFallback || `pack_${index}`);
    return {
      id: id || `pack_${index}`,
      credits: Number(p?.credits) || 10,
      price: Number(p?.price) || 0,
      label: p?.label || p?.name || `${Number(p?.credits) || 10} Credits`,
      active: p?.active !== false,
      order: p?.order != null ? Number(p.order) : index,
      description: p?.description || p?.note || "",
      detail_subtitle: p?.detail_subtitle || p?.detailSubtitle || "",
      detail_footer: p?.detail_footer || p?.detailFooter || "",
      cta_text: p?.cta_text || p?.ctaText || "Buy via WhatsApp",
      highlights: this.parsePlanHighlights(p?.highlights),
      features: this.parsePlanFeatures(p?.features),
      detail_sections: this.parsePlanDetailSections(
        p?.detail_sections ?? p?.detailSections,
      ),
      show_whatsapp_icon:
        p?.show_whatsapp_icon !== false && p?.showWhatsappIcon !== false,
      show_details_icon:
        p?.show_details_icon !== false && p?.showDetailsIcon !== false,
      card_subtitle: p?.card_subtitle || p?.cardSubtitle || "",
      offer_badges: this.parseOfferBadges(p?.offer_badges ?? p?.offerBadges),
      scope:
        String(p?.scope || "global").trim().toLowerCase() === "plan"
          ? "plan"
          : "global",
      plan_ids: (Array.isArray(p?.plan_ids ?? p?.planIds)
        ? p.plan_ids ?? p.planIds
        : String(p?.plan_ids ?? p?.planIds ?? "")
            .split(/[\s,]+/)
            .map((x) => x.trim())
            .filter(Boolean)
      ).map((id) => this.slugifyPlanId(id)),
    };
  },

  packAppliesToPlan(pack, planId, scopesEnabled) {
    if (!pack || pack.active === false) return false;
    if (!scopesEnabled) return true;
    const scope = pack.scope || "global";
    if (scope !== "plan") return scope === "global";
    const ids = pack.plan_ids || [];
    if (!ids.length) return false;
    const key = this.slugifyPlanId(planId);
    return ids.some((id) => this.slugifyPlanId(id) === key);
  },

  filterCreditPacksForMain(packs, activePlanIds, scopesEnabled) {
    const list = Array.isArray(packs) ? packs : [];
    if (!scopesEnabled) return list;
    const planKeys = new Set(
      (activePlanIds || [])
        .map((id) => this.slugifyPlanId(id))
        .filter(Boolean),
    );
    return list.filter((p) => {
      if ((p.scope || "global") !== "plan") return true;
      if (!planKeys.size) return false;
      return (p.plan_ids || []).some((id) =>
        planKeys.has(this.slugifyPlanId(id)),
      );
    });
  },

  getPlanDetailCreditPacks(plan, creditsConfig) {
    const cfg = creditsConfig || {};
    const scopesEnabled =
      cfg.pack_scopes_enabled === true || cfg.packScopesEnabled === true;
    const packs = (cfg.packs || []).filter((p) => p.active !== false);
    if (!scopesEnabled || !plan) return [];
    return this.sortPlans(
      packs.filter(
        (p) =>
          p.scope === "plan" && this.packAppliesToPlan(p, plan.id, true),
      ),
    );
  },

  parseCreditPacks(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) {
      return raw
        .filter((p) => p && typeof p === "object")
        .map((p, i) => this.normalizeCreditPack(p, p.id || `pack_${i}`, i));
    }
    if (typeof raw === "object") {
      return Object.entries(raw).map(([id, p], i) =>
        this.normalizeCreditPack({ ...p, id: p?.id || id }, id, i),
      );
    }
    return null;
  },

  resolveUnlimitedTime(lic, plan) {
    if (this.isUnlimitedFlag(lic?.unlimited_time ?? lic?.unlimitedTime)) {
      return true;
    }
    if (this.isUnlimitedFlag(plan?.unlimited_time ?? plan?.unlimitedTime)) {
      return true;
    }
    const kind = String(
      lic?.plan_kind ??
        lic?.planKind ??
        plan?.plan_kind ??
        plan?.planKind ??
        "",
    ).toLowerCase();
    if (kind === "lifetime" || kind === "unlimited") return true;
    const days =
      lic?.planDays ??
      lic?.plan_days ??
      plan?.days;
    return days === 0 || days === "0";
  },

  resolveUnlimitedDevices(lic, plan) {
    // License keys are shareable — no device cap (Google sign-in uses google_trials).
    if (
      lic?.plan_type === "google_trial" ||
      lic?.planType === "google_trial" ||
      lic?.billing_mode === "google_trial" ||
      lic?.billingMode === "google_trial"
    ) {
      return false;
    }
    if (this.isUnlimitedFlag(lic?.unlimited_devices ?? lic?.unlimitedDevices)) {
      return true;
    }
    if (this.isUnlimitedFlag(plan?.unlimited_devices ?? plan?.unlimitedDevices)) {
      return true;
    }
    const max =
      lic?.max_devices ??
      lic?.maxDevices ??
      plan?.max_devices ??
      plan?.maxDevices;
    if (max === 0 || max === "0") return true;
    // Default: no device limit for paid/demo license keys (shared keys consume more credits).
    return true;
  },

  resolveUnlimitedCredits(lic, plan) {
    if (this.isUnlimitedFlag(lic?.unlimited_credits ?? lic?.unlimitedCredits)) {
      return true;
    }
    if (this.isUnlimitedFlag(plan?.unlimited_credits ?? plan?.unlimitedCredits)) {
      return true;
    }
    return false;
  },

  formatPlanDurationLabel(plan) {
    if (!plan) return "";
    if (plan.unlimited_time || plan.days === 0) return "Unlimited";
    if (plan.duration) return plan.duration;
    return `${plan.days} days`;
  },

  /** Device limits are enforced server-side for Google trial only — not shown on plan cards. */
  formatPlanDevicesLabel(_plan) {
    return "";
  },

  formatPlanCreditsLabel(plan) {
    const n = Number(plan?.included_credits ?? plan?.includedCredits ?? 0) || 0;
    if (n <= 0) return "";
    return `${n.toLocaleString("en-IN")} credits`;
  },

  formatPlanCardSubtitle(plan) {
    if (!plan) return "";
    if (plan.card_subtitle || plan.cardSubtitle) {
      return String(plan.card_subtitle || plan.cardSubtitle).trim();
    }
    const days = Number(plan.days) || 0;
    const credits = Number(plan.included_credits ?? plan.includedCredits ?? 0) || 0;
    let duration = "";
    if (days === 30) duration = "30 days";
    else if (days === 90) duration = "90 days";
    else if (days === 180) duration = "180 days";
    else if (days === 365) duration = "1 year";
    else if (days > 0) duration = `${days} days`;
    const parts = [];
    if (duration) parts.push(duration);
    if (credits > 0) parts.push(`${credits.toLocaleString("en-IN")} credits`);
    return parts.join(" · ");
  },

  formatPlanSaveLabel(plan) {
    const raw = String(plan?.save || plan?.saveLabel || "").trim();
    if (!raw) return "";
    const m = raw.match(/₹\s*([\d,.]+)/);
    if (m) {
      const amount = Math.round(Number(String(m[1]).replace(/,/g, "")) || 0);
      if (amount > 0) {
        const pct = raw.match(/([\d.]+)%\s*off/i);
        return pct
          ? `Save ₹${amount.toLocaleString("en-IN")} (${pct[1]}% off)`
          : `Save ₹${amount.toLocaleString("en-IN")}`;
      }
    }
    return raw;
  },

  async getCreditsConfig(forceFresh = false) {
    const app = await this.getAppConfig(forceFresh);
    const raw = app?.credits || app?.credits_config || {};
    const defaults = this.defaultCreditsConfig();
    const packs =
      this.parseCreditPacks(raw.packs) ||
      this.parseCreditPacks(defaults.packs) ||
      defaults.packs;
    const addonCatalog = this.resolveFullAddonCatalog(raw, null);
    const addonsCfg = this.normalizeAddonsConfig(raw);
    return {
      ...defaults,
      ...raw,
      enabled: raw.enabled !== false,
      price_per_credit: Number(raw.price_per_credit ?? raw.pricePerCredit ?? 2) || 2,
      min_purchase: Number(raw.min_purchase ?? raw.minPurchase ?? 10) || 10,
      cost_per_operation:
        Number(raw.cost_per_operation ?? raw.costPerOperation ?? 1) || 1,
      packs: this.sortPlans(packs.filter((p) => p.active !== false)),
      addon_catalog: addonCatalog,
      addons_enabled: addonsCfg.addons_enabled,
      addons_require_license: addonsCfg.addons_require_license,
      global_addons_enabled: addonsCfg.global_addons_enabled,
      plan_addons_enabled: addonsCfg.plan_addons_enabled,
      addon_scopes_enabled: addonsCfg.addon_scopes_enabled,
      pack_scopes_enabled: addonsCfg.pack_scopes_enabled,
      custom_plan: addonsCfg.custom_plan,
      image_generation: this.normalizeImageGenConfig(
        raw.image_generation ?? raw.imageGeneration,
      ),
    };
  },

  /** Normalize the credits.image_generation admin config. */
  normalizeImageGenConfig(raw) {
    const configured = !!raw && typeof raw === "object";
    const r = configured ? raw : {};
    return {
      configured,
      enabled: r.enabled !== false,
      credits_per_image:
        Math.max(0, Number(r.credits_per_image ?? r.creditsPerImage ?? 0) || 0),
      daily_limit:
        Math.max(0, Number(r.daily_limit ?? r.dailyLimit ?? 0) || 0),
      monthly_limit:
        Math.max(0, Number(r.monthly_limit ?? r.monthlyLimit ?? 0) || 0),
      max_batch_size:
        Math.max(0, Number(r.max_batch_size ?? r.maxBatchSize ?? 0) || 0),
    };
  },

  /** Extract normalized image_generation config from a config object. */
  getImageGenConfig(config) {
    const raw =
      config?.image_generation ??
      config?.imageGeneration ??
      config?.credits?.image_generation ??
      config?.credits?.imageGeneration;
    return this.normalizeImageGenConfig(raw);
  },

  async getImageGenerationConfig(forceFresh = false) {
    const credits = await this.getCreditsConfig(forceFresh);
    return this.getImageGenConfig(credits);
  },

  defaultSmartModeConfig() {
    const values = [20, 50, 100, 200];
    return {
      configured: false,
      variant_options: values.map((value, order) => ({
        value,
        label: String(value),
        active: true,
        order,
      })),
      default_variant: 20,
      max_variants_cap: 200,
      label: "Max Variants",
      hint: "⚡ Live Meesho shipping checks — finds the lowest ₹ from generated variants",
    };
  },

  normalizeVariantOption(raw, index) {
    if (typeof raw === "number" || typeof raw === "string") {
      const value = Math.max(1, Number(raw) || 0);
      if (!value) return null;
      return { value, label: String(value), active: true, order: index };
    }
    if (!raw || typeof raw !== "object") return null;
    const value = Math.max(
      1,
      Number(raw.value ?? raw.variants ?? raw.count ?? raw.max) || 0,
    );
    if (!value) return null;
    return {
      value,
      label: String(raw.label || raw.name || value),
      active: raw.active !== false,
      order: raw.order != null ? Number(raw.order) : index,
    };
  },

  parseVariantOptions(raw) {
    if (!Array.isArray(raw)) return null;
    return raw
      .map((item, i) => this.normalizeVariantOption(item, i))
      .filter(Boolean)
      .filter((o) => o.active)
      .sort((a, b) => a.order - b.order || a.value - b.value);
  },

  normalizeSmartModeConfig(raw) {
    const configured = !!raw && typeof raw === "object";
    const defaults = this.defaultSmartModeConfig();
    const r = configured ? raw : {};
    const parsed =
      this.parseVariantOptions(
        r.variant_options ?? r.variantOptions ?? r.options,
      ) || defaults.variant_options;
    const maxCap = Math.max(
      1,
      Number(
        r.max_variants_cap ?? r.maxVariantsCap ?? defaults.max_variants_cap,
      ) || defaults.max_variants_cap,
    );
    let options = parsed.filter((o) => o.value <= maxCap);
    if (!options.length) {
      options = defaults.variant_options.filter((o) => o.value <= maxCap);
    }
    const requestedDefault = Math.max(
      1,
      Number(r.default_variant ?? r.defaultVariant ?? defaults.default_variant) ||
        defaults.default_variant,
    );
    const defaultVariant =
      options.find((o) => o.value === requestedDefault)?.value ||
      options[0]?.value ||
      Math.min(requestedDefault, maxCap);
    return {
      configured,
      variant_options: options,
      default_variant: defaultVariant,
      max_variants_cap: maxCap,
      label: r.label || r.variant_label || defaults.label,
      hint: r.hint || r.help_text || r.helpText || defaults.hint,
    };
  },

  async getSmartModeConfig(forceFresh = false) {
    const app = await this.getAppConfig(forceFresh);
    const raw =
      app?.smart_mode ??
      app?.smartMode ??
      app?.credits?.smart_mode ??
      app?.credits?.smartMode;
    return this.normalizeSmartModeConfig(raw);
  },

  applySmartModeRuntime(config, imageGenConfig) {
    const cfg = config || this.defaultSmartModeConfig();
    let options = [...(cfg.variant_options || [])];
    const batchMax = Number(imageGenConfig?.max_batch_size) || 0;
    if (batchMax > 0) {
      options = options.filter((o) => o.value <= batchMax);
    }
    if (!options.length) {
      options = this.defaultSmartModeConfig().variant_options.filter(
        (o) => !batchMax || o.value <= batchMax,
      );
    }
    let defaultVariant = cfg.default_variant;
    if (!options.some((o) => o.value === defaultVariant)) {
      defaultVariant = options[0]?.value || defaultVariant;
    }
    const resolved = {
      ...cfg,
      variant_options: options,
      default_variant: defaultVariant,
      max_variants_cap: Math.max(
        cfg.max_variants_cap,
        ...options.map((o) => o.value),
        defaultVariant,
      ),
    };
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.setMaxResultVariants) {
      MeeshoAPI.setMaxResultVariants(resolved.max_variants_cap);
    }
    if (typeof globalThis !== "undefined") {
      globalThis.__smartModeConfig = resolved;
    }
    return resolved;
  },

  fillMaxAttemptsSelect(selectEl, config) {
    if (!selectEl || !config) return;
    const options = config.variant_options || [];
    if (!options.length) return;
    const prev = Number(selectEl.value);
    const hasPrev = options.some((o) => o.value === prev);
    const selectedValue = hasPrev ? prev : config.default_variant;
    selectEl.innerHTML = options
      .map((o) => {
        const selected = o.value === selectedValue;
        return `<option value="${o.value}"${selected ? " selected" : ""}>${this.escapeHtml(o.label)}</option>`;
      })
      .join("");
    selectEl.value = String(selectedValue);
  },

  updateSmartModeLabels(root, config) {
    const scope = root || document;
    const label = scope.querySelector('label[for="max-attempts"]');
    if (label && config?.label) label.textContent = config.label;
    const hint = scope.querySelector("#smart-mode-hint");
    if (hint && config?.hint) hint.textContent = config.hint;
  },

  planWhatsAppIconSvg(size = 14) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
  },

  planDetailsIconSvg(size = 12) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none"/></svg>`;
  },

  showPlanCornerDetails(item) {
    if (!item || typeof item !== "object") return true;
    if (item.show_details_icon === false || item.showDetailsIcon === false) {
      return false;
    }
    if (item.show_whatsapp_icon === false || item.showWhatsappIcon === false) {
      return false;
    }
    return true;
  },

  planCardFooterHtml(plan) {
    if (!plan.card_hint) return "";
    return `<div class="plan-card-foot">${this.escapeHtml(plan.card_hint)}</div>`;
  },

  planCardShell(mainHtml, item, kind = "plan") {
    if (!this.showPlanCornerDetails(item)) return mainHtml;
    const id = item.id;
    const dataAttr =
      kind === "pack"
        ? `data-pack="${this.escapeAttr(id)}"`
        : kind === "addon"
          ? `data-plan="${this.escapeAttr(item.parent_plan_id || item.parentPlanId || "")}" data-addon-id="${this.escapeAttr(id)}"`
          : `data-plan="${this.escapeAttr(id)}"`;
    const cornerClass =
      kind === "pack"
        ? "credit-pack-detail-corner-btn"
        : kind === "addon"
          ? "plan-addon-detail-corner-btn"
          : "plan-detail-corner-btn";
    const detailBtn = `<button type="button" class="plan-detail-corner ${cornerClass}" ${dataAttr} title="View details" aria-label="View details">${this.planDetailsIconSvg(12)}</button>`;
    return `<div class="plan-card-shell">${mainHtml}${detailBtn}</div>`;
  },

  planDetailWhatsAppBtnHtml(label, dataAttr, extraClass = "") {
    const cls = `plan-detail-buy-btn${extraClass ? ` ${extraClass}` : ""}`;
    return `<button type="button" class="${cls}" ${dataAttr} style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;padding:12px 16px;border:none;border-radius:10px;background:linear-gradient(135deg,#25d366 0%,#128c7e 100%);color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(37,211,102,0.28);">
      ${this.planWhatsAppIconSvg(16)}<span>${this.escapeHtml(label)}</span>
    </button>`;
  },

  /** Local-date period keys for daily/monthly counters. */
  getImageGenPeriodKeys(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return { todayDate: `${y}-${m}-${d}`, monthKey: `${y}-${m}` };
  },

  /** Return counters with today/month reset when the period key changed. */
  normalizeImageGenCounters(counters) {
    const { todayDate, monthKey } = this.getImageGenPeriodKeys();
    const c = counters || {};
    const total =
      Number(
        c.total ?? c.images_generated_total ?? c.imagesGeneratedTotal ?? 0,
      ) || 0;
    let today =
      Number(
        c.today ?? c.images_generated_today ?? c.imagesGeneratedToday ?? 0,
      ) || 0;
    let month =
      Number(
        c.month ?? c.images_generated_month ?? c.imagesGeneratedMonth ?? 0,
      ) || 0;
    const savedTodayDate =
      c.todayDate ??
      c.images_generated_today_date ??
      c.imagesGeneratedTodayDate ??
      "";
    const savedMonthKey =
      c.monthKey ??
      c.images_generated_month_key ??
      c.imagesGeneratedMonthKey ??
      "";
    if (savedTodayDate !== todayDate) today = 0;
    if (savedMonthKey !== monthKey) month = 0;
    return { total, today, todayDate, month, monthKey };
  },

  /** Increment generation-run counters on a license doc (count is runs, not variants). */
  async recordImageGeneration(licenseKey, count) {
    if (!this.isEnabled()) {
      return { ok: false, reason: "Firebase unavailable" };
    }
    const key = this.normalizeKey(licenseKey);
    const lic = await this.fetchDoc("licenses", key);
    if (!lic) return { ok: false, reason: "License not found" };

    const cur = this.normalizeImageGenCounters({
      total: lic.images_generated_total,
      today: lic.images_generated_today,
      todayDate: lic.images_generated_today_date,
      month: lic.images_generated_month,
      monthKey: lic.images_generated_month_key,
    });
    const n = Math.max(0, Number(count) || 0);
    const next = {
      total: cur.total + n,
      today: cur.today + n,
      todayDate: cur.todayDate,
      month: cur.month + n,
      monthKey: cur.monthKey,
    };
    const ok = await this.patchDoc(
      "licenses",
      key,
      {
        images_generated_total: next.total,
        images_generated_today: next.today,
        images_generated_today_date: next.todayDate,
        images_generated_month: next.month,
        images_generated_month_key: next.monthKey,
      },
      [
        "images_generated_total",
        "images_generated_today",
        "images_generated_today_date",
        "images_generated_month",
        "images_generated_month_key",
      ],
    );
    return { ok, counters: next };
  },

  async getCreditPacks(forceFresh = false) {
    const cfg = await this.getCreditsConfig(forceFresh);
    const app = await this.getAppConfig(forceFresh);
    const rawCredits = app?.credits || app?.credits_config || {};
    if (Object.prototype.hasOwnProperty.call(rawCredits, "packs")) {
      return cfg.packs || [];
    }
    return cfg.packs?.length ? cfg.packs : this.defaultCreditsConfig().packs;
  },

  getDeviceIds(lic) {
    const ids = lic?.device_ids || lic?.deviceIds;
    if (Array.isArray(ids)) return ids.filter(Boolean);
    const legacy = lic?.machineId || lic?.machine_id;
    return legacy ? [legacy] : [];
  },

  resolveMaxDevices(lic, plan) {
    if (this.resolveUnlimitedDevices(lic, plan)) return 0;
    const raw =
      lic?.max_devices ??
      lic?.maxDevices ??
      plan?.max_devices ??
      plan?.maxDevices;
    if (raw === 0 || raw === "0") return 0;
    if (raw != null) return Math.max(1, Number(raw) || 1);
    return 0;
  },

  resolveBillingMode(lic, plan) {
    return this.inferLicenseBillingMode(lic, plan);
  },

  inferLicenseBillingMode(lic, plan) {
    const creditInfo = this.resolveLicenseCredits(lic, plan);
    if (creditInfo.addon > 0 || creditInfo.custom > 0) return "hybrid";
    const stored =
      lic?.billing_mode ||
      lic?.billingMode ||
      plan?.billing_mode ||
      plan?.billingMode ||
      "subscription";
    return stored || "subscription";
  },

  guessClientLocation() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const lang = navigator.language || "";
      return [tz, lang].filter(Boolean).join(" · ");
    } catch (_) {
      return "";
    }
  },

  buildLicenseCustomerPatch(lic, options = {}) {
    const patch = {};
    const user = options.googleUser || null;
    const fill = (key, val) => {
      if (!val || !String(val).trim()) return;
      const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const existing = lic?.[key] ?? lic?.[camel];
      if (existing && String(existing).trim()) return;
      patch[key] = String(val).trim();
    };
    fill("customer_email", user?.email);
    fill("customer_name", user?.displayName);
    fill("customer_location", options.location || this.guessClientLocation());
    fill("customer_address", options.address || user?.address || "");
    return patch;
  },

  resolveCreditsBalance(lic) {
    return Number(lic?.credits_balance ?? lic?.creditsBalance ?? 0) || 0;
  },

  resolveCreditGrantPools(lic, plan) {
    const creditInfo = this.resolveLicenseCredits(lic, plan);
    const includedGrant = Number(creditInfo.included) || 0;
    const addonGrant = Number(creditInfo.addon) || 0;
    const customGrant = Number(creditInfo.custom) || 0;
    const totalUsed = Number(lic?.credits_used ?? lic?.creditsUsed ?? 0) || 0;
    let includedUsed = Number(
      lic?.included_credits_used ?? lic?.includedCreditsUsed,
    );
    let addonUsed = Number(lic?.addon_credits_used ?? lic?.addonCreditsUsed);
    let customUsed = Number(lic?.custom_credits_used ?? lic?.customCreditsUsed);
    if (!Number.isFinite(includedUsed) || !Number.isFinite(addonUsed) || !Number.isFinite(customUsed)) {
      includedUsed = Math.min(totalUsed, includedGrant);
      addonUsed = Math.max(0, Math.min(totalUsed - includedUsed, addonGrant));
      customUsed = Math.max(0, totalUsed - includedUsed - addonUsed);
    }
    includedUsed = Math.max(0, Math.min(includedUsed, includedGrant));
    addonUsed = Math.max(0, Math.min(addonUsed, addonGrant));
    customUsed = Math.max(0, Math.min(customUsed, customGrant));
    return {
      includedGrant,
      addonGrant,
      customGrant,
      includedUsed,
      addonUsed,
      customUsed,
      includedRemaining: Math.max(0, includedGrant - includedUsed),
      addonRemaining: Math.max(0, addonGrant - addonUsed),
      customRemaining: Math.max(0, customGrant - customUsed),
      totalUsed,
    };
  },

  splitCreditDeduction(lic, plan, amount) {
    const cost = Math.max(1, Number(amount) || 1);
    const pools = this.resolveCreditGrantPools(lic, plan);
    const fromIncluded = Math.min(cost, pools.includedRemaining);
    const afterIncluded = cost - fromIncluded;
    const fromAddon = Math.min(afterIncluded, pools.addonRemaining);
    const fromCustom = afterIncluded - fromAddon;
    return {
      cost,
      fromIncluded,
      fromAddon,
      fromCustom,
      includedUsed: pools.includedUsed + fromIncluded,
      addonUsed: pools.addonUsed + fromAddon,
      customUsed: pools.customUsed + fromCustom,
      totalUsed: pools.totalUsed + cost,
    };
  },

  isCreditsBilling(mode) {
    return mode === "credits" || mode === "hybrid";
  },

  describeLicenseAccess(lic, plan, resolvedExpiresAt) {
    const mode = this.resolveBillingMode(lic, plan);
    const unlimitedTime = this.resolveUnlimitedTime(lic, plan);
    const credits = this.resolveCreditsBalance(lic);
    const expired =
      !unlimitedTime &&
      resolvedExpiresAt &&
      new Date() > new Date(resolvedExpiresAt);

    if (this.licenseHasAccess(lic, plan, resolvedExpiresAt)) {
      return {
        accessStatus: "active",
        reason: "",
        needsTopUp: false,
        needsRenewal: false,
        reactivatable: true,
      };
    }

    if (mode === "credits" || (mode === "hybrid" && credits <= 0 && !expired)) {
      return {
        accessStatus: "credits_exhausted",
        reason: "Credits exhausted — buy more credits to continue",
        needsTopUp: true,
        needsRenewal: false,
        reactivatable: true,
      };
    }

    if (expired) {
      return {
        accessStatus: "expired",
        reason: "License expired — renew to continue with the same key",
        needsTopUp: false,
        needsRenewal: true,
        reactivatable: true,
      };
    }

    return {
      accessStatus: "inactive",
      reason: "License inactive — contact support or renew",
      needsTopUp: this.isCreditsBilling(mode),
      needsRenewal: true,
      reactivatable: true,
    };
  },

  licenseHasAccess(lic, plan, resolvedExpiresAt) {
    const mode = this.resolveBillingMode(lic, plan);
    const unlimitedTime = this.resolveUnlimitedTime(lic, plan);
    const unlimitedCredits = this.resolveUnlimitedCredits(lic, plan);
    const credits = this.resolveCreditsBalance(lic);
    const expired =
      !unlimitedTime &&
      resolvedExpiresAt &&
      new Date() > new Date(resolvedExpiresAt);

    if (mode === "credits") {
      return unlimitedCredits || credits > 0;
    }
    if (mode === "hybrid") {
      if (expired) return false;
      return unlimitedCredits || credits > 0;
    }
    // subscription — never expires, open-ended, or not past expiry
    if (unlimitedTime) return true;
    if (!resolvedExpiresAt) return true;
    if (expired) return false;
    return true;
  },

  resolveDeviceBinding(lic, machineId, plan) {
    const deviceIds = this.getDeviceIds(lic);
    const unlimitedDevices = this.resolveUnlimitedDevices(lic, plan);
    const maxDevices = this.resolveMaxDevices(lic, plan);

    if (deviceIds.includes(machineId)) {
      return { ok: true, deviceIds, maxDevices, unlimitedDevices, registered: false };
    }

    if (unlimitedDevices) {
      return {
        ok: true,
        deviceIds: [...deviceIds, machineId],
        maxDevices: 0,
        unlimitedDevices: true,
        registered: true,
      };
    }

    if (deviceIds.length >= maxDevices) {
      const tier =
        maxDevices <= 1
          ? "Standard (1 device)"
          : maxDevices <= 3
            ? `Family (${maxDevices} devices)`
            : `Friends (${maxDevices} devices)`;
      return {
        ok: false,
        reason: `Device limit reached (${deviceIds.length}/${maxDevices}). This license is ${tier}. Upgrade for more devices.`,
        deviceIds,
        maxDevices,
      };
    }
    return {
      ok: true,
      deviceIds: [...deviceIds, machineId],
      maxDevices,
      unlimitedDevices: false,
      registered: true,
    };
  },

  buildLicensePayload(lic, plan, extras = {}) {
    const deviceIds = extras.deviceIds || this.getDeviceIds(lic);
    const unlimitedDevices =
      extras.unlimitedDevices ??
      this.resolveUnlimitedDevices(lic, plan);
    const maxDevices = unlimitedDevices
      ? 0
      : extras.maxDevices ?? this.resolveMaxDevices(lic, plan);
    const mode = this.resolveBillingMode(lic, plan);
    const unlimitedTime =
      extras.unlimitedTime ?? this.resolveUnlimitedTime(lic, plan);
    const unlimitedCredits =
      extras.unlimitedCredits ?? this.resolveUnlimitedCredits(lic, plan);
    return {
      key: extras.key,
      planType: lic.planType || lic.plan_type || lic.planId || "premium",
      planId: lic.planId || lic.plan_id || lic.planType,
      planName:
        extras.planName ||
        plan?.name ||
        lic.plan_name ||
        lic.planName ||
        lic.planId ||
        lic.plan_type ||
        "Premium",
      planKind:
        lic.plan_kind ||
        lic.planKind ||
        plan?.plan_kind ||
        plan?.planKind ||
        "subscription",
      planDays: extras.planDays,
      billingMode: mode,
      maxDevices,
      unlimitedDevices,
      unlimitedTime,
      unlimitedCredits,
      deviceCount: deviceIds.length,
      deviceIds,
      creditsBalance:
        extras.creditsBalance ?? this.resolveCreditsBalance(lic),
      includedCredits:
        extras.includedCredits ??
        (Number(lic.included_credits ?? lic.includedCredits ?? 0) || 0),
      addonCredits:
        extras.addonCredits ??
        (Number(lic.addon_credits ?? lic.addonCredits ?? 0) || 0),
      customCredits:
        extras.customCredits ??
        (Number(lic.custom_credits ?? lic.customCredits ?? lic.bonus_credits ?? lic.bonusCredits ?? 0) || 0),
      customCreditsLabel:
        extras.customCreditsLabel ??
        String(lic.custom_credits_label ?? lic.customCreditsLabel ?? "").trim(),
      addonCreditIds: extras.addonCreditIds ?? this.getLicenseAddonIds(lic),
      creditsUsed: Number(lic.credits_used ?? lic.creditsUsed ?? 0) || 0,
      includedCreditsUsed:
        extras.includedCreditsUsed ??
        this.resolveCreditGrantPools(lic, plan).includedUsed,
      addonCreditsUsed:
        extras.addonCreditsUsed ??
        this.resolveCreditGrantPools(lic, plan).addonUsed,
      customCreditsUsed:
        extras.customCreditsUsed ??
        this.resolveCreditGrantPools(lic, plan).customUsed,
      includedCreditsRemaining:
        extras.includedCreditsRemaining ??
        this.resolveCreditGrantPools(lic, plan).includedRemaining,
      addonCreditsRemaining:
        extras.addonCreditsRemaining ??
        this.resolveCreditGrantPools(lic, plan).addonRemaining,
      customCreditsRemaining:
        extras.customCreditsRemaining ??
        this.resolveCreditGrantPools(lic, plan).customRemaining,
      imagesGeneratedTotal:
        Number(lic.images_generated_total ?? lic.imagesGeneratedTotal ?? 0) || 0,
      imagesGeneratedToday:
        Number(lic.images_generated_today ?? lic.imagesGeneratedToday ?? 0) || 0,
      imagesGeneratedTodayDate:
        lic.images_generated_today_date || lic.imagesGeneratedTodayDate || "",
      imagesGeneratedMonth:
        Number(lic.images_generated_month ?? lic.imagesGeneratedMonth ?? 0) || 0,
      imagesGeneratedMonthKey:
        lic.images_generated_month_key || lic.imagesGeneratedMonthKey || "",
      expiresAt: unlimitedTime
        ? null
        : extras.expiresAt || lic.expiresAt || lic.expires_at || null,
      activatedAt:
        extras.activatedAt || lic.activatedAt || lic.activated_at || null,
      accessStatus: extras.accessStatus || lic.access_status || lic.accessStatus || "active",
      customerName: lic.customer_name || lic.customerName || "",
      customerPhone: lic.customer_phone || lic.customerPhone || "",
      customerEmail: lic.customer_email || lic.customerEmail || "",
      customerAddress: lic.customer_address || lic.customerAddress || "",
      customerLocation: lic.customer_location || lic.customerLocation || "",
      licenseCustomPlan:
        lic.license_custom_plan || lic.licenseCustomPlan || null,
      licenseCustomPlans:
        lic.license_custom_plans || lic.licenseCustomPlans || null,
      hideCustomPlan: !!(lic.hide_custom_plan || lic.hideCustomPlan),
      disableCustomPlan: !!(lic.disable_custom_plan || lic.disableCustomPlan),
      hideLicenseCustomPlans: !!(
        lic.hide_license_custom_plans || lic.hideLicenseCustomPlans
      ),
      disableLicenseCustomPlans: !!(
        lic.disable_license_custom_plans || lic.disableLicenseCustomPlans
      ),
    };
  },

  normalizeKey(key) {
    return CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(key)
      : String(key || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "-");
  },

  /** MEESHO-XXXX-XXXX-XXXX — 4-char segments, uppercase alphanumeric */
  generateLicenseKey() {
    const seg = () => {
      let s = Math.random().toString(36).substring(2, 6).toUpperCase();
      while (s.length < 4) s += "X";
      return s.substring(0, 4);
    };
    return `MEESHO-${seg()}-${seg()}-${seg()}`;
  },

  async licenseKeyExists(key) {
    const normalized = this.normalizeKey(key);
    if (!normalized) return true;
    const lic = await this.fetchDoc("licenses", normalized);
    if (lic) return true;
    const demoKeys = await this.getDemoKeysMap();
    return !!demoKeys[normalized];
  },

  async generateUniqueLicenseKey(maxAttempts = 12) {
    for (let i = 0; i < maxAttempts; i++) {
      const key = this.generateLicenseKey();
      if (!(await this.licenseKeyExists(key))) return key;
    }
    const tail = Date.now().toString(36).toUpperCase().slice(-8);
    return `MEESHO-${tail.slice(0, 4)}-${tail.slice(4)}-UNIQ`;
  },

  async getPlanById(planId) {
    if (!planId) return null;
    const all = await this.getAllPlans();
    const key = String(planId).trim().toLowerCase();
    return (
      all.find(
        (p) =>
          p.id === key ||
          p.id === planId ||
          this.slugifyPlanId(planId) === p.id,
      ) || null
    );
  },

  async getAllPlans(forceFresh = false) {
    const app = await this.getAppConfig(forceFresh);
    const parsed = this.parsePlansRaw(app?.plans || app?.pricing);
    const list = parsed?.length
      ? parsed
      : this.defaultPlans().map((p, i) => ({ ...p, order: i }));
    return this.sortPlans(list);
  },

  async getPricingPlans(forceFresh = false) {
    const all = await this.getAllPlans(forceFresh);
    const active = all.filter((p) => this.isPlanVisible(p));
    const plans = this.ensureSingleBestPlan(active);
    return plans.length ? plans : this.defaultPlans().filter((p) => this.isPlanVisible(p));
  },

  async resolvePlanDays(lic) {
    const planId = lic.planId || lic.plan_id || lic.planType || lic.plan_type;
    const plan = planId ? await this.getPlanById(planId) : null;
    if (this.resolveUnlimitedTime(lic, plan)) return 0;
    if (lic.planDays != null) return Number(lic.planDays) || 0;
    if (lic.plan_days != null) return Number(lic.plan_days) || 0;
    if (plan) return plan.days;
    return 365;
  },

  /** Expiry from activation time + plan days; days 0 = unlimited (no expiry) */
  computeExpiresAt(activatedAtIso, planDays) {
    const days = Number(planDays);
    if (!days || days <= 0) return null;
    const start = activatedAtIso ? new Date(activatedAtIso) : new Date();
    return new Date(start.getTime() + days * 86400000).toISOString();
  },

  planGridColumns(count) {
    if (count <= 1) return "1fr";
    if (count === 3) return "1fr 1fr";
    return "1fr 1fr";
  },

  async getAppConfig(force = false) {
    if (
      !force &&
      this._configCache &&
      Date.now() - this._configCacheTime < this._cacheTtlMs
    ) {
      return this._configCache;
    }
    const doc = await this.fetchDoc("config", "app");
    this._configCache = doc;
    this._configCacheTime = Date.now();
    return doc;
  },

  isExtensionEnabled() {
    const app = this._configCache;
    if (!app) return true;
    return app.extension_enabled !== false && app.extensionEnabled !== false;
  },

  async getAnnouncement() {
    const app = await this.getAppConfig();
    return (app?.announcement || "").trim();
  },

  async isExtensionEnabledRemote() {
    const app = await this.getAppConfig();
    return app?.extension_enabled !== false && app?.extensionEnabled !== false;
  },

  async getWhatsAppSettings() {
    const app = await this.getAppConfig();
    return {
      number:
        app?.whatsapp_number ||
        app?.whatsappNumber ||
        CONFIG.DEFAULT_WHATSAPP,
      message:
        app?.whatsapp_message ||
        app?.whatsappMessage ||
        CONFIG.DEFAULT_WHATSAPP_MESSAGE,
    };
  },

  async getDemoKeysMap() {
    const merged = {};
    const app = await this.getAppConfig();

    const ingestInline = (raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
      for (const [rawKey, row] of Object.entries(raw)) {
        const key = CONFIG.normalizeLicenseKey
          ? CONFIG.normalizeLicenseKey(rawKey)
          : String(rawKey || "").toUpperCase();
        if (!key) continue;
        merged[key] = this.normalizeDemoKeyEntry(row);
      }
    };

    for (const [rawKey, row] of Object.entries(CONFIG.BUILTIN_DEMO_KEYS || {})) {
      const key = CONFIG.normalizeLicenseKey
        ? CONFIG.normalizeLicenseKey(rawKey)
        : String(rawKey || "").toUpperCase();
      if (!key) continue;
      merged[key] = this.normalizeDemoKeyEntry(row);
    }

    ingestInline(app?.demo_keys);
    ingestInline(app?.demoKeys);

    const docs = await this.listDocs("demo_keys");
    for (const row of docs) {
      if (row.active === false) continue;
      const key = CONFIG.normalizeLicenseKey
        ? CONFIG.normalizeLicenseKey(row.id)
        : String(row.id || "").toUpperCase();
      if (!key) continue;
      merged[key] = this.normalizeDemoKeyEntry(row);
    }
    return merged;
  },

  normalizeDemoKeyEntry(row) {
    const src = row && typeof row === "object" ? row : {};
    const unlimited_time = this.isUnlimitedFlag(
      src.unlimited_time ?? src.unlimitedTime,
    );
    const daysRaw = src.days;
    const days =
      unlimited_time && (daysRaw === 0 || daysRaw === "0")
        ? 0
        : Number(daysRaw) || 30;
    return {
      days,
      label: src.label || src.name || "",
      unlimited_time,
    };
  },

  async verifyPaidLicense(licenseKey, machineId) {
    const key = CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(licenseKey)
      : String(licenseKey || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "-");

    let lic = await this.fetchDoc("licenses", key);
    if (!lic) {
      return { valid: false, reason: "License key not found" };
    }

    const appCfg = await this.getAppConfig();
    if (
      appCfg?.extension_enabled === false ||
      appCfg?.extensionEnabled === false
    ) {
      return {
        valid: false,
        reason: "Extension licensing is temporarily disabled",
      };
    }

    if (lic.active === false) {
      return { valid: false, reason: "License deactivated" };
    }

    const plan = await this.getPlanById(
      lic.planId || lic.plan_id || lic.planType || lic.plan_type,
    );
    const planDays = await this.resolvePlanDays(lic);
    let billingMode = this.inferLicenseBillingMode(lic, plan);
    const maxDevices = this.resolveMaxDevices(lic, plan);
    const unlimitedTime = this.resolveUnlimitedTime(lic, plan);
    const unlimitedCredits = this.resolveUnlimitedCredits(lic, plan);

    let resolvedExpiresAt = lic.expiresAt || lic.expires_at || null;
    let resolvedActivatedAt = lic.activatedAt || lic.activated_at || null;
    let deviceIds = this.getDeviceIds(lic);
    let creditsBalance = this.resolveCreditsBalance(lic);

    const binding = this.resolveDeviceBinding(lic, machineId, plan);
    if (!binding.ok) {
      return { valid: false, reason: binding.reason };
    }
    deviceIds = binding.deviceIds;

    const isFirstActivation = !resolvedActivatedAt;
    const needsDevicePatch =
      binding.registered || isFirstActivation;

    if (isFirstActivation || needsDevicePatch) {
      const activatedAt = resolvedActivatedAt || new Date().toISOString();
      resolvedActivatedAt = activatedAt;
      const expiryOnActivation =
        lic.expiry_starts_on_activation !== false &&
        lic.expiryStartsOnActivation !== false;

      if (
        billingMode !== "credits" &&
        !unlimitedTime &&
        (expiryOnActivation || !resolvedExpiresAt)
      ) {
        resolvedExpiresAt = this.computeExpiresAt(activatedAt, planDays);
      }

      // Grant credits on first activation from included + selected add-ons.
      // Priority: existing balance > lic included+addon > plan + lic addon ids.
      const creditInfo = this.resolveLicenseCredits(lic, plan);
      const grantCredits =
        this.resolveCreditsBalance(lic) <= 0 && creditInfo.total > 0;
      if (grantCredits && !unlimitedCredits) {
        creditsBalance = creditInfo.total;
      }

      const patch = {
        device_ids: deviceIds,
        machineId: deviceIds[0] || machineId,
        activatedAt: resolvedActivatedAt,
        lastVerifiedAt: activatedAt,
        max_devices: maxDevices,
        billing_mode: billingMode,
        unlimited_time: unlimitedTime,
        unlimited_devices: !!binding.unlimitedDevices,
        unlimited_credits: unlimitedCredits,
      };
      if (resolvedExpiresAt) patch.expiresAt = resolvedExpiresAt;
      else if (unlimitedTime) patch.expiresAt = "";
      if (grantCredits && !unlimitedCredits) {
        // Store the credit breakdown so subscription plans can still expose
        // add-on credits for hybrid use, and display can show base + addon.
        patch.included_credits = creditInfo.included;
        patch.addon_credits = creditInfo.addon;
        patch.custom_credits = creditInfo.custom;
        patch.addon_credit_ids = creditInfo.addonIds;
        patch.credits_balance = creditInfo.total;
      }

      let googleUser = null;
      if (typeof FirebaseAuth !== "undefined") {
        googleUser = await FirebaseAuth.getCurrentUser();
      }
      const customerPatch = this.buildLicenseCustomerPatch(lic, {
        googleUser,
        location: this.guessClientLocation(),
      });
      Object.assign(patch, customerPatch);
      if (creditInfo.addon > 0 || creditInfo.custom > 0) {
        patch.billing_mode = "hybrid";
        billingMode = "hybrid";
      } else if (!lic?.billing_mode && !lic?.billingMode) {
        patch.billing_mode = billingMode;
      }

      await this.patchDoc("licenses", key, patch, Object.keys(patch));
      lic = { ...lic, ...patch };
    } else {
      await this.patchDoc(
        "licenses",
        key,
        { lastVerifiedAt: new Date().toISOString() },
        ["lastVerifiedAt"],
      );
    }

    if (
      !this.licenseHasAccess(
        { ...lic, credits_balance: creditsBalance },
        plan,
        resolvedExpiresAt,
      )
    ) {
      const access = this.describeLicenseAccess(
        { ...lic, credits_balance: creditsBalance },
        plan,
        resolvedExpiresAt,
      );
      const finalCreditInfo = this.resolveLicenseCredits(
        { ...lic, credits_balance: creditsBalance },
        plan,
      );
      return {
        valid: false,
        reactivatable: true,
        license: this.buildLicensePayload(lic, plan, {
          key,
          planDays,
          planName: plan?.name,
          deviceIds,
          maxDevices,
          unlimitedTime,
          unlimitedCredits,
          unlimitedDevices: binding.unlimitedDevices,
          creditsBalance,
          includedCredits: finalCreditInfo.included,
          addonCredits: finalCreditInfo.addon,
          addonCreditIds: finalCreditInfo.addonIds,
          expiresAt: resolvedExpiresAt,
          activatedAt: resolvedActivatedAt,
          accessStatus: access.accessStatus,
        }),
        reason: access.reason,
        needsTopUp: access.needsTopUp,
        needsRenewal: access.needsRenewal,
        accessStatus: access.accessStatus,
        creditsBalance,
      };
    }

    const finalCreditInfo = this.resolveLicenseCredits(
      { ...lic, credits_balance: creditsBalance },
      plan,
    );

    return {
      valid: true,
      license: this.buildLicensePayload(lic, plan, {
        key,
        planDays,
        planName: plan?.name,
        deviceIds,
        maxDevices,
        unlimitedTime,
        unlimitedCredits,
        unlimitedDevices: binding.unlimitedDevices,
        creditsBalance,
        includedCredits: finalCreditInfo.included,
        addonCredits: finalCreditInfo.addon,
        addonCreditIds: finalCreditInfo.addonIds,
        expiresAt: resolvedExpiresAt,
        activatedAt: resolvedActivatedAt,
      }),
    };
  },

  async refreshLicenseFromFirebase(licenseKey, machineId) {
    const key = this.normalizeKey(licenseKey);
    const lic = await this.fetchDoc("licenses", key);
    if (!lic || lic.active === false) {
      return { valid: false, reason: "License not found or deactivated" };
    }
    const plan = await this.getPlanById(
      lic.planId || lic.plan_id || lic.planType || lic.plan_type,
    );
    const deviceIds = this.getDeviceIds(lic);
    const unlimitedDevices = this.resolveUnlimitedDevices(lic, plan);
    if (
      machineId &&
      deviceIds.length &&
      !deviceIds.includes(machineId) &&
      !unlimitedDevices
    ) {
      return { valid: false, reason: "This device is not registered on this license" };
    }
    const resolvedExpiresAt = lic.expiresAt || lic.expires_at || null;
    const payloadExtras = {
      key,
      planDays: await this.resolvePlanDays(lic),
      planName: plan?.name,
      deviceIds,
      maxDevices: this.resolveMaxDevices(lic, plan),
      unlimitedTime: this.resolveUnlimitedTime(lic, plan),
      unlimitedCredits: this.resolveUnlimitedCredits(lic, plan),
      unlimitedDevices,
      creditsBalance: this.resolveCreditsBalance(lic),
      expiresAt: resolvedExpiresAt,
      activatedAt: lic.activatedAt || lic.activated_at,
    };
    const creditInfo = this.resolveLicenseCredits(lic, plan);
    payloadExtras.includedCredits = creditInfo.included;
    payloadExtras.addonCredits = creditInfo.addon;
    payloadExtras.addonCreditIds = creditInfo.addonIds;

    if (!this.licenseHasAccess(lic, plan, resolvedExpiresAt)) {
      const access = this.describeLicenseAccess(lic, plan, resolvedExpiresAt);
      return {
        valid: false,
        reactivatable: true,
        license: this.buildLicensePayload(lic, plan, {
          ...payloadExtras,
          accessStatus: access.accessStatus,
        }),
        reason: access.reason,
        needsTopUp: access.needsTopUp,
        needsRenewal: access.needsRenewal,
        accessStatus: access.accessStatus,
      };
    }
    return {
      valid: true,
      license: this.buildLicensePayload(lic, plan, {
        ...payloadExtras,
        accessStatus: "active",
      }),
      accessStatus: "active",
    };
  },

  async deductCredits(licenseKey, amount) {
    if (!this.isEnabled()) {
      return { ok: false, reason: "Firebase unavailable" };
    }
    const key = this.normalizeKey(licenseKey);
    const lic = await this.fetchDoc("licenses", key);
    if (!lic) return { ok: false, reason: "License not found" };

    const plan = await this.getPlanById(
      lic.planId || lic.plan_id || lic.planType || lic.plan_type,
    );
    if (this.resolveUnlimitedCredits(lic, plan)) {
      return { ok: true, skipped: true, unlimited: true };
    }
    const cfg = await this.getCreditsConfig();
    const cost = Math.max(1, Number(amount) || cfg.cost_per_operation || 1);
    const balance = this.resolveCreditsBalance(lic);
    if (balance < cost) {
      return {
        ok: false,
        reason: "Insufficient credits",
        balance,
        needsTopUp: true,
      };
    }

    const split = this.splitCreditDeduction(lic, plan, cost);
    const newBalance = balance - cost;
    const ok = await this.patchDoc(
      "licenses",
      key,
      {
        credits_balance: newBalance,
        credits_used: split.totalUsed,
        included_credits_used: split.includedUsed,
        addon_credits_used: split.addonUsed,
        custom_credits_used: split.customUsed,
      },
      ["credits_balance", "credits_used", "included_credits_used", "addon_credits_used", "custom_credits_used"],
    );
    if (!ok) return { ok: false, reason: "Could not update credits" };

    return {
      ok: true,
      balance: newBalance,
      used: split.totalUsed,
      deducted: cost,
      fromIncluded: split.fromIncluded,
      fromAddon: split.fromAddon,
      fromCustom: split.fromCustom,
      includedCreditsUsed: split.includedUsed,
      addonCreditsUsed: split.addonUsed,
      customCreditsUsed: split.customUsed,
    };
  },

  async unbindDevice(licenseKey, machineId) {
    const key = this.normalizeKey(licenseKey);
    if (!key || !machineId) return { ok: false, reason: "Missing key or device" };
    const lic = await this.fetchDoc("licenses", key);
    if (!lic) return { ok: true, skipped: true };
    const deviceIds = this.getDeviceIds(lic).filter((id) => id !== machineId);
    const ok = await this.patchDoc(
      "licenses",
      key,
      {
        device_ids: deviceIds,
        machineId: deviceIds[0] || "",
      },
      ["device_ids", "machineId"],
    );
    return { ok };
  },

  renderPlanButtons(container, plans, variant = "modal") {
    if (!container) return;
    const list = this.ensureSingleBestPlan(
      plans?.length ? plans : this.defaultPlans(),
    );

    container.style.display = "grid";
    container.style.gridTemplateColumns = this.planGridColumns(list.length);
    container.style.gap = container.style.gap || "8px";

    if (!list.length) {
      container.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:12px;color:#9ca3af;font-size:11px;">No plans available — add plans in Firebase config.</div>';
      return;
    }

    if (variant === "popup") {
      container.innerHTML = list
        .map((p) => {
          const bestClass = p.best ? " best" : "";
          const tag = p.best
            ? `<span class="plan-best-tag">BEST VALUE</span>`
            : "";
          const offerBadges = this.planOfferBadgesSlotHtml(p);
          const durationLabel = this.formatPlanDurationLabel(p);
          const subtitleText = this.formatPlanCardSubtitle(p);
          const subtitle = `<div class="plan-note plan-subtitle-slot" style="color:var(--mso-muted);">${subtitleText ? this.escapeHtml(subtitleText) : "&nbsp;"}</div>`;
          const save = this.planSaveSlotHtml(
            p.save ? this.formatPlanSaveLabel(p) : "",
          );
          const nameStyle = p.best ? ' style="margin-top:4px;"' : "";
          const priceStyle = p.best
            ? ' style="color:var(--mso-success);"'
            : "";
          const btn = `<button type="button" class="plan-btn plan-buy-btn plan-card-main${bestClass}" ${this.planDataAttrs(p, durationLabel)}>
            ${tag}
            ${offerBadges}
            <div class="plan-name"${nameStyle}>${p.name}</div>
            <div class="plan-price"${priceStyle}>₹${p.price}</div>
            ${subtitle}
            ${save}
            ${this.planCardFooterHtml(p)}
          </button>`;
          return this.planCardShell(btn, p, "plan");
        })
        .join("");
      this.wirePlanAddonSelection(container);
      return;
    }

    container.innerHTML = list
      .map((p) => {
        const best = p.best
          ? `border:2px solid #e67e22;background:linear-gradient(180deg,#fff8ee,#fff);position:relative;`
          : `border:1px solid #f0e0c8;background:#fff;`;
        const tag = p.best
          ? `<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#ffd700,#e67e22);color:#fff;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:700;">BEST VALUE</div>`
          : "";
        const offerBadges = this.planOfferBadgesSlotHtml(p);
        const durationLabel = this.formatPlanDurationLabel(p);
        const subtitleText = this.formatPlanCardSubtitle(p);
        const subtitle = subtitleText
          ? `<div style="font-size:9px;color:#6b7280;">${this.escapeHtml(subtitleText)}</div>`
          : "";
        const save = p.save
          ? `<div style="font-size:9px;color:#10b981;font-weight:700;">${this.escapeHtml(this.formatPlanSaveLabel(p))}</div>`
          : "";
        const btn = `<button type="button" class="plan-buy-btn plan-card-main" ${this.planDataAttrs(p, durationLabel)} style="${best}border-radius:8px;padding:10px 28px 10px 10px;text-align:center;cursor:pointer;color:#1f2937;width:100%;">
          ${tag}
          ${offerBadges}
          <div style="font-size:11px;color:#6b7280;${p.best ? "margin-top:4px;" : ""}">${p.name}</div>
          <div style="font-size:20px;font-weight:700;color:#e67e22;">₹${p.price}</div>
          ${subtitle}
          ${save}
          ${this.planCardFooterHtml(p)}
        </button>`;
        return this.planCardShell(btn, p, "plan");
      })
      .join("");

    this.wirePlanAddonSelection(container);
  },

  /** ₹/credit for add-on badge vs base pack rate. */
  formatAddonValueBadge(addon, basePricePerCredit) {
    const credits = Number(addon?.credits) || 0;
    const price = Number(addon?.price) || 0;
    if (!credits || !price) return "Add-on";
    const ppc = price / credits;
    const base = Number(basePricePerCredit) || 2;
    if (ppc < base * 0.99) {
      const pct = Math.round((1 - ppc / base) * 100);
      if (pct > 0) return `${pct}% off`;
    }
    return "Add-on";
  },

  formatAddonSaveLabel(addon, basePricePerCredit) {
    const credits = Number(addon?.credits) || 0;
    const price = Number(addon?.price) || 0;
    const base = Number(basePricePerCredit) || 2;
    if (!credits || !price || base <= 0) return "";
    const fullPrice = credits * base;
    if (price >= fullPrice * 0.99) return "";
    const save = Math.round(fullPrice - price);
    const pct = Math.round((1 - price / fullPrice) * 100);
    if (save <= 0 || pct <= 0) return "";
    return `Save ₹${save.toLocaleString("en-IN")} (${pct}% off)`;
  },

  addonOfferBadgesHtml(addon, basePricePerCredit) {
    const explicit = this.parseOfferBadges(addon?.offer_badges ?? addon?.offerBadges);
    const badges = explicit.length ? [...explicit] : [];
    if (!badges.length) {
      const computed = this.formatAddonValueBadge(addon, basePricePerCredit);
      if (computed && computed !== "Add-on") badges.push(computed);
      else badges.push("Add-on");
    }
    return `<div class="plan-offer-badges">${badges
      .map((b) => `<span class="plan-offer-badge">${this.escapeHtml(b)}</span>`)
      .join("")}</div>`;
  },

  renderAddonCreditDetailHtml(addon, parentPlan, options = {}) {
    if (!addon) {
      return '<p style="font-size:12px;color:#6b7280;">Add-on not found.</p>';
    }
    const basePpc = Number(options.pricePerCredit) || 2;
    const credits = Number(addon.credits) || 0;
    const price = Number(addon.price) || 0;
    const perCredit =
      credits > 0 ? (price / credits).toFixed(2) : "0";
    const save = this.formatAddonSaveLabel(addon, basePpc);
    const planName = parentPlan?.name || "Subscription plan";
    const planSubtitle = parentPlan
      ? this.formatPlanCardSubtitle(parentPlan)
      : "";

    let html = `<div class="plan-detail-card">
      <div class="plan-detail-header">
        <span class="plan-detail-badge" style="background:linear-gradient(135deg,#ffd700,#e67e22);">ADD-ON</span>
        <h2 class="plan-detail-name">${this.escapeHtml(addon.label || `+${credits} credits`)}</h2>
        ${planName ? `<p class="plan-detail-subtitle">With ${this.escapeHtml(planName)}${planSubtitle ? ` · ${this.escapeHtml(planSubtitle)}` : ""}</p>` : ""}
        <div class="plan-detail-price">₹${price}</div>
        <p class="plan-detail-meta">${credits.toLocaleString("en-IN")} credits · ~₹${perCredit}/credit</p>
        ${save ? `<div class="plan-detail-save">${this.escapeHtml(save)}</div>` : ""}
      </div>`;

    if (addon.description) {
      html += `<p class="plan-detail-desc">${this.escapeHtml(addon.description)}</p>`;
    }

    html += `<div class="plan-detail-section">
      <div class="plan-detail-section-title">What you get</div>
      <ul class="plan-detail-list">
        <li>${credits.toLocaleString("en-IN")} extra generation credits at checkout</li>
        <li>Stacks on ${planName} included credits</li>
        <li>One-time add-on with your plan purchase</li>
      </ul>
    </div>`;

    html += `<p class="plan-detail-footer" style="font-size:11px;color:var(--mso-muted);">Select this add-on in the plan details, then tap Buy on WhatsApp.</p>`;
    html += `</div>`;
    return html;
  },

  getAddonCreditById(plan, addonId, catalog) {
    if (!addonId) return null;
    const id = this.slugifyPlanId(addonId);
    const list = Array.isArray(catalog) && catalog.length
      ? catalog
      : plan
        ? this.getPlanCreditAddons(plan, catalog)
        : this.defaultAddonCatalog().map((a, i) =>
            this.normalizeCreditAddon(a, a.id, i),
          );
    return (
      list.find(
        (a) => a.id === id || this.slugifyPlanId(a.id) === id,
      ) || null
    );
  },

  renderAddonCreditCard(addon, parentPlan, options = {}) {
    const enabled = options.enabled !== false;
    const selected = !!options.selected;
    const basePpc = options.pricePerCredit || 2;
    const offerBadges = this.planOfferBadgesSlotHtml(addon, basePpc);
    const subtitle = addon.card_subtitle || `${addon.credits} credits · ₹${addon.price}`;
    const saveLabel = addon.save || this.formatAddonSaveLabel(addon, basePpc);
    const saveHtml = this.planSaveSlotHtml(saveLabel || "");
    const disabledAttr = enabled ? "" : " disabled";
    const pressed = selected ? ' aria-pressed="true"' : ' aria-pressed="false"';
    const selectedClass = selected ? " plan-btn--selected" : "";
    const cardHint =
      addon.card_hint ||
      addon.cardHint ||
      "Tap ℹ️ for details · Tap card to select";
    const btn = `<button type="button" class="plan-btn plan-addon-card plan-addon-btn plan-buy-btn plan-card-main${selectedClass}${enabled ? "" : " plan-addon-card--disabled"}"${disabledAttr}${pressed}
      data-plan="${this.escapeAttr(parentPlan?.id || "")}"
      data-addon-id="${this.escapeAttr(addon.id)}"
      data-addon-credits="${addon.credits}"
      data-addon-price="${addon.price}"
      data-addon-label="${this.escapeAttr(addon.label)}"
      data-addon-max="${Number(parentPlan?.max_addon_selections) || 0}"
      title="${this.escapeAttr(addon.description || subtitle)}">
      ${offerBadges}
      <div class="plan-name">${this.escapeHtml(addon.label || `+${addon.credits} credits`)}</div>
      <div class="plan-price">₹${addon.price}</div>
      <div class="plan-note" style="color:var(--mso-muted);">${this.escapeHtml(subtitle)}</div>
      ${saveHtml}
      ${this.planCardFooterHtml({ card_hint: cardHint })}
    </button>`;
    const shellItem = Object.assign({}, addon, {
      parent_plan_id: parentPlan?.id || "",
      show_details_icon: addon.show_details_icon !== false,
    });
    return this.planCardShell(btn, shellItem, "addon");
  },

  /**
   * Bottom add-on section — disabled until a subscription plan is selected.
   * @param {HTMLElement} container
   * @param {object[]} plans
   * @param {{ selectedPlanId?: string, enabled?: boolean, pricePerCredit?: number, addonCatalog?: object[] }} options
   */
  renderPlanAddonsSection(container, plans, options = {}) {
    const section = document.getElementById("plan-addons-section");
    const contextEl = document.getElementById("plan-addons-context");
    const buyBtn = document.getElementById("plan-purchase-whatsapp-btn");
    const selectedId = options.selectedPlanId || "";
    const enabled = !!options.enabled && !!selectedId;
    const list = plans?.length ? plans : [];
    const catalog = Array.isArray(options.addonCatalog) ? options.addonCatalog : [];

    if (section) {
      section.classList.toggle("plan-addons-section--locked", !enabled);
    }
    if (buyBtn) {
      buyBtn.disabled = !enabled;
    }
    if (!container) return;

    const plan = list.find((p) => p.id === selectedId);
    const addons = plan ? this.getPlanCreditAddons(plan, catalog) : [];

    if (contextEl) {
      if (!enabled) {
        contextEl.textContent =
          "Same add-ons with every plan — select a subscription plan above to unlock.";
      } else if (!addons.length) {
        contextEl.textContent = `${plan?.name || "Plan"} does not support add-ons — tap Buy below.`;
      } else {
        const max = Number(plan.max_addon_selections) || 0;
        const limitHint =
          max === 1
            ? "Pick one add-on (optional)."
            : max > 1
              ? `Pick up to ${max} add-ons (optional).`
              : "Pick any add-ons (optional).";
        const usesCatalog = !((plan.credit_addons || []).filter((a) => a.active !== false).length);
        contextEl.textContent = `${plan.name} · ${limitHint}${usesCatalog ? " Uses shared catalog." : " Per-plan add-ons."}`;
      }
    }

    if (!enabled || !plan) {
      container.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--mso-muted);font-size:10px;">Select a subscription plan to see add-ons</div>';
      return;
    }

    if (!addons.length) {
      container.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--mso-muted);font-size:10px;">No add-ons for this plan — buy the plan directly on WhatsApp.</div>';
      return;
    }

    container.style.display = "grid";
    container.style.gridTemplateColumns = this.planGridColumns(addons.length);
    container.style.gap = container.style.gap || "8px";
    container.innerHTML = addons
      .map((a) =>
        this.renderAddonCreditCard(a, plan, {
          enabled: true,
          selected: !!a.default_selected,
          pricePerCredit: options.pricePerCredit,
        }),
      )
      .join("");
    this.wirePlanAddonSelection(container);
  },

  /** @deprecated Add-ons render inside plan detail — renderPlanAddonsSection kept for legacy UIs. */
  planCellWrap(buttonHtml, _p) {
    return buttonHtml;
  },

  /** Shared data attributes on a plan buy button. */
  planDataAttrs(p, durationLabel) {
    return [
      `data-plan="${this.escapeAttr(p.id)}"`,
      `data-price="${p.price}"`,
      `data-days="${p.days}"`,
      `data-duration="${this.escapeAttr(p.duration || durationLabel)}"`,
      `data-plan-name="${this.escapeAttr(p.name)}"`,
      `data-plan-kind="${this.escapeAttr(p.plan_kind || "")}"`,
      `data-included-credits="${Number(p.included_credits) || 0}"`,
      `data-billing-mode="${this.escapeAttr(p.billing_mode || "subscription")}"`,
      `data-unlimited-credits="${p.unlimited_credits ? "true" : "false"}"`,
    ].join(" ");
  },

  styleAddonChip(chip) {
    if (!chip) return;
    const sel = chip.getAttribute("aria-pressed") === "true";
    if (chip.classList.contains("plan-addon-card")) {
      chip.classList.toggle("plan-btn--selected", sel);
      return;
    }
    chip.style.background = sel
      ? "linear-gradient(135deg,#ffd700,#e67e22)"
      : "#fff";
    chip.style.color = sel ? "#3d2914" : "#c45f12";
    chip.style.border = sel ? "1px solid #e67e22" : "1px solid #f0e0c8";
    chip.style.fontWeight = sel ? "700" : "600";
  },

  addonChipsForPlan(planId, root) {
    const scope = root || document;
    return Array.from(
      scope.querySelectorAll(".plan-addon-btn"),
    ).filter((c) => c.dataset.plan === String(planId));
  },

  toggleAddonChip(chip, root) {
    if (!chip) return;
    const planId = chip.dataset.plan;
    const max = Number(chip.dataset.addonMax) || 0;
    const isSel = chip.getAttribute("aria-pressed") === "true";
    const siblings = this.addonChipsForPlan(planId, root);

    if (!isSel && max === 1) {
      siblings.forEach((c) => {
        if (c !== chip) {
          c.setAttribute("aria-pressed", "false");
          this.styleAddonChip(c);
        }
      });
    }
    if (!isSel && max > 1) {
      const selectedCount = siblings.filter(
        (c) => c.getAttribute("aria-pressed") === "true",
      ).length;
      if (selectedCount >= max) return;
    }
    chip.setAttribute("aria-pressed", isSel ? "false" : "true");
    this.styleAddonChip(chip);
  },

  /** Wire add-on chip toggling within a root; safe to call repeatedly. */
  wirePlanAddonSelection(root) {
    const scope = root || document;
    scope.querySelectorAll(".plan-addon-btn").forEach((chip) => {
      this.styleAddonChip(chip);
      if (chip.dataset.wired === "1") return;
      chip.dataset.wired = "1";
      const handler = (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        this.toggleAddonChip(chip, root);
      };
      chip.addEventListener("click", handler);
    });
    this.wireLicenseCustomPlanOptions(root);
  },

  licenseCustomOptionChips(customPlanId, root) {
    const scope = root || document;
    const key = String(customPlanId || "");
    return Array.from(
      scope.querySelectorAll(".plan-lic-custom-option-btn"),
    ).filter((c) => c.dataset.customPlanId === key);
  },

  getSelectedLicenseCustomOptionChips(root, sectionEl) {
    const scope = sectionEl || root || document;
    return Array.from(
      scope.querySelectorAll(
        '.plan-detail-section--custom .plan-lic-custom-option-btn[aria-pressed="true"]',
      ),
    );
  },

  toggleLicenseCustomOptionChip(chip, root) {
    if (!chip || chip.disabled) return;
    const section = chip.closest(".plan-detail-section--custom");
    if (section?.classList.contains("plan-detail-section--disabled")) return;
    const siblings = section
      ? Array.from(section.querySelectorAll(".plan-lic-custom-option-btn"))
      : this.licenseCustomOptionChips(chip.dataset.customPlanId, root);
    siblings.forEach((c) => {
      if (c !== chip) {
        c.setAttribute("aria-pressed", "false");
        c.classList.remove("plan-btn--selected");
      }
    });
    const isSel = chip.getAttribute("aria-pressed") === "true";
    chip.setAttribute("aria-pressed", isSel ? "false" : "true");
    chip.classList.toggle("plan-btn--selected", !isSel);
  },

  wireLicenseCustomPlanOptions(root) {
    const scope = root || document;
    scope.querySelectorAll(".plan-lic-custom-option-btn").forEach((chip) => {
      if (chip.dataset.wired === "1") return;
      chip.dataset.wired = "1";
      chip.addEventListener("click", (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        if (chip.disabled) return;
        const section = chip.closest(".plan-detail-section--custom");
        if (section?.classList.contains("plan-detail-section--disabled")) return;
        this.toggleLicenseCustomOptionChip(chip, root);
      });
    });
  },

  getSelectedAddonIds(planId, root) {
    return this.addonChipsForPlan(planId, root)
      .filter((c) => c.getAttribute("aria-pressed") === "true")
      .map((c) => c.dataset.addonId);
  },

  /** Build a WhatsApp purchase message from the selected plan + add-ons. */
  buildPlanPurchaseMessage(planId, productName, root) {
    const scope = root || document;
    const planKey = String(planId);
    const btn =
      scope.querySelector(`.plan-detail-buy-btn[data-plan="${planKey}"]`) ||
      Array.from(
        scope.querySelectorAll(".plan-buy-btn.plan-card-main:not(.plan-addon-card)"),
      ).find((b) => b.dataset.plan === planKey);
    const name =
      btn?.dataset.planName || btn?.dataset.duration || "Plan";
    const price = Number(btn?.dataset.price) || 0;
    const included = Number(btn?.dataset.includedCredits) || 0;
    const unlimitedCredits = btn?.dataset.unlimitedCredits === "true";

    const selChips = this.addonChipsForPlan(planId, root).filter(
      (c) => c.getAttribute("aria-pressed") === "true",
    );
    let addonCredits = 0;
    let addonPrice = 0;
    const labels = [];
    const addonIds = [];
    selChips.forEach((c) => {
      addonCredits += Number(c.dataset.addonCredits) || 0;
      addonPrice += Number(c.dataset.addonPrice) || 0;
      labels.push(
        c.dataset.addonLabel || `${c.dataset.addonCredits} credits`,
      );
      if (c.dataset.addonId) addonIds.push(c.dataset.addonId);
    });
    const total = price + addonPrice;

    let msg = `Hi! I want to purchase ${productName || "Shipping Optimizer"}.\n\n📦 *Plan:* ${name} — ₹${price}`;
    if (labels.length) {
      msg += `\n⚡ *Add-ons:* ${labels.join(", ")} — +₹${addonPrice}`;
      if (addonIds.length) {
        msg += `\n🆔 *Add-on IDs:* ${addonIds.join(", ")}`;
      }
    }
    msg += `\n💳 *Total:* ₹${total}`;
    if (!unlimitedCredits && (included > 0 || addonCredits > 0)) {
      msg += `\n🎫 *Credits:* ${included} base`;
      if (addonCredits > 0) {
        msg += ` + ${addonCredits} addon = ${included + addonCredits}`;
      }
    }
    msg += `\n\nPlease share payment details and license key.`;
    return msg;
  },

  buildCustomPlanPurchaseMessage(
    planId,
    productName,
    root,
    creditsConfig,
    customPlanCfg,
    licenseContext,
    plan,
  ) {
    const scope = root || document;
    const planKey = String(planId);
    const parentPlan = plan || null;
    const btn =
      scope.querySelector(`.plan-detail-buy-btn[data-plan="${planKey}"]`) ||
      scope.querySelector(`.plan-detail-custom-plan-btn[data-plan="${planKey}"]`) ||
      scope.querySelector(".plan-detail-custom-plan-btn");
    if (
      btn &&
      !this.isCustomPlanPurchaseAllowed(btn, parentPlan, licenseContext)
    ) {
      return null;
    }
    const name = btn?.dataset?.planName || btn?.dataset?.duration || "Plan";
    const price = Number(btn?.dataset?.price) || 0;
    const included = Number(btn?.dataset?.includedCredits) || 0;
    const cfg = customPlanCfg
      ? this.normalizeCustomPlanConfig(customPlanCfg)
      : this.normalizeCustomPlanConfig(creditsConfig?.custom_plan);
    const customSection = cfg.id
      ? Array.from(
          scope.querySelectorAll(".plan-detail-section--custom"),
        ).find((el) => el.dataset.customPlanId === String(cfg.id))
      : null;
    const licOptChips =
      cfg.source === "license"
        ? (customSection
            ? Array.from(
                customSection.querySelectorAll(
                  '.plan-lic-custom-option-btn[aria-pressed="true"]',
                ),
              )
            : this.getSelectedLicenseCustomOptionChips(scope))
        : [];
    const selChips = this.addonChipsForPlan(planId, root).filter(
      (c) => c.getAttribute("aria-pressed") === "true",
    );
    let addonPrice = 0;
    let optionPrice = 0;
    const labels = [];
    const addonIds = [];
    selChips.forEach((c) => {
      addonPrice += Number(c.dataset.addonPrice) || 0;
      labels.push(c.dataset.addonLabel || `${c.dataset.addonCredits} credits`);
      if (c.dataset.addonId) addonIds.push(c.dataset.addonId);
    });
    licOptChips.forEach((c) => {
      optionPrice += Number(c.dataset.optionPrice) || 0;
      labels.push(
        c.dataset.optionLabel ||
          `${c.dataset.optionCredits} credits · ₹${c.dataset.optionPrice}`,
      );
    });
    const total = price + addonPrice + optionPrice;
    let msg = `Hi! I want a custom ${productName || "Shipping Optimizer"} package.\n\n🛠 *${cfg.whatsapp_title}*\n📦 *Base subscription:* ${name} — ₹${price}`;
    if (licOptChips.length) {
      msg += `\n🎫 *Selected bundle:* ${labels.slice(-licOptChips.length).join(", ")} — ₹${optionPrice}`;
    } else if (labels.length && cfg.allow_addon_selection) {
      msg += `\n⚡ *Custom add-ons:* ${labels.join(", ")} — +₹${addonPrice}`;
      if (addonIds.length) {
        msg += `\n🆔 *Add-on IDs:* ${addonIds.join(", ")}`;
      }
    }
    msg += `\n💳 *Estimated total:* ₹${total}`;
    if (included > 0) msg += `\n🎫 *Included credits:* ${included}`;
    msg += `\n\nPlease confirm my custom package and assign/update my license.`;
    return msg;
  },

  buildGlobalAddonPurchaseMessage(
    addonId,
    productName,
    root,
    activePlan,
    creditsConfig,
  ) {
    const scope = root || document;
    const catalog = this.resolveFullAddonCatalog(creditsConfig, null);
    const addon = catalog.find(
      (a) => a.id === addonId || this.slugifyPlanId(a.id) === this.slugifyPlanId(addonId),
    );
    if (!addon) {
      return `Hi! I want to purchase a credit add-on for ${productName || "Shipping Optimizer"}.`;
    }
    const planName = activePlan?.name || "My plan";
    const planId = activePlan?.id || "";
    let msg = `Hi! I want to top up ${productName || "Shipping Optimizer"}.\n\n⚡ *Credit add-on:* ${addon.label || addon.name} — ₹${addon.price} (${addon.credits} credits)`;
    msg += `\n🆔 *Add-on ID:* ${addon.id}`;
    if (planName) msg += `\n📦 *Current plan:* ${planName}${planId ? ` (${planId})` : ""}`;
    msg += `\n\nPlease share payment details and add these credits to my license.`;
    return msg;
  },

  renderGlobalAddonsSection(container, options = {}) {
    const section = document.getElementById("global-addons-section");
    const contextEl = document.getElementById("global-addons-context");
    const creditsConfig = options.creditsConfig || {};
    const cfg = this.normalizeAddonsConfig(creditsConfig);
    const hasLicense = !!options.hasActiveLicense;
    const locked = cfg.addons_require_license && !hasLicense;
    const addons = locked
      ? []
      : this.getGlobalCreditAddons(creditsConfig, options.allPlans || []);

    if (section) {
      section.classList.toggle("global-addons-section--locked", locked);
      section.style.display = cfg.addons_enabled && cfg.global_addons_enabled ? "" : "none";
    }
    if (!container) return;

    if (!cfg.addons_enabled || !cfg.global_addons_enabled) {
      container.innerHTML = "";
      return;
    }

    if (contextEl) {
      contextEl.textContent = locked
        ? "Activate a license to unlock credit add-ons."
        : addons.length
          ? "Tap an add-on to buy via WhatsApp — stacks on your license."
          : "No global add-ons configured.";
    }

    if (locked || !addons.length) {
      container.innerHTML = locked
        ? '<div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--mso-muted);font-size:10px;">Activate a license to see add-ons</div>'
        : '<div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--mso-muted);font-size:10px;">No global add-ons available</div>';
      return;
    }

    const parentPlan = options.activePlan || { id: "global", name: "License top-up" };
    container.style.display = "grid";
    container.style.gridTemplateColumns = this.planGridColumns(addons.length);
    container.style.gap = container.style.gap || "8px";
    container.innerHTML = addons
      .map((a) =>
        this.renderGlobalAddonCreditCard(a, parentPlan, {
          pricePerCredit: options.pricePerCredit,
        }),
      )
      .join("");
  },

  renderGlobalAddonCreditCard(addon, parentPlan, options = {}) {
    const basePpc = options.pricePerCredit || 2;
    const offerBadges = this.planOfferBadgesSlotHtml(addon, basePpc);
    const subtitle = addon.card_subtitle || `${addon.credits} credits · ₹${addon.price}`;
    const saveLabel = addon.save || this.formatAddonSaveLabel(addon, basePpc);
    const saveHtml = this.planSaveSlotHtml(saveLabel || "");
    const cardHint = addon.card_hint || "Tap to buy via WhatsApp";
    const btn = `<button type="button" class="plan-btn plan-addon-card plan-global-addon-btn plan-buy-btn plan-card-main"
      data-addon-id="${this.escapeAttr(addon.id)}"
      data-addon-credits="${addon.credits}"
      data-addon-price="${addon.price}"
      data-addon-label="${this.escapeAttr(addon.label || addon.name)}"
      data-plan-id="${this.escapeAttr(parentPlan?.id || "")}"
      data-plan-name="${this.escapeAttr(parentPlan?.name || "")}"
      title="${this.escapeAttr(addon.description || subtitle)}">
      ${offerBadges}
      <div class="plan-name">${this.escapeHtml(addon.label || addon.name)}</div>
      <div class="plan-price">₹${addon.price}</div>
      <div class="plan-note" style="color:var(--mso-muted);">${this.escapeHtml(subtitle)}</div>
      ${saveHtml}
      ${this.planCardFooterHtml({ card_hint: cardHint })}
    </button>`;
    return this.planCardShell(btn, addon, "addon");
  },

  renderCreditPackCardHtml(pack, variant = "popup") {
    const p = pack || {};
    const offerBadges = this.planOfferBadgesHtml(p);
    const subtitle = p.card_subtitle || `${p.credits} credits · ₹${p.price}`;
    const cardHint = p.card_hint || "Tap for details · WhatsApp to buy";
    const btnClass =
      variant === "plan_detail"
        ? "plan-btn credit-pack-open-btn plan-card-main"
        : "plan-btn credit-pack-open-btn plan-card-main";
    const btn = `<button type="button" class="${btnClass}" data-pack="${this.escapeAttr(p.id)}" data-credits="${p.credits}" data-price="${p.price}" data-label="${this.escapeAttr(p.label)}">
      ${offerBadges}
      <div class="plan-name">${this.escapeHtml(p.label || p.credits + " Credits")}</div>
      <div class="plan-price">₹${p.price}</div>
      <div class="plan-note" style="color:var(--mso-muted);">${this.escapeHtml(subtitle)}</div>
      ${this.planCardFooterHtml({ card_hint: cardHint })}
    </button>`;
    return this.planCardShell(btn, p, "pack");
  },

  renderCreditPacks(container, packs, variant = "popup") {
    if (!container) return;
    const list = packs?.length ? packs : this.defaultCreditsConfig().packs;
    container.style.display = "grid";
    container.style.gridTemplateColumns = this.planGridColumns(list.length);
    container.style.gap = container.style.gap || "8px";

    if (!list.length) {
      container.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:12px;color:#9ca3af;font-size:11px;">No credit packs available.</div>';
      return;
    }

    if (variant === "popup") {
      container.innerHTML = list
        .map((p) => this.renderCreditPackCardHtml(p, "popup"))
        .join("");
      return;
    }

    container.innerHTML = list
      .map((p) => {
        const btn = `<button type="button" class="credit-pack-open-btn plan-card-main" data-pack="${this.escapeAttr(p.id)}" data-credits="${p.credits}" data-price="${p.price}" data-label="${this.escapeAttr(p.label)}" style="border:1px solid #f0e0c8;background:#fff;border-radius:8px;padding:10px 28px 10px 10px;text-align:center;cursor:pointer;color:#1f2937;width:100%;">
          <div style="font-size:11px;color:#6b7280;">${this.escapeHtml(p.label || p.credits + " Credits")}</div>
          <div style="font-size:20px;font-weight:700;color:#e67e22;">₹${p.price}</div>
          <div style="font-size:9px;color:#6b7280;">${p.credits} credits</div>
        </button>`;
        return this.planCardShell(btn, p, "pack");
      })
      .join("");
  },

  async hydrateLicenseUi(root) {
    if (!root || !this.isEnabled()) return { plans: this.defaultPlans() };
    const plansGrid =
      root.querySelector("#license-plans-grid") ||
      root.querySelector(".license-plans-grid");
    const creditsGrid =
      root.querySelector("#license-credits-grid") ||
      root.querySelector(".license-credits-grid");
    const creditsSection =
      root.querySelector("#license-credits-section") ||
      root.querySelector(".license-credits-section");
    const hint =
      root.querySelector("#license-device-hint") ||
      root.querySelector("#license-demo-hint");

    const [plans, creditPacks, creditsCfg, wa] = await Promise.all([
      this.getPricingPlans(true),
      this.getCreditPacks(true),
      this.getCreditsConfig(true),
      this.getWhatsAppSettings(),
    ]);

    if (plansGrid) this.renderPlanButtons(plansGrid, plans);
    if (creditsSection) {
      creditsSection.style.display = creditsCfg.enabled ? "block" : "none";
    }
    if (creditsGrid && creditsCfg.enabled) {
      this.renderCreditPacks(creditsGrid, creditPacks, "modal");
    }
    if (hint) {
      hint.textContent =
        "1 device per license by default · Family/Friends plans allow more devices";
    }

    const announcementEl =
      root.querySelector("#license-announcement") ||
      root.querySelector(".license-announcement");
    const announcement = await this.getAnnouncement();
    if (announcementEl) {
      if (announcement) {
        announcementEl.style.display = "block";
        announcementEl.innerHTML = announcement;
      } else {
        announcementEl.style.display = "none";
        announcementEl.innerHTML = "";
      }
    }

    return { plans, creditPacks, creditsConfig: creditsCfg, whatsapp: wa, announcement };
  },

  googleTrialCollection() {
    return "shipping_optimizer_google_trials";
  },

  buildGoogleTrialLicenseKey(uid) {
    const clean = String(uid || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 12)
      .toUpperCase();
    return `GTRIAL-${clean || "USER"}`;
  },

  resolveGoogleTrialImageRunLimit(cfg) {
    const src = cfg || {};
    const trialCredits = Number(src.trial_credits ?? src.trialCredits);
    if (Number.isFinite(trialCredits) && trialCredits > 0) {
      return Math.floor(trialCredits);
    }
    const explicit = Number(src.image_run_limit ?? src.imageRunLimit);
    if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
    const credits = Number(src.credits);
    if (Number.isFinite(credits) && credits > 0) return Math.floor(credits);
    return 3;
  },

  normalizeGoogleTrialDoc(doc) {
    if (!doc) return null;
    const imagesLimit = Number(doc.images_limit ?? doc.imagesLimit ?? 0) || 0;
    const imagesUsed = Number(doc.images_used ?? doc.imagesUsed ?? 0) || 0;
    return {
      googleUid: doc.google_uid || doc.googleUid || "",
      email: doc.email || "",
      displayName: doc.display_name || doc.displayName || "",
      photoUrl: doc.photo_url || doc.photoUrl || "",
      imagesLimit,
      imagesUsed,
      imagesRemaining: Math.max(0, imagesLimit - imagesUsed),
      expiresAt: doc.expires_at || doc.expiresAt || null,
      createdAt: doc.created_at || doc.createdAt || null,
      active: doc.active !== false,
      machineIds: Array.isArray(doc.machine_ids)
        ? doc.machine_ids
        : doc.machineId
          ? [doc.machineId]
          : [],
      maxDevices:
        doc.max_devices != null || doc.maxDevices != null
          ? Number(doc.max_devices ?? doc.maxDevices)
          : null,
      daysGranted: Number(doc.days_granted ?? doc.daysGranted) || 0,
      label: doc.label || "Google free trial",
      unlimitedTime: this.isUnlimitedFlag(
        doc.unlimited_time ?? doc.unlimitedTime,
      ),
    };
  },

  googleTrialHasUnlimitedTime(trial, cfg) {
    if (this.isUnlimitedFlag(trial?.unlimitedTime ?? trial?.unlimited_time)) {
      return true;
    }
    if (this.isUnlimitedFlag(cfg?.unlimited_time ?? cfg?.unlimitedTime)) {
      return true;
    }
    const days = Number(trial?.daysGranted ?? cfg?.days);
    return days === 0;
  },

  resolveGoogleTrialMaxDevices(trialDoc, cfg) {
    const trial = this.normalizeGoogleTrialDoc(trialDoc);
    const userRaw = trial?.maxDevices;
    if (userRaw != null && Number.isFinite(Number(userRaw)) && Number(userRaw) >= 0) {
      return Math.floor(Number(userRaw));
    }
    const cfgRaw = Number(cfg?.max_devices ?? cfg?.maxDevices);
    if (Number.isFinite(cfgRaw) && cfgRaw >= 0) return Math.floor(cfgRaw);
    return 1;
  },

  buildGoogleTrialLicensePayload(uid, trialDoc, cfg) {
    const trial = this.normalizeGoogleTrialDoc(trialDoc);
    const unlimitedTime = this.googleTrialHasUnlimitedTime(trial, cfg);
    const maxDevices = this.resolveGoogleTrialMaxDevices(trialDoc, cfg);
    const key = this.buildGoogleTrialLicenseKey(uid);
    const now = new Date();
    const expired =
      !unlimitedTime &&
      trial.expiresAt &&
      new Date(trial.expiresAt).getTime() < now.getTime();
    const runsExhausted =
      trial.imagesLimit > 0 && trial.imagesUsed >= trial.imagesLimit;
    let accessStatus = "active";
    if (expired) accessStatus = "expired";
    else if (runsExhausted) accessStatus = "runs_exhausted";

    return {
      key,
      planType: "google_trial",
      planName: trial.label || cfg?.label || "Google free trial",
      billingMode: "google_trial",
      googleUid: uid,
      customerEmail: trial.email,
      customerName: trial.displayName,
      imagesLimit: trial.imagesLimit,
      imagesUsed: trial.imagesUsed,
      imagesRemaining: trial.imagesRemaining,
      expiresAt: unlimitedTime ? null : trial.expiresAt,
      activatedAt: trial.createdAt || now.toISOString(),
      deviceCount: trial.machineIds.length || 1,
      maxDevices,
      unlimitedDevices: maxDevices === 0,
      accessStatus,
      unlimitedTime,
      unlimitedCredits: false,
    };
  },

  normalizeGoogleTrialConfig(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const enabled = src.enabled !== false && src.enabled !== "false";
    const googleLoginEnabled =
      src.google_login_enabled !== false &&
      src.google_login_enabled !== "false" &&
      src.googleLoginEnabled !== false &&
      src.googleLoginEnabled !== "false";
    const unlimitedTime =
      src.unlimited_time !== false &&
      src.unlimited_time !== "false" &&
      src.unlimitedTime !== false &&
      src.unlimitedTime !== "false";
    const days = unlimitedTime
      ? 0
      : Math.max(1, Number(src.days) || 7);
    const imageRunLimit = this.resolveGoogleTrialImageRunLimit(src);
    const maxDevicesRaw = Number(src.max_devices ?? src.maxDevices);
    const maxDevices = Number.isFinite(maxDevicesRaw) && maxDevicesRaw >= 0
      ? Math.floor(maxDevicesRaw)
      : 1;
    const maxIncrement = Math.max(
      1,
      Number(src.max_increment_per_run ?? src.maxIncrementPerRun) || 10,
    );
    return {
      enabled,
      google_login_enabled: googleLoginEnabled,
      unlimited_time: unlimitedTime,
      days,
      trial_credits: imageRunLimit,
      credits: imageRunLimit,
      image_run_limit: imageRunLimit,
      max_increment_per_run: maxIncrement,
      max_devices: maxDevices,
      label: src.label || src.name || "Google free trial",
      oauth_client_id:
        src.oauth_client_id ||
        src.oauthClientId ||
        CONFIG?.FIREBASE?.oauthClientId ||
        "",
      oauth_web_client_id:
        src.oauth_web_client_id ||
        src.oauthWebClientId ||
        CONFIG?.FIREBASE?.oauthWebClientId ||
        "",
      chrome_extension_id:
        src.chrome_extension_id ||
        src.chromeExtensionId ||
        CONFIG?.CHROME_EXTENSION_ID ||
        "",
    };
  },

  async getGoogleTrialPublicConfig(force = false) {
    const app = await this.getAppConfig(force);
    const trial = this.normalizeGoogleTrialConfig(
      app?.google_trial || app?.googleTrial || {},
    );
    return {
      ...trial,
      oauth_client_id:
        trial.oauth_client_id || CONFIG?.FIREBASE?.oauthClientId || "",
      oauth_web_client_id:
        trial.oauth_web_client_id || CONFIG?.FIREBASE?.oauthWebClientId || "",
    };
  },

  async isGoogleTrialEnabled() {
    const cfg = await this.getGoogleTrialPublicConfig();
    return !!(cfg.enabled && (cfg.oauth_client_id || CONFIG?.FIREBASE?.oauthClientId));
  },

  async isGoogleLoginEnabled() {
    const cfg = await this.getGoogleTrialPublicConfig();
    const hasOAuth = !!(cfg.oauth_client_id || CONFIG?.FIREBASE?.oauthClientId);
    return !!(cfg.google_login_enabled !== false && hasOAuth);
  },

  formatGoogleTrialHint(cfg) {
    const c = cfg || {};
    const parts = [];
    if (c.days) parts.push(`${c.days}-day trial`);
    const runs = c.trial_credits || c.image_run_limit || c.credits;
    if (runs > 0) parts.push(`${runs} free trial credits`);
    if (!parts.length) return "One free trial per Google account";
    return `${parts.join(" · ")} · then paid plan credits`;
  },

  async refreshGoogleTrial(uid, idToken, machineId) {
    const cfg = await this.getGoogleTrialPublicConfig(true);
    const doc = await this.fetchDocAuth(this.googleTrialCollection(), uid, idToken);
    if (!doc) {
      return { ok: false, reason: "Google trial not found. Sign in to start your free trial." };
    }
    const trial = this.normalizeGoogleTrialDoc(doc);
    if (!trial.active) {
      return { ok: false, reason: "Your Google trial was revoked. Contact support." };
    }
    const license = this.buildGoogleTrialLicensePayload(uid, doc, cfg);
    const unlimitedTime = this.googleTrialHasUnlimitedTime(
      this.normalizeGoogleTrialDoc(doc),
      cfg,
    );
    const maxDevices = this.resolveGoogleTrialMaxDevices(doc, cfg);
    const expired = !unlimitedTime && license.accessStatus === "expired";
    const exhausted = license.accessStatus === "runs_exhausted";

    if (
      machineId &&
      trial.machineIds.length &&
      maxDevices > 0 &&
      !trial.machineIds.includes(machineId) &&
      trial.machineIds.length >= maxDevices
    ) {
      return {
        ok: false,
        reason: `Trial device limit reached (${trial.machineIds.length}/${maxDevices}). Sign off on another device or contact support.`,
        license,
        deviceLimit: true,
      };
    }

    if (machineId && !trial.machineIds.includes(machineId)) {
      if (maxDevices > 0 && trial.machineIds.length >= maxDevices) {
        return {
          ok: false,
          reason: `Trial device limit reached (${maxDevices} device${maxDevices === 1 ? "" : "s"}).`,
          license,
          deviceLimit: true,
        };
      }
      const nextIds = [...trial.machineIds, machineId];
      await this.patchDocAuth(
        this.googleTrialCollection(),
        uid,
        { machine_ids: nextIds },
        ["machine_ids"],
        idToken,
      );
      license.deviceCount = nextIds.length;
    }

    return {
      ok: !expired && !exhausted,
      license,
      expired,
      runsExhausted: exhausted,
      reason: expired
        ? "Your Google free trial has expired. Purchase a plan to continue."
        : exhausted
          ? "Free trial image runs used up. Buy a plan to continue."
          : null,
    };
  },

  async claimGoogleFreeTrial(machineId, idToken, userMeta = {}) {
    const cfg = await this.getGoogleTrialPublicConfig(true);
    if (!cfg.google_login_enabled) {
      return { success: false, reason: "Google sign-in is disabled by admin." };
    }
    if (!cfg.enabled) {
      const uid = userMeta.uid || userMeta.localId;
      if (uid && idToken) {
        const existing = await this.fetchDocAuth(
          this.googleTrialCollection(),
          uid,
          idToken,
        );
        if (existing) {
          const refresh = await this.refreshGoogleTrial(uid, idToken, machineId);
          if (refresh.license) {
            return {
              success: true,
              limited: !refresh.ok,
              existing: true,
              licenseKey: this.buildGoogleTrialLicenseKey(uid),
              license: refresh.license,
              trialExpired: !!refresh.expired,
              runsExhausted: !!refresh.runsExhausted,
              reason: refresh.reason,
              message:
                refresh.reason ||
                "Signed in with Google — activate a paid license to continue after trial credits.",
            };
          }
        }
      }
      return {
        success: false,
        reason: "New Google free trials are paused. Activate a license key or contact support.",
      };
    }
    if (!idToken) {
      return { success: false, reason: "Please sign in with Google first." };
    }

    const uid = userMeta.uid || userMeta.localId;
    if (!uid) {
      return { success: false, reason: "Google account id missing." };
    }

    const email = String(userMeta.email || "").trim().toLowerCase();
    if (!email) {
      return {
        success: false,
        reason: "Google account must have an email address.",
      };
    }

    try {
      let existing = await this.fetchDocAuth(
        this.googleTrialCollection(),
        uid,
        idToken,
      );
      let created = false;

      if (!existing) {
        const now = new Date();
        const unlimitedTime = cfg.unlimited_time !== false;
        const payload = {
          google_uid: uid,
          email,
          display_name: userMeta.displayName || "",
          photo_url: userMeta.photoUrl || "",
          trial_credits: cfg.trial_credits,
          images_limit: cfg.image_run_limit,
          images_used: 0,
          created_at: now,
          active: true,
          machine_ids: machineId ? [machineId] : [],
          label: cfg.label,
          unlimited_time: unlimitedTime,
        };
        if (unlimitedTime) {
          payload.days_granted = 0;
        } else {
          payload.days_granted = cfg.days;
          payload.expires_at = new Date(
            now.getTime() + cfg.days * 24 * 60 * 60 * 1000,
          );
        }

        const createRes = await this.createDocAuth(
          this.googleTrialCollection(),
          uid,
          payload,
          idToken,
        );

        if (createRes.ok) {
          existing = createRes.doc || payload;
          created = true;
        } else if (createRes.status === 409 || createRes.status === 400) {
          existing = await this.fetchDocAuth(
            this.googleTrialCollection(),
            uid,
            idToken,
          );
          if (!existing) {
            return {
              success: false,
              reason:
                "Could not create trial. Ask admin to deploy Firestore security rules (see firestore.rules).",
            };
          }
        } else {
          return {
            success: false,
            reason:
              createRes.error?.error?.message ||
              "Could not start free trial. Check Firestore rules and try again.",
          };
        }
      }

      const refresh = await this.refreshGoogleTrial(uid, idToken, machineId);
      const licenseKey = this.buildGoogleTrialLicenseKey(uid);

      if (!refresh.license) {
        return { success: false, reason: refresh.reason || "Trial unavailable." };
      }

      if (!refresh.ok) {
        return {
          success: true,
          limited: true,
          existing: !created,
          licenseKey,
          license: refresh.license,
          trialExpired: !!refresh.expired,
          runsExhausted: !!refresh.runsExhausted,
          reason: refresh.reason,
          message: refresh.reason || "Trial saved on this device.",
        };
      }

      return {
        success: true,
        existing: !created,
        licenseKey,
        license: refresh.license,
        message: created
          ? cfg.unlimited_time !== false
            ? `Signed in with Google (${cfg.image_run_limit} free credits · no expiry).`
            : `Free trial activated (${cfg.days} days · ${cfg.image_run_limit} runs).`
          : `Welcome back — ${refresh.license.imagesRemaining} run(s) left on your Google account.`,
      };
    } catch (e) {
      return {
        success: false,
        reason: e.message || "Network error while claiming trial.",
      };
    }
  },

  async incrementGoogleTrialRun(uid, idToken, increment) {
    const n = Math.max(1, Number(increment) || 1);
    if (!uid || !idToken) return { ok: false, reason: "Not signed in" };

    const doc = await this.fetchDocAuth(this.googleTrialCollection(), uid, idToken);
    if (!doc) return { ok: false, reason: "Trial not found" };

    const trial = this.normalizeGoogleTrialDoc(doc);
    const cfg = await this.getGoogleTrialPublicConfig();
    const maxStep = cfg.max_increment_per_run || 10;
    if (n > maxStep) {
      return { ok: false, reason: `Max ${maxStep} runs per request` };
    }
    if (trial.imagesLimit > 0 && trial.imagesUsed + n > trial.imagesLimit) {
      return {
        ok: false,
        reason: "Free trial image runs used up.",
        runsExhausted: true,
      };
    }

    const nextUsed = trial.imagesUsed + n;
    const patch = await this.patchDocAuth(
      this.googleTrialCollection(),
      uid,
      {
        images_used: nextUsed,
        last_run_at: new Date().toISOString(),
      },
      ["images_used", "last_run_at"],
      idToken,
    );

    if (!patch.ok) {
      return {
        ok: false,
        reason: "Could not update trial usage. Check connection.",
      };
    }

    const license = this.buildGoogleTrialLicensePayload(uid, {
      ...doc,
      images_used: nextUsed,
    }, cfg);

    return {
      ok: true,
      imagesUsed: nextUsed,
      imagesRemaining: Math.max(0, trial.imagesLimit - nextUsed),
      license,
    };
  },

  async hydrateGoogleTrialUi(root, handlers = {}) {
    const section =
      root?.querySelector?.("#google-trial-section") ||
      root?.querySelector?.(".google-trial-section");
    const btn =
      root?.querySelector?.("#google-trial-btn") ||
      root?.querySelector?.(".google-trial-btn");
    const hint =
      root?.querySelector?.("#google-trial-hint") ||
      root?.querySelector?.(".google-trial-hint");
    const userEl =
      root?.querySelector?.("#google-trial-user") ||
      root?.querySelector?.(".google-trial-user");
    const redirectEl =
      root?.querySelector?.("#google-trial-redirect") ||
      root?.querySelector?.(".google-trial-redirect");

    if (!section) return { enabled: false };

    const cfg = await this.getGoogleTrialPublicConfig();
    const showSection =
      this.isEnabled() &&
      cfg.google_login_enabled !== false &&
      (cfg.oauth_client_id || CONFIG?.FIREBASE?.oauthClientId);
    section.style.display = showSection ? "block" : "none";
    if (!showSection) return { enabled: false, config: cfg };

    const hasOAuth = !!(cfg.oauth_client_id || CONFIG?.FIREBASE?.oauthClientId);
    const trialAvailable = cfg.enabled !== false;
    if (hint) {
      if (!hasOAuth) {
        hint.textContent = "Sign in with Google to start your free trial.";
      } else if (!trialAvailable) {
        hint.textContent =
          "Google sign-in is on — new free trials are paused. Sign in to use an existing trial or activate a license key.";
      } else {
        hint.textContent = this.formatGoogleTrialHint(cfg);
      }
    }

    let user = null;
    if (typeof FirebaseAuth !== "undefined") {
      user = await FirebaseAuth.getCurrentUser();
    }
    if (userEl) {
      userEl.style.display = user?.email ? "block" : "none";
      userEl.textContent = user?.email ? `Signed in as ${user.email}` : "";
    }
    if (redirectEl) {
      redirectEl.style.display = "none";
      redirectEl.textContent = "";
    }
    if (btn) {
      btn.textContent = user?.email
        ? trialAvailable
          ? "Start free trial with Google"
          : "Continue with Google"
        : "Continue with Google";
      if (handlers.onClick && !btn.dataset.googleTrialBound) {
        btn.dataset.googleTrialBound = "1";
        btn.addEventListener("click", handlers.onClick);
      }
    }

    return { enabled: true, config: cfg, user };
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FirebaseLicense = FirebaseLicense;
}
