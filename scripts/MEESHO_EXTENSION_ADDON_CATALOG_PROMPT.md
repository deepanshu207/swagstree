# Meesho Extension — Admin sync prompt (v1.8.37)

Apply these changes to `meesho-shipping-optimizer-extension` by merging from `swagstree/scripts/meesho-extension-v182/`.

## Goal

- **Safe admin:** Swagstree superadmin uses preview modals before any Firebase write (load/seed/import/license).
- **Clear credits:** Subscription (`included_credits`) vs add-on (`addon_credits`) pools; extension **always consumes subscription credits first**.
- **Flexible add-ons:** Per-plan and per-license hide/disable for plan add-ons and custom plan block.
- **Device limits:** Subscription plans default `max_devices: 0` (unlimited). Google trial default `max_devices: 1` (editable in admin).

## Files to sync

| File | Changes |
|------|---------|
| `js/firebaseLicense.js` | Subscription-first `deductCredits`, `included_credits_used` / `addon_credits_used`, plan+license hide/disable flags, scoped add-ons (v1.8.36+) |
| `popup.js` / `popup.html` | Plan detail add-ons inside ℹ️, global add-ons section, license gate |
| `config.js` | `VERSION: "1.8.37"` |
| `manifest.json` | `"version": "1.8.37"` |

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
| `hide_plan_addons` | Hide plan add-ons in extension for this license |
| `disable_plan_addons` | Show plan add-ons disabled |
| `hide_custom_plan` | Hide custom plan block |
| `disable_custom_plan` | Disable custom plan button |

## Credit consumption order

1. On each operation, extension deducts from `included_credits` pool until `included_credits_used >= included_credits`.
2. Then deducts from `addon_credits` pool until `addon_credits_used >= addon_credits`.
3. `credits_balance` and `credits_used` stay the single source of truth for access checks.

Legacy licenses without `included_credits_used` / `addon_credits_used` are migrated on first deduction using subscription-first inference.

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
3. Reload extension at `chrome://extensions` (v1.8.37+).

## Google trial defaults

- `google_trial.max_devices: 1` (enforced for Google sign-in trials only).
- Editable in admin **Google Free Trial** tab; save shows preview modal.
