# Meesho extension — Google users fix (v1.8.1)

## Problem

Admin **Google Users** tab reads `shipping_optimizer_google_trials`, but extension v1.8.0 wrote to **`google_trials`**. Firestore rules only secure the prefixed collection, so trials either failed to create or landed in an invisible collection — admin showed **0 Google users**.

## Fix (one line + deploy rules)

**`js/firebaseLicense.js`**

```javascript
googleTrialCollection() {
  return "shipping_optimizer_google_trials";
}
```

**`firestore.rules`** — add legacy read for superadmin migration:

```
match /google_trials/{uid} {
  allow read, write: if isShippingOptimizerSuperAdmin();
}
```

Bump **`manifest.json`** → `1.8.1`.

## After deploy

1. Publish extension 1.8.1 to Chrome Web Store / sideload.
2. Deploy updated `firestore.rules` to **extension-e6e32**.
3. Swagstree admin → **Google Users** → **Refresh** (admin v5.9+ merges legacy `google_trials` if any exist).
4. New sign-ins appear immediately under `shipping_optimizer_google_trials/{uid}`.

## Test

- [ ] Extension popup → Continue with Google → success
- [ ] Firebase console → `shipping_optimizer_google_trials/{uid}` doc created
- [ ] Swagstree admin → Google Users → row with email + credits
- [ ] Manage modal → adjust credits / revoke / link license

## Copy-paste prompt for meesho-shipping-optimizer-extension repo

```
Fix Google trial collection name (v1.8.1):

In js/firebaseLicense.js, googleTrialCollection() must return "shipping_optimizer_google_trials" (NOT "google_trials"). This matches Firestore rules and Swagstree admin Google Users tab.

Deploy firestore.rules with superadmin read/write on legacy google_trials/{uid} for migration.

manifest.json → 1.8.1

No other extension changes required for this fix.
```
