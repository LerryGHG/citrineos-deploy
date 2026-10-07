#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
#
# SPDX-License-Identifier: Apache-2.0
#
# Points the deployment at the server's current IP address and applies it.
# Run on the server after it came back with a new IP:
#
#   ./scripts/set-server-ip.sh             # use this host's primary IP
#   ./scripts/set-server-ip.sh 10.40.2.48  # or name it
#
# The browser-facing URLs in apps/operator-ui/.env.local (baked into the UI
# at build time) and Keycloak's KC_HOSTNAME in docker-compose.override.yml
# must carry the address people reach the server on. This rewrites only the
# host part of exactly those settings - whatever it currently is, an old IP
# or the tracked "localhost" placeholder - and never touches the secrets in
# the same files. Then it rebuilds the UI and recreates whatever changed.
#
# Safe to re-run: if the files already point at the address and the last
# successful run was for the same address, it does nothing. FORCE=1 rebuilds
# anyway (e.g. after a run that failed half-way).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui}"
ENV_FILE="apps/operator-ui/.env.local"
OVERRIDE_FILE="docker-compose.override.yml"
MARKER=".deployed-ip"
URL_KEYS="NEXT_PUBLIC_API_URL NEXT_PUBLIC_WS_URL NEXT_PUBLIC_CITRINE_CORE_URL NEXT_PUBLIC_FILE_SERVER_URL NEXTAUTH_URL NEXT_PUBLIC_KEYCLOAK_URL"

# The source address of the default route is the one other machines reach
# us on; `hostname -I` order isn't guaranteed (Docker bridges are in it too).
default_ip() {
  ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}
ip="${1:-$(default_ip)}"
ip="${ip:-$(hostname -I | awk '{print $1}')}"
if ! [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  echo "Not an IPv4 address: '${ip}'" >&2
  exit 1
fi

# Placeholders still present means a fresh clone whose secrets were never
# set; a UI built from that can't log in, so don't pretend to fix anything.
if grep -q 'REPLACE_WITH_GENERATED' "$ENV_FILE" "$OVERRIDE_FILE"; then
  echo "Secrets in ${ENV_FILE} / ${OVERRIDE_FILE} are still REPLACE_WITH_GENERATED_* placeholders." >&2
  echo "Set them first (see apps/ocpp-server/keycloak/README.md), then re-run." >&2
  exit 1
fi

before="$(md5sum "$ENV_FILE" "$OVERRIDE_FILE")"
for key in $URL_KEYS; do
  # KEY=scheme://HOST:port/...  ->  KEY=scheme://<ip>:port/...
  sed -i -E "s#^(${key}=[a-z]+://)[^:/]+:#\1${ip}:#" "$ENV_FILE"
done
sed -i -E "s#^([[:space:]]*KC_HOSTNAME:[[:space:]]*[a-z]+://)[^:/]+:#\1${ip}:#" "$OVERRIDE_FILE"
after="$(md5sum "$ENV_FILE" "$OVERRIDE_FILE")"

echo "Server address: ${ip}"
grep -E "^($(echo "$URL_KEYS" | tr ' ' '|'))=" "$ENV_FILE" | sed 's/^/  /'
grep -E '^[[:space:]]*KC_HOSTNAME:' "$OVERRIDE_FILE" | sed -E 's/^[[:space:]]*/  /'

if [ "$before" = "$after" ] && [ "$(cat "$MARKER" 2>/dev/null)" = "$ip" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Already deployed for ${ip} - nothing to do."
  exit 0
fi

echo "Rebuilding the UI and recreating changed services (takes a few minutes) ..."
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d --build citrine-ui
# The UI build only touches services it depends on; this picks up the rest,
# in particular keycloak, whose KC_HOSTNAME only applies on recreate.
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d

echo "$ip" > "$MARKER"
echo "Done. UI: http://${ip}:3010   Keycloak: http://${ip}:8180"
