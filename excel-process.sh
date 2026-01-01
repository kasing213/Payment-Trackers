#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT/excel-processor-local"
ENV_FILE="$APP_DIR/.env"

if [ ! -d "$APP_DIR" ]; then
  echo "excel-processor-local not found at $APP_DIR" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example and set required values." >&2
  exit 1
fi

required_keys=(
  RAILWAY_API_URL
  API_KEY
  OPENAI_API_KEY
  EXCEL_UPLOAD_FOLDER
  EXCEL_PROCESSING_FOLDER
  EXCEL_PROCESSED_FOLDER
  EXCEL_FAILED_FOLDER
)
missing=()
for key in "${required_keys[@]}"; do
  if ! grep -E "^${key}=" "$ENV_FILE" >/dev/null; then
    missing+=("$key")
  fi
done

if [ "${#missing[@]}" -ne 0 ]; then
  echo "Missing keys in $ENV_FILE: ${missing[*]}" >&2
  exit 1
fi

cd "$APP_DIR"

if [ ! -d node_modules ]; then
  npm install
fi

if [ ! -f dist/index.js ]; then
  npm run build
fi

npm start
