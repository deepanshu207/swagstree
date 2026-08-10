# Meesho Shipping Optimizer Extension — v1.8.2 release

**Copy from:** `scripts/meesho-extension-v182/` → `deepanshu207/meesho-shipping-optimizer-extension` (repo root)

Or merge branch `cursor/addon-credits-layout-a3ba` from local `.extension-deploy/meesho-extension/`.

---

## What’s in v1.8.2

| Area | Change |
|------|--------|
| **Add-on credits** | Plans first; add-ons at bottom, locked until plan selected; plan-style cards with % off |
| **BUY CREDITS** | Bottom section only for active subscribers (outside hidden activation block) |
| **Google trials** | Writes to `shipping_optimizer_google_trials` (fixes admin Google Users tab) |
| **OAuth** | Pinned extension ID `ibeijdggldhedpioahdjkhpcpmgieoch`; fixed client ID typo |
| **License UI** | No device count on cards; subscription plans show credit top-up when applicable |
| **Google sign-in** | `FirebaseAuth.ensureSignedIn()` for trial flow |

---

## Files to replace

```
manifest.json          → 1.8.2
config.js              → VERSION 1.8.2, CHROME_EXTENSION_ID, oauth client IDs
popup.html
popup.js
js/firebaseLicense.js
js/firebaseAuth.js
js/license.js
firestore.rules        → shipping_optimizer_google_trials + legacy google_trials superadmin rule
```

---

## Deploy checklist

1. **Merge files** into `meesho-shipping-optimizer-extension` and bump store listing.
2. **Deploy Firestore rules** to `extension-e6e32`:
   ```bash
   firebase deploy --only firestore:rules --project extension-e6e32
   ```
3. **Swagstree admin** → Load defaults → Save (or Seed) for 200 credits/month + add-on metadata.
4. **Test extension popup:**
   - No license: plans → locked add-ons → select Monthly → unlock → WhatsApp
   - Active license: BUY CREDITS at bottom only
   - Google sign-in → doc in `shipping_optimizer_google_trials/{uid}`
5. **Swagstree admin** → Google Users → Refresh → row appears

---

## Copy-paste prompt for meesho-shipping-optimizer-extension

```
Release v1.8.2 — merge from Swagstree scripts/meesho-extension-v182/

1. Replace: manifest.json, config.js, popup.html, popup.js,
   js/firebaseLicense.js, js/firebaseAuth.js, js/license.js, firestore.rules

2. Critical: googleTrialCollection() returns "shipping_optimizer_google_trials"

3. Popup order: subscription plans → add-on section (locked) → activation → BUY CREDITS (active only)

4. config.js: VERSION 1.8.2, CHROME_EXTENSION_ID ibeijdggldhedpioahdjkhpcpmgieoch

5. Deploy firestore.rules to extension-e6e32

6. Publish extension to Chrome / sideload for Kiwi
```

---

## Related Swagstree docs

- `scripts/MEESHO_EXTENSION_V18_ADDONS_LAYOUT.md`
- `scripts/MEESHO_EXTENSION_GOOGLE_TRIALS_FIX.md`
- `scripts/EXTENSION_SYNC_V178.md`
