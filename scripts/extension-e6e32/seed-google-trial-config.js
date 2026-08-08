#!/usr/bin/env node
/**
 * Merge google_trial defaults into shipping_optimizer_config/app on extension-e6e32.
 * Does NOT overwrite plans, demo_keys, credits, support, whatsapp, etc.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   node scripts/extension-e6e32/seed-google-trial-config.js
 */
const admin = require('firebase-admin');

const PROJECT_ID = 'extension-e6e32';
const GOOGLE_TRIAL_DEFAULTS = {
  enabled: true,
  days: 7,
  credits: 30,
  max_devices: 1,
  label: 'Google free trial',
  oauth_client_id:
    '860976240598-9djjnlud57s4fv0aul9eqdi2o8a11vr0.apps.googleusercontent.com',
  function_url:
    'https://us-central1-extension-e6e32.cloudfunctions.net/claimGoogleTrial',
};

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  const ref = db.collection('shipping_optimizer_config').doc('app');
  const snap = await ref.get();
  const existing = snap.exists ? snap.data()?.google_trial || {} : {};
  const merged = { ...GOOGLE_TRIAL_DEFAULTS, ...existing };

  await ref.set({ google_trial: merged }, { merge: true });
  console.log('Merged shipping_optimizer_config/app.google_trial on', PROJECT_ID);
  console.log(JSON.stringify(merged, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
