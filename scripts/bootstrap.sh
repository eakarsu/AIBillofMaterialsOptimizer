#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$project_dir"
if [ ! -f .env ]; then cp .env.example .env; echo "Created .env; replace placeholders before starting."; fi
(cd server && npm ci)
(cd client && npm ci)
echo "Dependencies installed. Database changes were not applied; run scripts/migrate.sh explicitly."
