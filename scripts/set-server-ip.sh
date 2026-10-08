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
# The address lives in one place, SERVER_IP in the server's .env (see
# scripts/init-env.sh). Everything that depends on it is derived from that by
# docker-compose.override.yml: the URLs baked into the UI at build time,
# Keycloak's KC_HOSTNAME, and the proxy's certificate. So this changes
# SERVER_IP, rebuilds the UI and recreates whatever changed.
#
# Safe to re-run: if SERVER_IP already matches and the last successful run
# was for the same address, it does nothing. FORCE=1 rebuilds anyway (e.g.
# after a run that failed half-way).
#
# The citrineos-ip systemd timer (scripts/systemd) runs it at boot and every
# 5 minutes, so an IP change normally needs no one to log in.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui}"
ENV_FILE=".env"
MARKER=".deployed-ip"

# The source address of the default route is the one other machines reach
# us on; `hostname -I` order isn't guaranteed (Docker bridges are in it too).
default_ip() {
  # `|| true`: with no route yet, `ip` fails and pipefail would end the script.
  ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}' || true
}
# Fallback for a network without a default route: the first global address
# on an interface that isn't one of Docker's.
first_host_ip() {
  ip -4 -o addr show scope global | awk '$2 !~ /^(docker|br-|veth)/ {split($4, a, "/"); print a[1]; exit}' || true
}

if [ -n "${1:-}" ]; then
  ip="$1"
else
  # At boot the network may not be up yet; give DHCP a minute.
  ip=""
  for _ in $(seq 30); do
    ip="$(default_ip)"
    [ -n "$ip" ] && break
    sleep 2
  done
  ip="${ip:-$(first_host_ip)}"
fi
if ! [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  echo "Not an IPv4 address: '${ip}'" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "No ${ENV_FILE} yet - run ./scripts/init-env.sh first." >&2
  exit 1
fi

current="$(grep '^SERVER_IP=' "$ENV_FILE" | cut -d= -f2- || true)"
if [ "$current" != "$ip" ]; then
  if [ -n "$current" ]; then
    sed -i "s/^SERVER_IP=.*/SERVER_IP=${ip}/" "$ENV_FILE"
  else
    echo "SERVER_IP=${ip}" >> "$ENV_FILE"
  fi
  echo "SERVER_IP: ${current:-<unset>} -> ${ip}"
elif [ "$(cat "$MARKER" 2>/dev/null)" = "$ip" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Already deployed for ${ip} - nothing to do."
  exit 0
fi

echo "Rebuilding the UI and recreating changed services (takes a few minutes) ..."
# `build citrine-ui`, not `up --build citrine-ui`: the latter also rebuilds
# the services the UI depends on - the CSMS among them, whose recreation
# disconnects every charger for no reason.
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES build citrine-ui
# Recreates what the IP change affects: the UI (new image), keycloak and the
# proxy (their settings only apply on recreate).
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d

echo "$ip" > "$MARKER"
echo "Done. https://${ip}"
