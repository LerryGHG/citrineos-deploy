# Keycloak realm import

`citrineos-realm.json` is imported automatically by the `keycloak` service
(`docker-compose.override.yml`) on every `up` — see that service's comments
for how `KC_HOSTNAME` keeps the issued tokens consistent across a changing
server IP.

It seeds:
- Realm `citrineos`, client `citrineos-ui` (confidential, redirect URIs `*`
  since the deploy server's IP isn't stable — see docker-compose.override.yml).
- Two client roles on that client: `admin` and `user`. The operator UI reads
  these out of the access token's `resource_access.citrineos-ui.roles` to
  decide which role a logged-in user gets (see
  `apps/operator-ui/src/lib/providers/auth-provider/keycloak-auth-provider`).
- Two users, `admin` and `user`, one per role.
- A password policy (min. 8 characters, can't match the username or email)
  and brute-force protection (5 failed attempts locks the account out with
  escalating wait times, capped at 15 minutes).

**The `REPLACE_WITH_GENERATED_*` values in the committed file are placeholders,
not working credentials** — real secrets are never committed here (a git
credential-leakage guard blocks it, and it'd be a bad idea regardless).
Before a fresh deploy, generate real values (e.g. `openssl rand -base64 24`
or PowerShell's `-join ((48..57)+(65..90)+(97..122)|Get-Random -Count 24|%{[char]$_})`)
and substitute them into the server's own copy of this file plus the matching
`KC_BOOTSTRAP_ADMIN_PASSWORD` in `docker-compose.override.yml` and
`KEYCLOAK_CLIENT_SECRET` in `apps/operator-ui/.env.local` (the client secret
must be identical in both places) — the same one-off substitution step
already used for the server's IP in those files. Both placeholder user
passwords are marked `"temporary": true`, so Keycloak will force a password
reset on first login if they're ever imported as-is.

Realm import uses Keycloak's `IGNORE_EXISTING` strategy, so re-running `up`
against a server that already has the `citrineos` realm is a no-op — editing
this file and redeploying does **not** update an already-imported realm.
Change users/roles/clients through the Keycloak admin console
(`http://<server>:8180`, `kcadmin` / the bootstrap password) instead.
