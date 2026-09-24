# Deployment runbook

Operational notes for the self-contained test deployment of CitrineOS. This
covers the stuff that isn't obvious from the code and has had to be
rediscovered more than once — SSH access, what breaks when the server's IP
changes, Keycloak gotchas, and the fixes for problems that have come up
before.

No real secrets live in this file or anywhere in this repo — see
"Secrets" below for where they actually live.

## Quick reference

| What | Where |
|---|---|
| Repo on the server | `/home/maw/citrineos` |
| SSH user | `root` |
| Operator UI | `http://<server-ip>:3010` |
| Keycloak admin console | `http://<server-ip>:8180/admin` (realm `master`, user `kcadmin`) |
| CitrineOS users live in | Keycloak realm **`citrineos`** — not `master` |
| Hasura console | `http://<server-ip>:8090` (admin secret `CitrineOS!`) |
| Compose files | `docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui` |

Bring the whole stack up (idempotent, safe to re-run):

```bash
cd /home/maw/citrineos
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui up -d
```

Expect 8 containers running (`citrine`, `citrine-ui`, `graphql-engine`,
`amqp-broker`, `ocpp-db`, `minio`, `keycloak`) plus three one-shot init
containers (`db-init`, `hasura-metadata-init`, `keycloak-db-init`) that
should show `Exited (0)` — that's success, not a crash.

## SSH access

The deploy key is `~/.ssh/citrineos_deploy_new` on the operator's laptop.
**A fresh VM (redeploy, not just a reboot) won't have it in
`/root/.ssh/authorized_keys`.** Get the public key:

```bash
cat ~/.ssh/citrineos_deploy_new.pub
```

Add it on the server (any way you currently have in — console, provider
web shell):

```bash
mkdir -p /root/.ssh && echo '<paste the public key>' >> /root/.ssh/authorized_keys && chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys
```

A plain **reboot** (same disk, new IP) usually keeps the key — try connecting
before regenerating anything.

## When the server's IP changes

This has happened three times so far (redeploys and reboots both do it) and
is the single biggest source of repeated breakage. Four files/values need
the new IP, and it's easy to miss one:

1. **`apps/operator-ui/.env.local`** — `NEXT_PUBLIC_API_URL`,
   `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_CITRINE_CORE_URL`,
   `NEXT_PUBLIC_FILE_SERVER_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_KEYCLOAK_URL`.
   These are baked into the browser bundle at *build* time, so a container
   restart alone won't pick up a fix — the UI needs rebuilding after.
2. **`docker-compose.override.yml`** — the `keycloak` service's
   `KC_HOSTNAME`. Must match `NEXT_PUBLIC_KEYCLOAK_URL` above exactly, or
   Keycloak issues tokens with an `iss` claim the UI won't accept.

Both files use `http://localhost:...` as their tracked placeholder, so one
command fixes both in one pass on the server's copy:

```bash
cd /home/maw/citrineos
sed -i 's#://localhost:#://<new-ip>:#g' apps/operator-ui/.env.local docker-compose.override.yml
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui up -d --build citrine-ui
```

The `up -d` also picks up and recreates `keycloak` automatically since its
config changed. **Never commit the server's `sed`'d copies back** — the
tracked versions must stay on `localhost` placeholders, exactly like this,
or the next fresh clone starts broken.

3. **The three CitrineSim simulators** — each was pointed at
   `ws://<old-ip>:8081`. Reconnect each one from its own UI (`Connection`
   panel → Central System URL → Connect), or via `POST /api/connect` with
   `{"centralSystemUrl": "ws://<new-ip>:8081", "stationId": "..."}`.

## Common issues

**Station won't start a new charging session — CSMS rejects with
`ConcurrentTx`.** Happens after a server restart/redeploy: the DB still has
an old transaction marked active for that card/station. Find and clear it:

```bash
docker exec -i citrineos-ocpp-db-1 psql -U citrine -d citrine <<'SQL'
select id, "transactionId", "stationId", "isActive", "startTime" from "Transactions" where "isActive"=true order by id;
SQL
```

Then, for the stuck ids:

```bash
docker exec -i citrineos-ocpp-db-1 psql -U citrine -d citrine -c 'update "Transactions" set "isActive"=false where id in (<ids>) and "isActive"=true;'
```

**A container got renamed to something like
`73135591136d_citrineos-citrine-1`.** Leftover from a `docker compose up`
that got interrupted partway through a recreate. Harmless but re-run
`docker compose ... up -d` (full, not scoped to one service) — Compose
reconciles it back to the normal name on its own.

**GraphQL returns `no_queries_available`.** Hasura metadata hasn't been
applied. Shouldn't happen on its own since `hasura-metadata-init` does this
automatically on every `up`, but if it does:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.override.yml --profile ui up -d hasura-metadata-init
```

**A newly created Keycloak user can't log in
(`invalid_grant: Account is not fully set up`).** Almost always one of:
- Created in the `master` realm instead of `citrineos` (the console defaults
  to `master` after login — easy to miss the realm dropdown).
- Missing **first name**, **last name**, or **email** — the realm's user
  profile requires all three, even though the login form only asks for
  username/password. Fill them in on the user's Details tab and retry.

## Adding/managing CitrineOS users

Keycloak admin console → realm dropdown → **citrineos** (not `master`) →
**Users**.

- **Add**: Add user → fill username **and first name, last name, email**
  (see the gotcha above) → Create → Credentials tab → Set password →
  Role mapping tab → Assign role → filter by client `citrineos-ui` → pick
  `admin` or `user`.
- **Revoke access**: toggle the user's **Enabled** switch off, or delete
  them outright.
- Full setup notes and what the `admin`/`user` roles actually mean to the
  app: `apps/ocpp-server/keycloak/README.md`.

## Secrets

Nothing above needs a secret value written into git, and none should be —
a credential-leak guard blocks commits containing them, which is correct
behavior, not a bug to work around. The live values (Keycloak bootstrap
admin password, the `citrineos-ui` client secret, `NEXTAUTH_SECRET`, and
individual user passwords) exist only:
- on the running server's copies of `docker-compose.override.yml` and
  `apps/operator-ui/.env.local`, and
- wherever they were last communicated to whoever set them up (e.g. this
  session's chat history).

If the server is rebuilt from a fresh clone, these all need generating
again from scratch — see `apps/ocpp-server/keycloak/README.md` for exactly
which placeholders to replace and where.

## Known limitations (not fixed, worth knowing about)

- The Keycloak `user` role only hides UI elements. Every GraphQL request
  still carries the Hasura admin-secret bypass regardless of who's logged
  in, so a `user` account has full data access if it talks to Hasura
  directly instead of through the UI. Real enforcement needs Hasura
  row/column permissions for the `user` role.
- Keycloak's client `redirectUris`/`webOrigins` are `["*"]` — a deliberate
  tradeoff for the server's IP changing on every redeploy (see above), but
  it's looser than a stable deployment should have.
- Everything runs over plain HTTP — no TLS anywhere.
- Several infra secrets predate this runbook and are weak, plaintext, and
  already committed to git (`CitrineOS!` Hasura secret, `citrine` DB
  password, `minioadmin`/`minioadmin`). Fine for a private test box; would
  need rotating if this ever stops being one.
- No monitoring/alerting — server or container downtime is currently
  discovered by someone trying to use the app, not by anything watching it.
- No CI — the UI image is built by hand on the server on every deploy that
  touches its code, rather than by a pipeline pushing a prebuilt image.
