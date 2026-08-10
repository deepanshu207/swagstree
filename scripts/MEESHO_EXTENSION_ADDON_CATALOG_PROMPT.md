# Meesho Extension — Per-plan add-ons + shared catalog (v1.8.4)

Apply these changes to `meesho-shipping-optimizer-extension` (merge from `swagstree/scripts/meesho-extension-v182/`).

## Goal

- **Plan cards** (Monthly / 3 Months / 6 Months / Yearly): plan info only — no add-on chips (consistent card height).
- **Plan detail (ℹ️)**: show full **credit add-on cards** for that plan (badges, price, subtitle, save, description).
- **Bottom section** `⚡ ALL CREDIT ADD-ONS`: selectable add-on cards — unlocked after a plan is selected.
- **Data resolution** (`getPlanCreditAddons`):
  1. `plan.credit_addons[]` when non-empty (per-plan, editable in Swagstree Config tab)
  2. else `credits.addon_catalog[]` (shared master list on Credits tab)
  3. else built-in `defaultAddonCatalog()`

## Files to sync (from swagstree `scripts/meesho-extension-v182/`)

| File | Changes |
|------|---------|
| `js/firebaseLicense.js` | `getPlanCreditAddons(plan, catalog)` priority fix, add-ons in `renderPlanDetailHtml`, `renderPlanAddonsSection` context text |
| `popup.js` | Pass `addonCatalog` + `pricePerCredit` into `renderPlanDetailHtml` |
| `popup.html` | `.plan-detail-addon-cards` CSS |
| `config.js` | `VERSION: "1.8.4"` |
| `manifest.json` | `"version": "1.8.4"` |

## Firebase seed (Swagstree admin)

1. Super → Shipping Optimizer → **Built-in defaults** → **Seed all defaults** (or save Credits + Config tabs).
2. Confirm `credits.addon_catalog` has 4 items with `offer_badges`, `save`, `description`.
3. Each plan should have `allow_credit_addons: true` and `credit_addons[]` (defaults copy catalog; customize per plan on Config tab).

## Extension behaviour

1. User taps a subscription plan → plan card highlights; add-on section unlocks.
2. User taps ℹ️ on a plan → detail screen lists included features **and** credit add-on cards for that plan.
3. User selects add-ons in bottom section → WhatsApp checkout includes plan + selected add-on credits.
4. Existing subscribers use **⚡ BUY CREDITS** for credit packs (not add-ons).

## Swagstree admin (v5.15+)

- **Import / Export**: top toolbar (Export backup / Import), or sticky bars on Built-in defaults, Config, Credits tabs.
- **Shared catalog editor**: Credits tab → **Shared add-on catalog** accordion.
- **Per-plan add-ons**: Config tab → expand plan → **Credit add-ons** → **Copy from shared catalog**.
- **Google Users**: mobile card layout; tap card → manage form modal.
