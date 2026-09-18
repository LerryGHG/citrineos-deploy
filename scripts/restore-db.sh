#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
#
# SPDX-License-Identifier: Apache-2.0
#
# Restores the ocpp-db Postgres database from a dump made by backup-db.sh.
# This REPLACES the current database contents. Run from the repo root:
#
#   ./scripts/restore-db.sh backups/20260101T000000Z.sql.gz
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-dump.sql.gz>" >&2
  exit 1
fi

infile="$1"
if [[ ! -f "$infile" ]]; then
  echo "No such file: $infile" >&2
  exit 1
fi

COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml}"
DB_USER="${DB_USER:-citrine}"
DB_NAME="${DB_NAME:-citrine}"

echo "This will REPLACE all data in '${DB_NAME}' with the contents of ${infile}."
read -r -p "Type 'yes' to continue: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

# shellcheck disable=SC2086
gunzip -c "$infile" | docker compose $COMPOSE_FILES exec -T ocpp-db psql -U "$DB_USER" -d "$DB_NAME"

echo "Restore complete. If citrine/graphql-engine were running through this, restart them:"
echo "  docker compose $COMPOSE_FILES restart citrine graphql-engine"
