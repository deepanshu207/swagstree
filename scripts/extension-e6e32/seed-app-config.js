#!/usr/bin/env node
/**
 * Write full shipping_optimizer_config/app defaults to extension-e6e32.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   node scripts/extension-e6e32/seed-app-config.js
 */
const admin = require('firebase-admin');

const PROJECT_ID = 'extension-e6e32';

const APP_SEED = {
  whatsapp_number: '919654414891',
  whatsapp_message: 'Hi! I want to purchase Shipping Optimizer license.',
  extension_enabled: true,
  min_extension_version: '1.7.0',
  announcement: '',
  plans: [
    { id: 'monthly', name: 'Monthly', price: 599, days: 30, duration: '1 Month', max_devices: 1, billing_mode: 'subscription', active: true, order: 0 },
    { id: 'quarterly', name: '3 Months', price: 1399, days: 90, duration: '3 Months', save: 'Save ₹1000', max_devices: 1, billing_mode: 'subscription', active: true, order: 1 },
    { id: 'halfyearly', name: '6 Months', price: 2299, days: 180, duration: '6 Months', save: 'Save ₹3000', max_devices: 1, billing_mode: 'subscription', active: true, order: 2 },
    { id: 'yearly', name: 'Yearly', price: 3099, days: 365, duration: '1 Year', save: 'Save ₹8000', best: true, max_devices: 1, billing_mode: 'hybrid', included_credits: 100, active: true, order: 3 }
  ],
  support: {
    enabled: true,
    title: 'Support team',
    page_size: 5,
    users: [{
      id: 'sales', name: 'Deepanshu', role: 'Sales & licenses',
      label: 'New plans, upgrades, payments',
      whatsapp_number: '919654414891',
      whatsapp_message: 'Hi! I need help with Shipping Optimizer.',
      active: true, order: 0
    }]
  },
  demo_keys: { 'MEESHO-DEMOFREE': { days: 30, label: 'Free trial' } },
  credits: {
    enabled: true,
    price_per_credit: 2,
    min_purchase: 10,
    cost_per_operation: 1,
    packs: [
      { id: 'pack_10', credits: 10, price: 20, label: '10 Credits', active: true, order: 0 },
      { id: 'pack_20', credits: 20, price: 38, label: '20 Credits', active: true, order: 1 },
      { id: 'pack_50', credits: 50, price: 90, label: '50 Credits', active: true, order: 2 },
      { id: 'pack_100', credits: 100, price: 170, label: '100 Credits', active: true, order: 3 }
    ],
    image_generation: {
      enabled: true,
      credits_per_image: 1,
      daily_limit: 0,
      monthly_limit: 0,
      max_batch_size: 200
    }
  },
  smart_mode: {
    variant_options: [
      { value: 20, label: '20 variants', active: true, order: 0 },
      { value: 50, label: '50 variants', active: true, order: 1 },
      { value: 100, label: '100 variants', active: true, order: 2 },
      { value: 200, label: '200 variants', active: true, order: 3 }
    ],
    default_variant: 20,
    max_variants_cap: 200,
    label: 'Max Variants',
    hint: 'Live Meesho shipping checks — finds the lowest ₹ from generated variants'
  },
  google_trial: {
    google_login_enabled: true,
    enabled: true,
    days: 7,
    trial_credits: 3,
    image_run_limit: 3,
    max_devices: 1,
    max_increment_per_run: 10,
    label: 'Google free trial',
    oauth_client_id: '860976240598-lfncu478meb0hel45vr3elf8fu5muv17.apps.googleusercontent.com',
    oauth_web_client_id: '860976240598-9djjnlud57s4fv0aul9eqdi2o8a11vr0.apps.googleusercontent.com',
    chrome_extension_id: 'dhhlaikkdfkaofbiacpoaadfademdmne'
  }
};

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  const ref = db.collection('shipping_optimizer_config').doc('app');
  await ref.set(APP_SEED, { merge: true });
  console.log('Seeded shipping_optimizer_config/app on', PROJECT_ID);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
