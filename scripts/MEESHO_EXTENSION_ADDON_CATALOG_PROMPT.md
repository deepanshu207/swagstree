# Meesho Extension — Admin sync prompt (v1.8.45)

Apply these changes to `meesho-shipping-optimizer-extension` by merging from `swagstree/scripts/meesho-extension-v182/`.

## Goal

- **Safe admin:** Swagstree superadmin uses preview modals before any Firebase write (load/seed/import/license).
- **Clear credits:** Subscription (`included_credits`) vs add-on (`addon_credits`) pools; extension **always consumes subscription credits first**.
- **Flexible add-ons:** Per-plan and per-license hide/disable for plan add-ons and custom plan block.
- **Billing mode:** Licenses default `subscription`; auto `hybrid` when add-on or custom credits exist (admin + extension activation).
- **Customer mapping:** Email, name, location (timezone), address on license — prefilled from Google sign-in on activation when empty.
- **Per-license custom plan:** Extra WhatsApp custom-plan block for a specific license key (shown alongside global custom plan).
- **Device limits:** Subscription plans default `max_devices: 0` (unlimited). Google trial default `max_devices: 1` (editable in admin).

## Files to sync

| File | Changes |
|------|---------|
| `js/firebaseLicense.js` | `license_custom_plans[]`, `resolveLicenseCustomPlanEntries`, multi-block custom plan UI (v1.8.45) |
| `js/license.js` | `licenseCustomPlan`, customer address/location in `normalizeLicenseInfo` |
| `popup.js` | Pass `licenseContext` to plan detail; wire per-license custom plan WhatsApp |
| `firestore.rules` | Allow extension to patch `customer_*`, `custom_credits` on activation |
| `config.js` | `VERSION: "1.8.45"` |
| `manifest.json` | `"version": "1.8.45"` |

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
| `billing_mode` | `subscription` (default) · `hybrid` (auto when add-on/custom credits) · `credits` |
| `customer_name` / `customer_phone` / `customer_email` | Customer mapping (extension may fill email/name/location on activation) |
| `customer_address` | Optional street address |
| `customer_location` | Timezone / locale string (e.g. `Asia/Kolkata · en-IN`) |
| `customer_ip` | Optional IP when known |
| `license_custom_plans` | Per-license WhatsApp custom plan blocks `[{ id, enabled, label, description, whatsapp_title, order }]` |
| `license_custom_plan` | Legacy single object — still read; remove on save when using array |

## Billing mode (v1.8.44)

- **Create/edit license (admin):** billing defaults to `subscription`.
- **Auto hybrid:** when add-on credits > 0, custom credits > 0, or add-on IDs are selected → billing switches to `hybrid`.
- **Manual override:** admin can still pick `credits` for pure pay-per-use licenses.
- **Extension activation:** if license has add-on/custom credits and no stored billing mode, writes `billing_mode: hybrid`.

## Per-license custom plans (v1.8.45)

Admin → Super → Licenses → **License custom plans (this key only)** — add multiple mapped plans per license (same workflow as credit packs: list + modal).

```json
"license_custom_plans": [
  {
    "id": "vip_yearly",
    "enabled": true,
    "label": "Request VIP yearly package",
    "whatsapp_title": "VIP Yearly Plan",
    "description": "Your dedicated yearly support package.",
    "order": 0
  },
  {
    "id": "addon_bundle",
    "enabled": true,
    "label": "Custom add-on bundle",
    "whatsapp_title": "Add-on bundle",
    "description": "Pick extra credits for my license.",
    "order": 1
  }
]
```

- Legacy single `license_custom_plan` object is still read — migrated to array on next license save.
- Extension plan detail shows **each** enabled entry plus the global `credits.custom_plan` block.
- `hide_custom_plan` on the license hides all license-mapped custom plans (global block still follows plan/config rules).
- Active license context loads fresh `license_custom_plans[]` from Firebase when opening plan detail.

## Per-license custom plan (v1.8.44 — superseded)

Use `license_custom_plans[]` array instead of single `license_custom_plan`.

## Customer fields on activation (v1.8.44)

When a user activates a license in the extension while signed in with Google:

- Writes empty-only fields: `customer_email`, `customer_name`, `customer_location` (browser timezone + locale).
- Requires updated `firestore.rules` (deploy from repo).
- Admin can edit/override anytime in license form (including `customer_address`).

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
    "pack_scopes_enabled": true,
    "addon_scopes_enabled": true,
    "addons_enabled": true,
    "plan_addons_enabled": true,
    "global_addons_enabled": true,
    "packs": [
      { "id": "pack_10", "scope": "global", "credits": 10, "price": 20, "label": "10 Credits", "active": true },
      { "id": "pack_50", "scope": "plan", "plan_ids": ["monthly", "yearly"], "credits": 50, "price": 90, "label": "50 Credits", "active": true },
      { "id": "pack_custom", "scope": "plan", "plan_ids": ["credits_starter"], "credits": 60, "price": 70, "label": "60 credits", "active": true }
    ],
    "addon_catalog": [
      { "id": "addon_10", "scope": "plan", "plan_ids": ["monthly"], "credits": 10, "price": 20 },
      { "id": "addon_25", "scope": "global", "credits": 25, "price": 40 }
    ]
  }
}
```

- `scope: "plan"` + `plan_ids[]` on **add-ons** → add-on in plan detail only (when `addon_scopes_enabled: true`).
- `scope: "global"` on add-ons → licensed users see it in popup global add-ons grid.
- `scope: "plan"` + `plan_ids[]` on **credit packs** → pack shown in ⚡ BUY CREDITS when user's active license plan matches, and on that plan's detail screen (when `pack_scopes_enabled: true`).
- `scope: "global"` on credit packs → always in main ⚡ BUY CREDITS section (all eligible users).
- Map custom/credits-only packs to plan id `credits_starter` (or your credits-only plan slug).

## Credit pack plan mapping — extension (v1.8.43+)

Admin: Credits tab → enable **Pack plan mapping** → set each pack **Scope** + **Plan IDs** → Save to Firebase.

Extension behavior when `credits.pack_scopes_enabled === true`:

| Surface | What shows |
|---------|------------|
| Main popup ⚡ BUY CREDITS | `scope: global` packs + `scope: plan` packs matching active license `plan_id` |
| Plan detail (ℹ️) | `scope: plan` packs where `plan_ids` includes that plan's id |
| No license yet | Global packs only (plan-mapped packs hidden until activated) |

Implementation (`firebaseLicense.js` v1.8.43):

- `normalizeCreditPack()` reads `scope` + `plan_ids[]`
- `packAppliesToPlan(pack, planId, scopesEnabled)` — same rules as add-ons
- `filterCreditPacksForMain(packs, activePlanIds, scopesEnabled)` — popup grid
- `getPlanDetailCreditPacks(plan, creditsConfig)` — plan detail section **⚡ CREDIT PACKS FOR THIS PLAN**
- `popup.js` → `refreshCreditsTopUpSection()` passes active license plan ids into filter

After admin save: close/reopen extension popup (config cache ~5 min or bust on `updatedAt`).

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

## Credit packs — admin save & extension sync (v1.8.43+)

- **Pack plan mapping** (Credits tab checkbox) writes `credits.pack_scopes_enabled` — extension filters packs by active license plan.
- Each pack row has **Scope** (`global` | `plan`) and **Plan IDs** (comma-separated slugs like `monthly`, `yearly`, `credits_starter`).
- Plan-mapped packs appear on that plan's detail page (ℹ️) under **CREDIT PACKS FOR THIS PLAN**.

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
