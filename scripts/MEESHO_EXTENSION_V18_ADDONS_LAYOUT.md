# Meesho Shipping Optimizer Extension — v1.8 Add-ons layout

Copy this into **meesho-shipping-optimizer-extension** (merge from Swagstree `.extension-deploy/meesho-extension/`).

## Popup layout order (top → bottom)

1. **License status** card  
2. **💎 Subscription plans** grid (`#license-plans-grid`) — tap to **select** plan (highlight border)  
3. **➕ Add-on credits** section (`#plan-addons-section`) — **locked** until a plan is selected  
4. Google trial / license key / WhatsApp (inside `#activation-section`)  
5. **⚡ BUY CREDITS** packs (`#popup-credits-section`) — **only** when user has an **active** paid/demo license  

## Add-on section behaviour

- Class `plan-addons-section--locked` until user taps Monthly / 3 Months / etc.  
- `FirebaseLicense.renderPlanAddonsSection()` renders full **plan-style cards** per `credit_addons[]` entry.  
- Each add-on card shows: `offer_badges` or auto **% off** vs `price_per_credit`, **₹ price**, `card_subtitle`, **Save ₹X (Y% off)** line, ℹ️ detail view.  
- User toggles add-ons → **Buy selected plan on WhatsApp** (`#plan-purchase-whatsapp-btn`).  
- Plans **with** add-ons: first tap = select + unlock section (no immediate WhatsApp).  
- Plans **without** add-ons: tap = WhatsApp immediately.  
- **No inline add-on chips** under plan cards (fixes cramped 2×2 grid).

## Files changed

```
popup.html              — reorder sections; fix extra </div>; add #plan-addons-section
popup.js                — setSelectedPurchasePlan(), bindPlanPurchaseButton(), showAddonCreditDetail()
js/firebaseLicense.js   — renderPlanAddonsSection(), renderAddonCreditCard(),
                          addonOfferBadgesHtml(), formatAddonSaveLabel(),
                          renderAddonCreditDetailHtml(), getAddonCreditById()
manifest.json           — 1.8.0
```

## Firebase fields (from Swagstree admin v5.7+)

Plan `credit_addons[]`:

```json
{
  "id": "addon_25",
  "credits": 25,
  "price": 40,
  "label": "+25 credits",
  "card_subtitle": "25 credits · ₹40",
  "description": "Add 25 credits at checkout — stacks on plan included credits.",
  "offer_badges": ["20% off"],
  "active": true,
  "default_selected": false
}
```

If `offer_badges` is omitted, extension computes **% off** from `credits_config.price_per_credit` (default ₹2/credit).

## Test checklist

- [ ] No license: plans on top → locked add-ons below → select Monthly → add-ons unlock with badges + save %  
- [ ] Tap ℹ️ on add-on card → detail view with credits, price, parent plan context  
- [ ] Pick +25 → Buy on WhatsApp → message includes add-on  
- [ ] Active Monthly license: activation hidden; BUY CREDITS at bottom only  
- [ ] Plan grid has no inline chips between rows (clean 2×2)  
- [ ] Add-on +25 ₹40 shows ~20% off vs ₹2/credit base  

## Prompt for meesho-shipping-optimizer-extension repo

```
Merge extension v1.8.0 from Swagstree `.extension-deploy/meesho-extension/`:

GOAL: Subscription plans first; add-on credits section at bottom, disabled until user selects a plan; BUY CREDITS packs only for active subscribers.

CHANGES:
1. popup.html — Order: license status → activation-section (plans + add-ons + key entry) → popup-credits-section (outside activation, at bottom). Remove stray closing </div> after license card. Add #plan-addons-section with locked CSS.

2. popup.js — setSelectedPurchasePlan() highlights plan + re-renders add-ons unlocked. Plans with credit_addons: first tap selects (no WhatsApp). bindPlanPurchaseButton() for WhatsApp CTA. showAddonCreditDetail() for ℹ️ on add-on cards. refreshCreditsTopUpSection() shows BUY CREDITS only when license active.

3. js/firebaseLicense.js — Remove inline add-on chips from plan grid (planCellWrap pass-through). renderPlanAddonsSection() at bottom. renderAddonCreditCard() uses plan-style badges, save %, planCardShell with detail corner. addonOfferBadgesHtml / formatAddonSaveLabel mirror plan discount logic.

4. manifest.json → 1.8.0

After deploy: Swagstree admin → Load defaults → Save (or Seed) so Firebase has 200 credits/month and credit_addons metadata.
```
