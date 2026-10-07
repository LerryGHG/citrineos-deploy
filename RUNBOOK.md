# Deployment runbook

Operational notes for the self-hosted CitrineOS deployment: how it's put
together, how to deploy and update it, and the fixes for problems that have
come up before.

No secrets live in this file or anywhere in the repo - see "Secrets" below.

## Quick reference

| What | Where |
|---|---|
| Repo on the server | `/home/maw/citrineos` |
| SSH user | `root` (key: `~/.ssh/citrineos_deploy_new` on the operator's laptop) |
| Operator UI | `https://<server-ip>` |
| Keycloak admin console | `https://<server-ip>/auth/admin` (realm `master`, user `kcadmin`) |
| CitrineOS users live in | Keycloak realm **`citrineos`** - not `master` |
| Chargers connect to | `ws://<server-ip>:8081` (plus 8082 / 8443 / 8444 for other security profiles) |
| Server's IP and all secrets | `/home/maw/citrineos/.env` (server only, gitignored) |
| Compose files | `-f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui` |

```bash
cd /home/maw/citrineos
C="docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui"
$C up -d          # idempotent, safe to re-run
$C ps
```

Expect `citrine`, `citrine-ui`, `graphql-engine`, `amqp-broker`, `ocpp-db`,
`minio`, `keycloak` and `proxy` running, and the one-shot init containers
(`db-init`, `hasura-metadata-init`, `keycloak-db-init`, `minio-init`,
`minio-permissions-init`) showing `Exited (0)` - that's success.

## How it's put together

- **One HTTPS address.** Browsers only ever talk to the `proxy` service
  (Caddy, `apps/ocpp-server/proxy/Caddyfile`) on `https://<server-ip>`. It
  routes `/auth/*` to Keycloak, `/v1/graphql` to Hasura, `/core/*` to the CSMS
  REST API and everything else to the operator UI. Old bookmarks on `:3010`
  and `:8180`, and plain `http://`, redirect there.
- **Nothing else is published.** Postgres, RabbitMQ, MinIO, Hasura, Keycloak
  and the CSMS REST API are only reachable inside Docker's `citrineos`
  network. Published host ports: 80/443 (proxy), 3010/8180 (redirects only),
  8081/8082/8443/8444 (OCPP, for chargers), and 8420-8423 (simulator UIs).
- **Per-server values in one untracked file.** `.env` next to the compose
  files holds `SERVER_IP` and every password/secret; docker compose reads it
  for the `${...}` references in `docker-compose.override.yml`. The tracked
  files are never edited on the server, so `git pull` there is always clean.
- **Logins are checked everywhere, not just in the UI.** See "Accounts and
  what they can do".

## Fresh deploy

On a new server with Docker and git:

```bash
cd /home/maw
git clone --branch server-deploy https://github.com/LerryGHG/citrineos-deploy.git citrineos
cd citrineos
cp scripts/docker-daemon.json /etc/docker/daemon.json && systemctl restart docker  # log + build cache limits, see "Disk space"
./scripts/init-env.sh        # creates .env with the IP and random secrets; prints the login passwords
C="docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui"
$C build citrine citrine-ui  # both are built from this repo, never pulled
$C up -d
```

Note the three passwords `init-env.sh` prints (`kcadmin`, `admin`, `user`) in
a password manager - they exist nowhere else. Keycloak creates the realm,
the `citrineos-ui` client and the `admin`/`user` accounts from
`apps/ocpp-server/keycloak/citrineos-realm.json` on its first start,
filling in the secrets from `.env`.

If the server isn't actually blank (see "A freshly cloned box already has a
`data/` directory" below), `init-env.sh` warns that the database/broker
already exist; follow "Changing a password" or wipe `apps/ocpp-server/data`.

## Updating to new code

```bash
cd /home/maw/citrineos
git pull --ff-only
$C up -d --build citrine-ui   # rebuild the UI if its code changed
$C up -d
```

If the CSMS code changed too, `$C build citrine` first.

## After a reboot

Every long-running service has `restart: unless-stopped`, so the whole stack
comes back on its own - measured at about 40 seconds. Docker ignores
`depends_on` at boot, so some services start too early, exit and are
retried: in particular Hasura shows `unhealthy` until Keycloak is up, because
it needs Keycloak's signing keys to start. That's expected and resolves
itself. One-shot init containers show `Exited (0)`.

If the server came back with a **different IP**, see the next section.

## When the server's IP changes

```bash
/home/maw/citrineos/scripts/set-server-ip.sh            # detects the IP
/home/maw/citrineos/scripts/set-server-ip.sh 10.40.2.48 # or name it
```

It sets `SERVER_IP` in `.env`, rebuilds the UI (its URLs are baked in at
build time) and recreates the services that derive from it - Keycloak
(`KC_HOSTNAME`, which ends up in every token) and the proxy (its certificate
is for the IP). Re-running it for the same IP does nothing. Browsers will
show the certificate warning again for the new address unless the root
certificate is installed (see "HTTPS").

A DHCP reservation (or static IP) for the server would remove this step
entirely. The simulator container is unaffected: it reaches the CSMS by
service name (`ws://citrine:8081`).

## HTTPS

The server has no public DNS name, so Let's Encrypt isn't possible; Caddy
signs the certificate with its own local CA. Browsers therefore warn once
("Your connection is not private" -> Advanced -> Proceed). To make the warning
go away for good on a PC, install Caddy's root certificate there:

```bash
# on the server - copy this file to the PC
/home/maw/citrineos/apps/ocpp-server/data/caddy/caddy/pki/authorities/local/root.crt
```

On Windows: double-click it -> Install Certificate -> Local Machine -> "Place
all certificates in the following store" -> **Trusted Root Certification
Authorities**. Then restart the browser. The CA lives in
`apps/ocpp-server/data/caddy`, so it survives restarts and IP changes; only
deleting that directory creates a new one (and every PC would need the new
root).

The OCPP ports chargers use are unchanged (plain `ws://` on 8081; TLS
profiles on 8443/8444 use the CSMS's own certificates, not Caddy's).

## Disk space: logs and build cache

Docker's own settings are in `/etc/docker/daemon.json`, a copy of
`scripts/docker-daemon.json`. Without them, both of these grow until the disk
is full:

- **Container logs** rotate at 50 MB and keep 5 files, with the older ones
  gzipped, so no container's logs can exceed 250 MB. The CSMS logs every OCPP
  message (about 55 MB a day with the four simulators), so `docker logs`
  goes back roughly four days for it and much longer for everything else.
- **Build cache**: kept under 10 GB. Docker's default only starts clearing it
  at about 75% of the disk, and it had reached 40 GB. `docker builder prune`
  clears it completely; the next build then takes longer.

`docker system df` shows what's using space. To change the settings, edit
the file in the repo and copy it over again. A Docker restart is needed, and
the log limits only apply to containers created afterwards, so recreate
them. `down` keeps all data. Allow about a minute of downtime:

```bash
cd /home/maw/citrine-sim && docker compose down   # it uses the citrineos network, so it goes first
cd /home/maw/citrineos && $C down
cp scripts/docker-daemon.json /etc/docker/daemon.json && systemctl restart docker
$C up -d
cd /home/maw/citrine-sim && docker compose up -d
```

Portainer (`docker run`, not Compose) keeps the old unlimited log setting
until it's recreated. It hardly logs anything, so that doesn't matter.

## Accounts and what they can do

| Role | Can |
|---|---|
| `admin` | Everything: edit stations, locations, cards, tariffs; send commands to stations. |
| `user` | View only: dashboard, stations, transactions, cost calculator, reports, card names. Can't change anything or send commands. |

The role comes from the Keycloak account's client role on `citrineos-ui`, and
is enforced in three places, so hiding a button is never the only protection:

- **UI**: `apps/operator-ui/src/lib/providers/access-control-provider/index.ts`
  decides which buttons and edit fields appear.
- **Hasura** (all data): verifies each request's Keycloak token
  (`HASURA_GRAPHQL_JWT_SECRET`) and applies the role's permissions from
  `apps/ocpp-server/hasura-metadata` - `user` has select-only permissions.
  The UI never receives Hasura's admin secret.
- **CSMS REST API** (station commands): verifies the token (`CITRINEOS_AUTH`)
  and applies `apps/ocpp-server/rbac-rules.json` - commands are `admin`-only,
  reads are open to both. Requests without a token get 401, wrong role 403.

Tokens carry the role in a top-level `roles` claim, added by a protocol
mapper on the `citrineos-ui` client (in the realm file). To change what
`user` may do, change all three places together.

### Adding / managing users

Keycloak console -> realm dropdown -> **citrineos** (not `master`) -> **Users**.

- **Add**: Add user -> fill username **and first name, last name, email**
  (the realm requires all three) -> Create -> Credentials -> Set password ->
  Role mapping -> Assign role -> filter by client `citrineos-ui` -> `admin` or
  `user`.
- **Revoke access**: toggle **Enabled** off, or delete the user.
- **Change a password**: Credentials -> Reset password. (The
  `CITRINEOS_*_PASSWORD` values in `.env` only seed a brand-new realm.)

## Secrets

All live only in the server's `.env` (mode 600, gitignored, kept out of
Docker images by `.dockerignore`):

| Key | Used by |
|---|---|
| `SERVER_IP` | UI URLs, Keycloak hostname, proxy certificate |
| `POSTGRES_PASSWORD` | database user `citrine` (CSMS, Hasura, Keycloak, init jobs) |
| `RABBITMQ_PASSWORD` | broker user `guest` (CSMS) |
| `MINIO_ROOT_PASSWORD` | MinIO root user `minioadmin` |
| `HASURA_ADMIN_SECRET` | server-side only: metadata apply |
| `KEYCLOAK_CLIENT_SECRET` | `citrineos-ui` client (Keycloak and the UI must agree) |
| `NEXTAUTH_SECRET` | UI session cookies |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | `kcadmin`, only on Keycloak's very first start |
| `CITRINEOS_ADMIN_PASSWORD` / `CITRINEOS_USER_PASSWORD` | `admin`/`user`, only when the realm is first created |

Back `.env` up somewhere safe (a password manager): if the server is lost
together with it, the database and Keycloak data can't be read with new
values.

### Changing a password

Some values are only read when their data is first created, so changing
`.env` alone isn't enough for those:

- **`POSTGRES_PASSWORD`**: set the new value in `.env`, then
  `docker exec -i citrineos-ocpp-db-1 psql -U citrine -d citrine -c "ALTER USER citrine WITH PASSWORD '<new>'"`
  (the local socket needs no password), then `$C up -d`.
- **`RABBITMQ_PASSWORD`**: set it in `.env`, then
  `docker exec citrineos-amqp-broker-1 rabbitmqctl change_password guest '<new>'`, then `$C up -d`.
- **`MINIO_ROOT_PASSWORD`, `HASURA_ADMIN_SECRET`, `NEXTAUTH_SECRET`**: `.env`,
  then `$C up -d` (a new `NEXTAUTH_SECRET` signs everyone out).
- **`KEYCLOAK_CLIENT_SECRET`**: regenerate it in the Keycloak console
  (citrineos realm -> Clients -> citrineos-ui -> Credentials), put the same
  value in `.env`, then `$C up -d`.
- **Login passwords** (`kcadmin`, `admin`, `user`, anyone else): in the
  Keycloak console only.

## Common issues

**The browser says "Your connection is not private".** Expected with the
self-signed certificate - see "HTTPS".

**Station won't start a new charging session - CSMS rejects with
`ConcurrentTx`.** Happens after a server restart/redeploy: the DB still has
an old transaction marked active for that card/station. Find and clear it:

```bash
docker exec -i citrineos-ocpp-db-1 psql -U citrine -d citrine <<'SQL'
select id, "transactionId", "stationId", "isActive", "startTime" from "Transactions" where "isActive"=true order by id;
SQL
docker exec -i citrineos-ocpp-db-1 psql -U citrine -d citrine -c 'update "Transactions" set "isActive"=false where id in (<ids>) and "isActive"=true;'
```

**`docker compose` fails with "required variable ... is missing a value".**
There's no `.env`, or it's missing a key: run `./scripts/init-env.sh` (it only
adds what's missing).

**Hasura stays `unhealthy` / the UI shows "Error loading data".** Hasura
needs Keycloak's signing keys; check Keycloak is up
(`docker ps | grep keycloak` should say `healthy`). Hasura's restart policy
retries on its own. `docker logs citrineos-graphql-engine-1` shows
`Non-2xx response on fetching JWK` while it waits.

**MinIO won't pull - Docker Hub says `minio/minio`/`minio/mc` don't exist,
or quay.io returns 401 on `quay.io/minio/*`.** MinIO's own free image
distribution changed upstream. The override pins both to
`bitnamilegacy/minio:latest` / `bitnamilegacy/minio-client:latest`, which
still pulled anonymously as of this writing. If those stop working too, it
needs a new source again. The image runs as a non-root uid, so the one-shot
`minio-permissions-init` container chowns the data directory first.

**A freshly cloned box already has a `data/` directory with something broken
in it** (seen once: a 0-byte, unwritable RabbitMQ `.erlang.cookie`, which
crashes RabbitMQ with `"Too short cookie string"` and blocks everything that
depends on it). The VM was cloned from a template with partial Docker state.
On a fresh deploy, stop the stack, `rm -rf apps/ocpp-server/data` and `up`
again.

**The `citrine` container crash-loops with `Websocket servers config file not
found: websocket-servers.json`.** Something re-pulled upstream's
`ghcr.io/citrineos/citrineos-server:latest` over the image built from this
repo (`citrine` is pinned to `pull_policy: never` to prevent that). The right
image is ~2.3 GB with working dir `/usr/local/apps/citrineos`
(`docker image inspect ghcr.io/citrineos/citrineos-server:latest --format '{{.Size}} {{.Config.WorkingDir}}'`).
Rebuild: `$C build citrine && $C up -d`.

**A container got renamed to something like
`73135591136d_citrineos-citrine-1`.** Leftover from an interrupted recreate.
Run a full `$C up -d` and Compose renames it back.

**GraphQL returns `no_queries_available`.** Hasura metadata isn't applied;
`$C up -d hasura-metadata-init`.

**A newly created Keycloak user can't log in
(`invalid_grant: Account is not fully set up`).** Either created in the
`master` realm instead of `citrineos`, or missing first name / last name /
email.

## Known limitations

- The certificate is self-signed (no DNS name for the server).
- Hasura and the CSMS don't check the token's issuer, because it contains
  the server IP; the signature still ties every token to this realm's keys.
  Keycloak's client allows any redirect URI (`*`) for the same reason.
- The simulator UIs (8420-8423) and Portainer (8000/9443) are reachable on
  the network without a login.
- No monitoring/alerting, no CI, no scheduled backups (`scripts/backup-db.sh`
  exists but only dumps the `citrine` database, not `keycloak`).
