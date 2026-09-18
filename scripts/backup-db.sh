#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
#
# SPDX-License-Identifier: Apache-2.0
#
# Dumps the ocpp-db Postgres database to backups/<timestamp>.sql.gz.
# Run from the repo root:
#
#   ./scripts/backup-db.sh
#
# Override the compose file set via COMPOSE_FILES if you're not running the
# standard production stack, e.g.:
#
#   COMPOSE_FILES="-f docker-compose.yml" ./scripts/backup-db.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml}"
DB_USER="${DB_USER:-citrine}"
DB_NAME="${DB_NAME:-citrine}"

mkdir -p backups
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
outfile="backups/${timestamp}.sql.gz"

echo "Dumping ${DB_NAME} to ${outfile} ..."
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES exec -T ocpp-db pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$outfile"

echo "Done: ${outfile} ($(du -h "$outfile" | cut -f1))"
