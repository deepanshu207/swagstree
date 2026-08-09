#!/usr/bin/env bash
# Deploy shipping_optimizer_* Firestore rules to extension-e6e32.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_ID="extension-e6e32"

if [[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  echo "Set GOOGLE_APPLICATION_CREDENTIALS to extension-e6e32 service account JSON" >&2
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "Installing firebase-tools..."
  npm install -g firebase-tools
fi

cd "$ROOT"
firebase deploy --only firestore:rules --project "$PROJECT_ID" --config firebase.extension.json
echo "Deployed firestore.extension.rules to $PROJECT_ID"
