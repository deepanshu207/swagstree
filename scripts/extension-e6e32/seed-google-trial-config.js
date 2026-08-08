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
  google_login_enabled: true,
  enabled: true,
  days: 7,
  trial_credits: 3,
  image_run_limit: 3,
  max_increment_per_run: 10,
  max_devices: 1,
  label: 'Google free trial',
  oauth_client_id:
    '860976240598-lfncv478meb0hel45vr3elf8fu5muv17.apps.googleusercontent.com',
  oauth_web_client_id:
    '860976240598-9djjnlud57s4fv0aul9eqdi2o8a11vr0.apps.googleusercontent.com',
  chrome_extension_id: 'eginioaeefboofiplokodpinnflkhlkl',
};

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  const ref = db.collection('shipping_optimizer_config').doc('app');
  const snap = await ref.get();
  const existing = snap.exists ? snap.data()?.google_trial || {} : {};
  const merged = Object.assign({}, GOOGLE_TRIAL_DEFAULTS, existing, {
    oauth_client_id: GOOGLE_TRIAL_DEFAULTS.oauth_client_id,
    oauth_web_client_id: GOOGLE_TRIAL_DEFAULTS.oauth_web_client_id,
    chrome_extension_id: GOOGLE_TRIAL_DEFAULTS.chrome_extension_id,
    trial_credits: GOOGLE_TRIAL_DEFAULTS.trial_credits,
    image_run_limit: GOOGLE_TRIAL_DEFAULTS.image_run_limit,
  });
  delete merged.function_url;
  delete merged.credits;

  await ref.set({ google_trial: merged }, { merge: true });
  await ref.update({
    'google_trial.function_url': admin.firestore.FieldValue.delete(),
    'google_trial.credits': admin.firestore.FieldValue.delete(),
  });
  console.log('Merged shipping_optimizer_config/app.google_trial on', PROJECT_ID);
  console.log(JSON.stringify(merged, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
