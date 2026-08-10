# Meesho Extension — Unified add-on catalog (v1.8.3)

Apply these changes to `meesho-shipping-optimizer-extension` (merge from `swagstree/scripts/meesho-extension-v182/`).

## Goal

- **Plan cards** (Monthly / 3 Months / 6 Months / Yearly): show **only** plan info — no add-on chips, no add-on grid in plan detail ℹ️ screen.
- **One shared add-on section** at the bottom: `⚡ ALL CREDIT ADD-ONS` — same 4 cards for every subscription plan.
- **Add-on cards** use the **same layout** as plan cards: offer badges (% off, Popular, +N), price, subtitle, save line, ℹ️ corner, consistent min-height.
- **Data source**: `shipping_optimizer_config/app` → `credits.addon_catalog[]` (not per-plan `credit_addons[]`).

## Files to sync (from swagstree `scripts/meesho-extension-v182/`)

| File | Changes |
|------|---------|
| `js/firebaseLicense.js` | `defaultAddonCatalog()`, `resolveAddonCatalog()`, `getPlanCreditAddons(plan, catalog)`, remove add-ons from `renderPlanDetailHtml`, unified `renderPlanAddonsSection` + `renderAddonCreditCard` |
| `popup.js` | `cachedAddonCatalog`, pass `addonCatalog` into `renderPlanAddonsSection`, no add-ons in plan detail wiring |
| `popup.html` | Section title `⚡ ALL CREDIT ADD-ONS`, consistent card min-height CSS |
| `config.js` | `VERSION: "1.8.3"` |
| `manifest.json` | `"version": "1.8.3"` |

## Firebase seed (Swagstree admin)

1. Super → Shipping Optimizer → **Built-in defaults** → **Seed all defaults** (or Credits tab → save `addon_catalog`).
2. Confirm `credits.addon_catalog` has 4 items with `offer_badges`: `+10`, `Popular/20% off/+25`, `30% off/+50`, `Best value/15% off/+100`.
3. Plans should have `allow_credit_addons: true` but **no** `credit_addons` array (or empty).

## Extension behaviour

1. User taps a subscription plan → plan card highlights; add-on section unlocks.
2. Add-on grid shows **full catalog** (from Firebase or built-in defaults).
3. `max_addon_selections` on the **selected plan** still limits how many add-ons can be picked (0 = unlimited).
4. Plan detail (ℹ️) shows plan features only + note: “add-ons are below the plans”.
5. WhatsApp message includes selected add-ons + plan price.

## Test checklist

- [ ] All 4 plan cards same visual height (no add-on content on cards)
- [ ] Plan detail has **no** add-on chip grid
- [ ] Add-on section locked until plan selected
- [ ] All 4 add-ons visible after selecting any subscription plan
- [ ] Badges show % off (20%, 30%, 15%) where configured
- [ ] Select add-on → highlight → Buy on WhatsApp includes add-on line
- [ ] `max_addon_selections` enforced when set on a plan in admin
- [ ] BUY CREDITS section unchanged (active subscribers only)

## Copy-paste prompt for extension repo agent

```
Sync extension to v1.8.3 add-on catalog layout from swagstree/scripts/meesho-extension-v182/:

1. Plan cards and plan detail (ℹ️) must NOT show credit add-ons — keeps card height consistent.
2. Bottom section "⚡ ALL CREDIT ADD-ONS" shows credits.addon_catalog from Firebase (fallback: 4 built-in add-ons).
3. Add-on cards must match plan card UI: plan-offer-badges, plan-name, plan-price, save line, card_hint footer, ℹ️ detail corner.
4. getPlanCreditAddons(plan, catalog) prefers catalog; legacy plan.credit_addons only if catalog empty.
5. renderPlanAddonsSection receives addonCatalog from popup.js cachedAddonCatalog.
6. Bump version to 1.8.3 in manifest.json and config.js.

After deploy: hard-reload extension, run Config → Seed all defaults in Swagstree admin if addon_catalog missing.
```
