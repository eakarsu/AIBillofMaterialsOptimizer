#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$project_dir"
set -a; . ./.env; set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
for migration in server/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"; done
