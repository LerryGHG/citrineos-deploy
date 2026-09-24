// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from '../../fixtures';
import { OverviewPage } from '../../pages/overview-page';
import { LoginPage } from '../../pages/login-page';
import { isKeycloakProvider } from '../../utils/env';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('auth › logout', () => {
  test('E2E-004: authenticated admin signs out and lands back on the login flow', async ({
    page,
  }) => {
    const overview = new OverviewPage(page);
    const login = new LoginPage(page);

    await overview.goto();
    await overview.signOut();

    if (isKeycloakProvider()) {
      // /login has no form of its own under Keycloak — it immediately
      // re-triggers signIn('keycloak'). With the SSO cookie actually
      // cleared (the point of hitting end_session below), that lands back
      // on Keycloak's own login form rather than silently re-authenticating
      // — the Keycloak-flow equivalent of "signed out".
      await page.waitForURL(/\/protocol\/openid-connect\/auth/, { timeout: 30_000 });
      await expect(login.keycloakSubmitButton).toBeVisible();
      return;
    }

    await page.waitForURL(/\/login(\?.*)?$/, { timeout: 30_000 });
    await expect(login.submitButton).toBeVisible();
  });

  test('E2E-005: when Keycloak is the auth provider, sign-out hits the realm logout endpoint', async ({
    page,
  }) => {
    // Keycloak is a first-class auth provider (AuthProviderTypeEnum = 'keycloak' | 'generic').
    // When NEXT_PUBLIC_AUTH_PROVIDER=keycloak, the server stamps a realm end-session URL onto
    // the session (`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`) and
    // the logout handler hard-navigates the browser to it — exactly the redirect asserted below.
    // E2E-004 already covers the same end state; this test additionally proves the redirect
    // chain actually went through Keycloak's real end-session endpoint, not just that we ended
    // up somewhere that looks like a login page.
    //
    // This stays a conditional skip rather than an always-on test because it needs external infra
    // that CI does not provision: a running Keycloak server + realm + client/secret, plus an
    // `admin.json` storage state captured against a real Keycloak login. CI runs the generic
    // credentials provider, so E2E_AUTH_PROVIDER is unset and this test is gated off. Set
    // E2E_AUTH_PROVIDER=keycloak (and the matching E2E_ADMIN_EMAIL/PASSWORD) against a
    // Keycloak-backed deployment to exercise the realm logout flow.
    test.skip(!isKeycloakProvider(), 'Keycloak realm not provisioned; generic auth in use.');

    const overview = new OverviewPage(page);
    const login = new LoginPage(page);

    const redirects: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) redirects.push(frame.url());
    });

    await overview.goto();
    await overview.signOut();

    await page.waitForURL(/\/protocol\/openid-connect\/auth/, { timeout: 30_000 });
    await expect(login.keycloakSubmitButton).toBeVisible();
    expect(
      redirects.some((u) => /protocol\/openid-connect\/logout/.test(u)),
      'redirect chain should include Keycloak end_session endpoint',
    ).toBe(true);
  });
});
