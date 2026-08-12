# Meesho Extension — Admin sync prompt (v1.8.41)

Apply these changes to `meesho-shipping-optimizer-extension` by merging from `swagstree/scripts/meesho-extension-v182/`.

## Goal

- **Safe admin:** Swagstree superadmin uses preview modals before any Firebase write (load/seed/import/license).
- **Clear credits:** Subscription (`included_credits`) vs add-on (`addon_credits`) pools; extension **always consumes subscription credits first**.
- **Flexible add-ons:** Per-plan and per-license hide/disable for plan add-ons and custom plan block.
- **Device limits:** Subscription plans default `max_devices: 0` (unlimited). Google trial default `max_devices: 1` (editable in admin).

## Files to sync

| File | Changes |
|------|---------|
| `js/firebaseLicense.js` | Subscription-first `deductCredits`, pool counters (`included_credits_used` / `addon_credits_used` / `custom_credits_used`), per-license custom credits, plan+license hide/disable flags, scoped add-ons (v1.8.36+) |
| `popup.js` / `popup.html` | Plan detail add-ons inside ℹ️, global add-ons section, license gate, custom credits line (license-only) |
| `config.js` | `VERSION: "1.8.41"` |
| `manifest.json` | `"version": "1.8.41"` |

## Firebase — plan fields (`shipping_optimizer_config/app` → `plans[]`)

| Field | Purpose |
|-------|---------|
| `active: false` or `hide: true` | Hide plan from extension popup |
| `max_devices: 0` | Unlimited devices (default for Monthly/Quarterly/Half-yearly/Yearly seed) |
| `allow_credit_addons` / `allow_plan_addons` | Enable add-ons in plan detail |
| `hide_plan_addons_in_detail` | Hide add-on cards in ℹ️ detail |
| `disable_plan_addons` | Show add-ons grayed / not selectable |
| `allow_custom_plan: false` | Hide custom plan block |
| `hide_custom_plan` | Hide custom plan block |
| `disable_custom_plan` | Show custom plan button disabled |

## Firebase — license fields (`shipping_optimizer_licenses/{KEY}`)

| Field | Purpose |
|-------|---------|
| `included_credits` | Subscription/base grant (consumed first) |
| `addon_credits` | Add-on grant (consumed after base exhausted) |
| `addon_credit_ids[]` | Which catalog add-ons were granted |
| `credits_balance` | Total remaining |
| `credits_used` | Total consumed |
| `included_credits_used` | Base pool consumed (extension maintains) |
| `addon_credits_used` | Add-on pool consumed (extension maintains) |
| `custom_credits` | Per-license bonus grant (admin-only field; shown only for that license in extension) |
| `custom_credits_label` | Optional display label in extension popup (e.g. "VIP support bonus") |
| `custom_credits_used` | Custom pool consumed (extension maintains) |
| `bonus_credits` | Legacy alias — read as fallback for `custom_credits` |
| `hide_plan_addons` | Hide plan add-ons in extension for this license |
| `disable_plan_addons` | Show plan add-ons disabled |
| `hide_custom_plan` | Hide custom plan block |
| `disable_custom_plan` | Disable custom plan button |

## Credit consumption order

1. On each operation, extension deducts from `included_credits` pool until `included_credits_used >= included_credits`.
2. Then deducts from `addon_credits` pool until `addon_credits_used >= addon_credits`.
3. Then deducts from `custom_credits` pool until `custom_credits_used >= custom_credits`.
4. `credits_balance` and `credits_used` stay the single source of truth for access checks.

Legacy licenses without pool counters are migrated on first deduction using subscription → add-on → custom inference.

## Per-license custom credits (v1.8.39)

Set in Swagstree admin → Super → Licenses → create/edit license:

| Admin field | Firebase | Extension popup |
|-------------|----------|-----------------|
| Custom credits (this license only) | `custom_credits` | Remaining + used for this pool |
| Custom credits label | `custom_credits_label` | Shown next to custom line (if set) |

- Custom credits are **not** part of the plan catalog — they apply only to the license key you edit.
- Total grant = `included_credits + addon_credits + custom_credits`.
- Admin edit view shows a **Consumed breakdown** panel (subscription / add-on / custom used vs remaining) from stored `*_credits_used` fields.
- Customer fields (email, location, IP) auto-prefill on create from admin session; empty fields only on edit.

## Firebase — credits config

```json
{
  "credits": {
    "addon_scopes_enabled": true,
    "addons_enabled": true,
    "plan_addons_enabled": true,
    "global_addons_enabled": true,
    "addon_catalog": [
      { "id": "addon_10", "scope": "plan", "plan_ids": ["monthly"], "credits": 10, "price": 20 },
      { "id": "addon_25", "scope": "global", "credits": 25, "price": 40 }
    ]
  }
}
```

- `scope: "plan"` + `plan_ids[]` → add-on in plan detail only.
- `scope: "global"` → licensed users see it in popup global add-ons grid.

## Swagstree admin button guide

| Button | Writes Firebase? | What it does |
|--------|------------------|--------------|
| **Load built-in → form** | No | Copies code defaults into the current tab form. Review, then **Save to Firebase** separately. |
| **Seed built-in → Firebase** | Yes (merge) | Factory reset of app config from built-in seed. Preview modal required. Does not delete licenses. |
| **Save form → Firebase** | Yes | Saves current tab form after preview modal. |
| **Save all forms → Firebase** | Yes | Saves all tabs from forms after preview. |
| **Review** (unsaved banner) | No | Before/after diff for Config or Credits tab saves. |

## First-time Firebase seed

1. Super → Shipping Optimizer → **Built-in defaults** tab → preview cards.
2. Tap **Seed built-in → Firebase** → confirm preview → write.
3. Reload extension at `chrome://extensions` (v1.8.41+).

## Credit packs — admin save & extension sync (v1.8.40+)

- **No seed required** if your export already has `credits.packs[]` and `credits.addon_catalog[]` in Firebase — seed only resets to factory defaults.
- **Subscription plans** live under Config tab → save via **Save plans** or **Save to Firebase** on Config tab.
- **Credit packs** (⚡ BUY CREDITS) live under Credits tab → **Save credit packs** or **Save to Firebase** on Credits tab.
- **Plan add-ons** (`addon_50`, etc.) are in each plan's `credit_addons[]` and/or `credits.addon_catalog[]` — extension plan detail (ℹ️) reads both.
- Admin always reads pack rows from the DOM before Firebase write.
- Extension busts config cache when Firebase `updatedAt` changes.
- **License update modal** (v1.8.41): sticky footer so **Update license in Firebase** is always visible on mobile.
- **Custom credits** on edit: increasing custom credits auto-adds the same amount to balance + total.

- **Subscription plans** live under Config tab → save via **Save plans** or **Save to Firebase** on Config tab.
- **Credit packs** live under Credits tab → save via **Save credit packs** or **Save to Firebase** on Credits tab (both write `credits.packs[]` on `shipping_optimizer_config/app`).
- Admin always reads pack rows from the DOM before Firebase write (avoids stale in-memory list dropping new packs like `pack_5`).
- Extension reads `credits.packs` from Firebase when the field exists (no silent fallback to built-in defaults).
- **⚡ BUY CREDITS** section shows when credits are enabled and packs exist — including on the activation screen (no license yet) for preview.
- After saving packs in admin, **close and reopen** the extension popup to refresh.

- Review modal always shows **Write to Firebase** (sticky footer on mobile).
- If form is dirty but field-level diff is empty (e.g. add-on catalog reorder), admin falls back to action preview with current form summary — no more stuck "No changes" with only Cancel.

## Google trial device limits (v1.8.38)

| Scope | Field | Default | Notes |
|-------|-------|---------|-------|
| Global config | `google_trial.max_devices` | `1` | New sign-ins · `0` = unlimited |
| Per user | `shipping_optimizer_google_trials/{uid}.max_devices` | inherits global | Admin → Google Users → Manage → Devices |

Extension resolves: per-user `max_devices` if set, else `google_trial.max_devices`. `0` skips device cap checks.

Admin **Manage Google user** modal sections each support **Save → Firebase** with preview. Credits and Devices also offer **Save as global default** (updates `google_trial` config only).
