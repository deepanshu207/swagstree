# Swagstree admin — extension sync prompt (v5.11+)

Use this when updating **Swagstree** `shipping-optimizer-admin.js` to stay aligned with **Meesho extension v1.8.2+**.

## Extension reads from Firebase (`extension-e6e32`)

| Area | Firebase keys | Extension v1.8+ |
|------|---------------|-----------------|
| Plans | `plans[]` — `price`, `days`, `included_credits`, `card_subtitle`, `save`, `offer_badges`, `credit_addons[]` | Plan cards + detail |
| Add-ons | `credit_addons[]` — `credits`, `price`, `label`, `card_subtitle`, `description`, **`offer_badges`** | Bottom add-on section; % off vs `price_per_credit` |
| Credits | `credits.packs[]`, `credits.addon_catalog[]` (optional reference) | BUY CREDITS packs |
| Google trial | `google_trial` + collection **`shipping_optimizer_google_trials/{uid}`** | Google sign-in |

## Seed / Load defaults must include

- Monthly **₹199 · 200 credits** · `offer_badges: ["Starter"]`
- 3 Months **₹549 · 600 credits** · badges `Popular`, `8% off`
- Each plan `credit_addons[]` with `card_subtitle`, `description`, **`offer_badges`** (e.g. `20% off`, `+25`)
- `credits.addon_catalog[]` — master list of add-on templates with badges
- Credit packs with `card_subtitle`, `offer_badges` where applicable

## Paid Licenses tab (admin)

- **Included / Addon credits** — readonly from plan + selected add-ons
- **Total credits** — **editable** for manual grants (customer support top-ups)
- Saves `bonus_credits` when total > plan included + addon
- `credits_balance` = remaining; must equal total − used
- Customer fields optional at create; add anytime later

## Save review modal

Config/Credits saves only — shows diff before Firebase write. Never touches licenses or Google users.

## After admin changes

1. **Load defaults → Save** or **Seed all defaults**
2. Merge extension bundle from `scripts/meesho-extension-v182/`
3. Deploy `firestore.rules` to `extension-e6e32`

See `scripts/MEESHO_EXTENSION_RELEASE_v1.8.2.md` for extension repo merge steps.
