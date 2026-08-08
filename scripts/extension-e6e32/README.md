# extension-e6e32 — Google free trial backend

Firebase project for the Meesho Shipping Optimizer Chrome extension (NOT `swagstree-web`).

## 1. Firestore config (Task 1)

Merge `google_trial` into `shipping_optimizer_config/app` (other fields untouched).

**Option A — Swagstree Superadmin:** Shipping Optimizer → Google Free Trial → **Save recommended defaults to Firebase**

**Option B — CLI** (requires service account with Firestore write):

```bash
cd /path/to/swagstree
npm install firebase-admin --no-save
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/extension-e6e32-sa.json
node scripts/extension-e6e32/seed-google-trial-config.js
```

## 2. Deploy Cloud Function (Task 2)

From extension repo `deepanshu207/meesho-shipping-optimizer-extension`:

```bash
git checkout cursor/google-trial-auth-d321   # or main
cd functions && npm install && cd ..
firebase login
firebase deploy --only functions:claimGoogleTrial --project extension-e6e32
```

Verify: open `https://us-central1-extension-e6e32.cloudfunctions.net/claimGoogleTrial` — should **not** be 404 (405 on GET is OK).

Requires **Blaze** plan.

## 3. Firestore rules (Task 4)

Copy `firestore.extension.rules` from this repo to Firebase Console → extension-e6e32 → Firestore → Rules, or:

```bash
firebase deploy --only firestore:rules --project extension-e6e32
```

(Requires `firebase.json` rules entry in extension or swagstree deploy config.)

## 4. OAuth (Task 3)

- Extension ID: `kgnmnoaobnpfaaipnjkkidekbajpldlm`
- Redirect URI: `https://kgnmnoaobnpfaaipnjkkidekbajpldlm.chromiumapp.org/`
- Web client ID: `860976240598-9djjnlud57s4fv0aul9eqdi2o8a11vr0.apps.googleusercontent.com`

## 5. End-to-end test (Task 6)

1. Extension popup → Continue with Google
2. Sign in with test Gmail (OAuth consent screen test user if app is in Testing)
3. Expect: "Free trial activated (7 days)", 30 credits
4. Re-sign-in → same `GTRIAL-*` license
5. After expiry → trial expired message
