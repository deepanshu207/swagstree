# Meesho extension v1.7.8 — sync from Swagstree workspace

Copy these changes into `deepanshu207/meesho-shipping-optimizer-extension`:

## Critical fix: credit packs for active Monthly (and any) plan

**Problem:** `popup-credits-section` lived inside `#activation-section`, which is hidden when the user already has an active license. Monthly subscribers could not see **BUY CREDITS** packs.

**Fix:**
- `popup.html` — move `#popup-credits-section` **outside** `#activation-section` (below license status card)
- `popup.js` — add `refreshCreditsTopUpSection()`; show packs when user has **any** active non-demo license and `credits.enabled`
- `license.js` — `requiresCreditBilling()` includes subscription plans with `includedCredits` or `creditsBalance` > 0

## offer_badges on plan cards (v1.7.7+)

- `js/firebaseLicense.js` — `parseOfferBadges`, `planOfferBadgesHtml`, render on plan cards
- `popup.html` — CSS `.plan-offer-badges` / `.plan-offer-badge`

## Admin defaults (Firebase via Swagstree v5.4)

| Plan | Price | Credits |
|------|-------|---------|
| Monthly | **₹199** | 19 |
| 3 Months | ₹547 (199×3−50) | 549 |
| 6 Months | ₹1,044 | 1,050 |
| Yearly | ₹1,980 | ~2,000 |

Monthly plan: `allow_credit_addons: true` (+10 / +25 at purchase).

## Files changed

```
popup.html
popup.js
js/license.js
js/firebaseLicense.js  (offer_badges — if not already merged)
manifest.json          → 1.7.8
```

After merge: publish extension + **Seed all defaults** or Load defaults → Save in Swagstree admin.
