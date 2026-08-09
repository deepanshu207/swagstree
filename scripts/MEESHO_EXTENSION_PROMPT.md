# Meesho Shipping Optimizer Extension — Implementation Prompt

Copy this entire prompt into the **meesho-shipping-optimizer-extension** repo (Cursor agent or PR description).  
Swagstree admin (PR #115+) now writes all config below to Firebase `extension-e6e32` → `shipping_optimizer_config/app`.

**Target extension version:** `1.7.8+`

---

## Goals

1. **Plan offer badges** — render `offer_badges[]` on plan cards (in addition to `best` and `save`).
2. **Plan visibility** — only show plans where `active !== false` (already expected; verify).
3. **Hide Google login** — respect `google_trial.google_login_enabled === false` → hide “Continue with Google” everywhere.
4. **Device policy (defaults)**
   - **Google signed-in users:** enforce `google_trial.max_devices` (default `1`) via `shipping_optimizer_google_trials/{uid}.machine_ids`.
   - **License-key users (no Google sign-in):** **no device limit** — shared license keys allowed (`unlimited_devices` default true on new licenses; `resolveUnlimitedDevices` returns true for license path).
5. **Credit consumption order** — when user has **both** Google trial + paid license:
   - Consume **Google trial credits first** (`images_used` / `images_limit` on trial doc).
   - Only after trial exhausted → deduct from paid license `credits_balance`.
6. **Silent Google re-auth** — no OAuth popup on return visits (session + silent token; see v1.7.7 work).

---

## Firebase config fields (admin → extension)

### Plans (`config.plans[]`)

| Field | Type | Extension behavior |
|-------|------|-------------------|
| `active` | boolean | `false` = hidden from popup/plan grid (do not delete) |
| `best` | boolean | Show “BEST VALUE” tag (only one plan should have this) |
| `save` | string | Green savings line under price (e.g. `Save ₹8000`) |
| `offer_badges` | string[] | **NEW** — pill badges on plan card, e.g. `["20% OFF", "Limited time"]` |
| `card_subtitle`, `card_hint`, `cta_text` | string | Existing card/detail fields |
| `unlimited_devices` / `max_devices` | | Display only for plans; **license activation** ignores device cap unless admin explicitly sets restrictive override |

**Example plan snippet:**
```json
{
  "id": "yearly",
  "name": "Yearly",
  "price": 3099,
  "days": 365,
  "active": true,
  "best": true,
  "save": "Save ₹8000",
  "offer_badges": ["Best deal", "Limited slots"],
  "billing_mode": "hybrid",
  "included_credits": 100
}
```

### Google trial (`config.google_trial`)

| Field | Default | Behavior |
|-------|---------|----------|
| `google_login_enabled` | `true` | `false` → **hide** Google sign-in button in popup/content |
| `enabled` | `true` | `false` → block **new** trial claims; existing trials still work |
| `unlimited_time` | `true` | Signed-in users: **no calendar expiry**; access by credits only |
| `max_devices` | `1` | Device limit for Google accounts |
| `trial_credits` / `image_run_limit` | `3` | Free runs per Google uid |

---

## Code changes required

### 1. `js/firebaseLicense.js` — plan rendering

In `renderPlanButtons()` (popup + modal variants), after `BEST VALUE` tag and before plan name:

```javascript
const offerBadges = (p.offer_badges || [])
  .filter(Boolean)
  .map((text) =>
    `<span class="plan-offer-badge">${this.escapeHtml(text)}</span>`,
  )
  .join("");
// Insert offerBadges in button HTML (popup: inside .plan-btn, above .plan-name)
```

Add CSS in `popup.html` (or shared styles):
```css
.plan-offer-badge {
  display: inline-block;
  margin: 2px 4px 2px 0;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(230, 126, 34, 0.15);
  color: #e67e22;
  font-size: 8px;
  font-weight: 700;
}
```

Ensure `parsePlansRaw` / `normalizePlan` preserves `offer_badges: string[]`.

Filter plans: `plans.filter(p => p.active !== false)` before render (verify in `getPricingPlans`).

### 2. `js/firebaseLicense.js` — device policy

`resolveUnlimitedDevices(lic, plan)` for **license collection** (not google_trials):
- Return `true` by default (no device cap for license-key activation).
- Google trial device limits stay in `refreshGoogleTrial()` / `claimGoogleFreeTrial()`.

Do **not** block license activation when `device_ids.length >= max_devices` unless admin explicitly set `unlimited_devices: false` on that license doc.

### 3. `js/license.js` — credit order (trial → paid)

Verify / enforce in `chargeImageGenerationRun()` and `consumeCreditsWithFallback()`:

1. If `getGoogleTrialEntry()` has remaining runs (`googleTrialHasRemainingRuns`) → `incrementGoogleTrialRun()` first.
2. Else → `consumeCreditsWithFallback()` on paid license only.

`getCreditSources()` must **exclude** `planType === 'google_trial'` from paid credit deduction.

`canGenerateImages()` already has `trialFirst: true` path — keep aligned with charge path.

### 4. `js/firebaseAuth.js` — silent sign-in (v1.7.7+)

- `ensureSignedIn()` tries Firebase session refresh → silent `getAuthToken` / `prompt=none` web flow before interactive OAuth.
- No `select_account` after first consent (`googleOAuthConsent` flag).

### 5. `popup.js` — hide Google login

Where Google button is shown, gate on:
```javascript
const cfg = await FirebaseLicense.getGoogleTrialPublicConfig();
if (!cfg.google_login_enabled) { hideGoogleButton(); }
```

Also check `isGoogleLoginEnabled()` before rendering activation section.

### 6. `manifest.json`

Bump version to `1.7.8`.

---

## Files to touch (checklist)

- [ ] `js/firebaseLicense.js` — `offer_badges` render, plan active filter, device policy
- [ ] `js/license.js` — trial-first credit charge, exclude trial from `getCreditSources`
- [ ] `js/firebaseAuth.js` — silent re-auth (merge from v1.7.7 if not done)
- [ ] `popup.js` / `popup.html` — hide Google login, offer badge CSS
- [ ] `content.js` — hide Google CTA if `google_login_enabled === false`
- [ ] `manifest.json` — version bump

---

## Test scenarios

1. Plan with `offer_badges: ["Flash sale"]` → badge visible on card; plan with `active: false` → hidden.
2. `google_login_enabled: false` in Firebase → no Google button in popup.
3. Same license key on 3 devices → all activate (no device limit).
4. Google user on device A, try device B with same Gmail → blocked at `max_devices: 1`.
5. User signed in + paid license with credits → image run deducts trial first, then license balance.
6. Second app open → Google sign-in without popup (silent session).

---

## Admin deploy (Swagstree)

After merging swagstree PR:
1. Hard-refresh superadmin (`shipping-optimizer-admin.js?v=4.9`).
2. **Config → General** — toggle “Show Google sign-in”; **Pricing plans** — set offer badges, hide/show plans.
3. **Google Free Trial** — save recommended defaults (`unlimited_time`, `max_devices: 1`).
4. Deploy Firestore rules if not done: `bash scripts/extension-e6e32/deploy-firestore-rules.sh`
5. Publish extension **v1.7.8** to Chrome Web Store / Kiwi sideload.
