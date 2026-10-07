# Keycloak realm import

`citrineos-realm.json` is imported by the `keycloak` service
(`docker-compose.override.yml`, started with `--import-realm`) when the
`citrineos` realm doesn't exist yet - i.e. on a brand-new Keycloak database.
Afterwards the import is skipped (`IGNORE_EXISTING`), so editing this file
does **not** change an existing realm: change things in the Keycloak console
(`https://<server-ip>/auth/admin`) instead.

It seeds:
- Realm `citrineos` with a password policy (min. 8 characters, not the
  username or email) and brute-force protection (5 failed attempts lock the
  account with escalating waits, capped at 15 minutes).
- Client `citrineos-ui` (confidential; redirect URIs `*` because the server's
  IP isn't stable) with a protocol mapper that puts the user's client roles
  into a top-level `roles` claim of the access token. Hasura and the CSMS API
  both read the role from there (see RUNBOOK.md, "Accounts and what they can
  do"); the operator UI reads `resource_access.citrineos-ui.roles`.
- Two client roles, `admin` (full access) and `user` (view only). `admin`
  includes realm-management's `view-users`, `manage-users` and `view-realm`,
  so the operator UI's Users page can call Keycloak's admin API with the
  signed-in admin's own token. The `roles` mapper only copies `citrineos-ui`
  roles, so these don't reach Hasura or the CSMS.
- Two users, `admin` and `user`, one per role.

The client secret and both passwords are `${...}` placeholders. Keycloak
fills them in from its own environment at import time, and
docker-compose.override.yml passes them from the server's `.env`
(`KEYCLOAK_CLIENT_SECRET`, `CITRINEOS_ADMIN_PASSWORD`,
`CITRINEOS_USER_PASSWORD`, created by `scripts/init-env.sh`). So no secret is
ever written into this file.
