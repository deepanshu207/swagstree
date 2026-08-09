# Meesho Shipping Optimizer Extension — Implementation Prompt

Copy this entire prompt into the **meesho-shipping-optimizer-extension** repo (Cursor agent or PR description).  
Swagstree admin (PR #115+) now writes all config below to Firebase `extension-e6e32` → `shipping_optimizer_config/app`.

**Target extension version:** `1.7.8+`  
**Swagstree admin v5.3+** seeds full plan detail examples + credit formulas (see Built-in defaults tab).

---

## Default included credits (admin seed → extension activation)

| Plan | Price | Credits | Formula |
|------|-------|---------|---------|
| Monthly | **₹199** | **200** | `200/mo` fixed grant |
| 3 Months | **₹549** | **600** | `200×3` credits · `199×3−48` price (~8% off ₹597) |
| 6 Months | **₹1,045** | **1,200** | `200×6` credits · `199×6×(1−12.5%)` price |
| Yearly | **₹1,980** | **2,400** | `200×12` credits · `199×12×(1−17%)` price |

Monthly includes **credit add-ons** (+10/+25) at purchase. **Existing customers** on any active plan buy **credit packs** in the popup (⚡ BUY CREDITS) — v1.7.8 moves this section outside the hidden activation area.

### Plan card copy (customer-facing — v5.6+)

Each plan must show **subtitle + save badge** (both visible — not either/or):

| Plan | `card_subtitle` (below price) | `save` |
|------|-----------------|--------|
| Monthly | `30 days · 200 credits` | — |
| 3 Months | `90 days · 600 credits` | `Save ₹48 (8% off)` |
| 6 Months | `180 days · 1,200 credits` | `Save ₹149 (12.5% off)` |
| Yearly | `1 year · 2,400 credits` | `Save ₹408 (17% off)` |

- **Do not show device limits** on plan cards or detail screens (licensed users get `unlimited_devices: true`).
- **Do not show OAuth setup** diagnostics in the popup (`#google-trial-redirect` stays hidden).
- Google trial still enforces `max_devices` server-side — users never see this count.

---

## v1.7.8 — Credit top-up for active plans

1. `popup.html` — `#popup-credits-section` below license status (not inside `#activation-section`)
2. `popup.js` — `refreshCreditsTopUpSection(licenses)` shows packs when any active license exists
3. `license.js` — subscription + `includedCredits` counts as credit billing

See `scripts/EXTENSION_SYNC_V178.md` for file list.

---

## Goals

1. **Plan offer badges** — render `offer_badges[]` on plan cards via `planOfferBadgesHtml()` in `firebaseLicense.js` (below BEST VALUE tag, above plan name). CSS: `.plan-offer-badges` / `.plan-offer-badge` in `popup.html`.
2. **Plan visibility** — only show plans where `active !== false` (already expected; verify).
3. **Hide Google login** — respect `google_trial.google_login_enabled === false` → hide “Continue with Google” everywhere.
4. **Device policy (defaults)**
   - **Google signed-in users:** enforce `google_trial.max_devices` (default `1`) via `shipping_optimizer_google_trials/{uid}.machine_ids`.
   - **License-key users (no Google sign-in):** **no device limit** — shared license keys allowed (`unlimited_devices` default true on new licenses; `resolveUnlimitedDevices` returns true for license path).
5. **Credit consumption order** — when user has **both** Google trial + paid license:
   - Consume **Google trial credits first** (`images_used` / `images_limit` on trial doc).
   - Only after trial exhausted → deduct from paid license `credits_balance`.
6. **Silent Google re-auth** — no OAuth popup on return visits (session + silent token; see v1.7.7 work).
7. **Plan detail fields** — render `description`, `highlights`, `features`, `detail_sections`, `card_subtitle`, `card_hint`, `cta_text`, `detail_footer` on plan/pack detail screens (already in admin seed).

---

## Admin per-user overrides (Google Users tab)

Superadmin can patch any field on `shipping_optimizer_google_trials/{uid}` via the **Manage** modal:

| Field | Admin UI | Firestore keys |
|-------|----------|----------------|
| Total credits | Editable number | `images_limit`, `trial_credits` (kept in sync) |
| Balance (remaining) | Editable number | Derived: `images_limit - images_used` |
| Used | Editable number | `images_used` |
| Access time | Unlimited toggle + expiry datetime | `unlimited_time`, `expires_at`, `days_granted` |
| Devices | Reset bindings | `machine_ids[]` |
| Status | Revoke / reactivate | `active` |

**Save flow:** Admin edits total/balance/used → **Save credits** writes all three atomically.

Extension must read **per-user** `unlimited_time`, `expires_at`, `images_limit`, and `images_used` from the trial doc (not only global config).

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
  "offer_badges": ["Best deal", "17% bonus credits"],
  "billing_mode": "hybrid",
  "included_credits": 2000,
  "description": "Best for full-time Meesho sellers…",
  "highlights": ["~2,000 credits", "Optional add-ons"],
  "features": [{ "icon": "📅", "title": "1 year access", "text": "…" }],
  "detail_sections": [{ "title": "What's included", "items": ["…"] }],
  "card_subtitle": "1 year · ~2,000 credits · Save ₹8000"
}
```

---

## Google trial (`config.google_trial`)

| Field | Default | Behavior |
|-------|---------|----------|
| `google_login_enabled` | `true` | `false` → hide Google sign-in button |
| `enabled` | `true` | `false` → block new trial claims |
| `unlimited_time` | `true` | No calendar expiry for Google users |
| `max_devices` | `1` | Device limit for Google accounts |
| `trial_credits` | `3` | Free runs per Google uid |

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
