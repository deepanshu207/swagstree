#!/usr/bin/env bash
# Deploy claimGoogleTrial to extension-e6e32 and verify endpoint.
# Auth (pick one):
#   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
#   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'  # full JSON string
set -euo pipefail

PROJECT_ID="extension-e6e32"
FUNCTION_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net/claimGoogleTrial"
EXT_DIR="${EXT_REPO_DIR:-/workspace/.extension-deploy/meesho-extension}"
EXT_BRANCH="${EXT_REPO_BRANCH:-cursor/google-trial-auth-d321}"

if [ -n "${FIREBASE_SERVICE_ACCOUNT:-}" ] && [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  SA_FILE="${RUNNER_TEMP:-/tmp}/firebase-sa.json"
  echo "$FIREBASE_SERVICE_ACCOUNT" > "$SA_FILE"
  export GOOGLE_APPLICATION_CREDENTIALS="$SA_FILE"
fi

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -z "${FIREBASE_TOKEN:-}" ]; then
  echo "ERROR: Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT (or run firebase login)."
  exit 1
fi

mkdir -p "$(dirname "$EXT_DIR")"
if [ ! -d "$EXT_DIR/.git" ]; then
  git clone -b "$EXT_BRANCH" "https://github.com/deepanshu207/meesho-shipping-optimizer-extension.git" "$EXT_DIR"
else
  git -C "$EXT_DIR" fetch origin "$EXT_BRANCH"
  git -C "$EXT_DIR" checkout "$EXT_BRANCH"
  git -C "$EXT_DIR" pull origin "$EXT_BRANCH" || true
fi

if [ ! -f "$EXT_DIR/.firebaserc" ]; then
  printf '%s\n' '{"projects":{"default":"extension-e6e32"}}' > "$EXT_DIR/.firebaserc"
fi

echo "Installing function dependencies..."
(cd "$EXT_DIR/functions" && npm install)

echo "Deploying claimGoogleTrial to $PROJECT_ID..."
(cd "$EXT_DIR" && npx firebase-tools@13 deploy --only functions:claimGoogleTrial --project "$PROJECT_ID" --non-interactive)

echo "Verifying $FUNCTION_URL ..."
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FUNCTION_URL")
if [ "$code" = "404" ]; then
  echo "ERROR: Function still returns 404 after deploy."
  exit 1
fi
echo "OK: claimGoogleTrial responded HTTP $code (401 without token is expected)."

if [ -f "$(dirname "$0")/seed-google-trial-config.js" ]; then
  echo "Seeding google_trial config (merge only)..."
  (cd "$(dirname "$0")/../.." && npm install firebase-admin --no-save 2>/dev/null || true)
  node "$(dirname "$0")/seed-google-trial-config.js"
fi

echo "Deploy complete."
