#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
#
# SPDX-License-Identifier: Apache-2.0
#
# Creates the server's .env, or adds whatever is missing from it. Run on the
# server before the first `docker compose up`:
#
#   ./scripts/init-env.sh
#
# .env holds everything that differs per server - its IP and every password
# and secret - and is read automatically by docker compose for the ${...}
# references in docker-compose.override.yml. It is gitignored and exists only
# on the server, so the tracked files are never edited there. Values already
# in .env are never changed; only missing ones are generated.
#
# Keep a copy of the generated login passwords somewhere safe (a password
# manager): they exist nowhere else.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
ENV_FILE=".env"

# Hex from /dev/urandom: URL-safe (several of these end up inside URLs) and
# no pipeline that gets cut short, which `set -o pipefail` would turn into an error.
secret() { od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'; }
default_ip() {
  ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

added=()
ensure() {
  local key="$1" value="$2"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    added+=("$key")
  fi
}

ensure SERVER_IP "$(default_ip)"
# Machine-to-machine secrets: long, nobody types them.
ensure POSTGRES_PASSWORD "$(secret 20)"
ensure RABBITMQ_PASSWORD "$(secret 20)"
ensure MINIO_ROOT_PASSWORD "$(secret 20)"
ensure HASURA_ADMIN_SECRET "$(secret 20)"
ensure KEYCLOAK_CLIENT_SECRET "$(secret 20)"
ensure NEXTAUTH_SECRET "$(secret 32)"
# Login passwords: shorter so they can be typed, still 64 random bits.
ensure KC_BOOTSTRAP_ADMIN_PASSWORD "$(secret 8)"
ensure CITRINEOS_ADMIN_PASSWORD "$(secret 8)"
ensure CITRINEOS_USER_PASSWORD "$(secret 8)"

if [ ${#added[@]} -eq 0 ]; then
  echo "${ENV_FILE} already complete - nothing changed."
  exit 0
fi

echo "Added to ${ENV_FILE}: ${added[*]}"
for key in KC_BOOTSTRAP_ADMIN_PASSWORD CITRINEOS_ADMIN_PASSWORD CITRINEOS_USER_PASSWORD; do
  if [[ " ${added[*]} " == *" $key "* ]]; then
    echo "  $key=$(grep "^${key}=" "$ENV_FILE" | cut -d= -f2-)   <- note this down"
  fi
done

# These three are only read when their data directory is first created. On a
# server that already has data, a freshly generated value doesn't match what
# the running service uses until it is changed there too.
data="apps/ocpp-server/data"
if [[ " ${added[*]} " == *" POSTGRES_PASSWORD "* && -d "$data/postgresql" ]] ||
   [[ " ${added[*]} " == *" RABBITMQ_PASSWORD "* && -d "$data/rabbitmq" ]] ||
   [[ " ${added[*]} " == *" KC_BOOTSTRAP_ADMIN_PASSWORD "* && -d "$data/postgresql" ]]; then
  echo
  echo "WARNING: existing data found. New database/broker/Keycloak-admin passwords"
  echo "were generated but the running services still use their old ones."
  echo "Apply them as described in RUNBOOK.md (\"Changing a password\") before"
  echo "running docker compose up."
fi
