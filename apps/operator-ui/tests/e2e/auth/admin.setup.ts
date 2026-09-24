// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { test as setup, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { LoginPage } from '../pages/login-page';
import { OverviewPage } from '../pages/overview-page';
import { readEnv } from '../utils/env';

const ADMIN_STORAGE_STATE = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'playwright',
  '.auth',
  'admin.json',
);

setup.use({ storageState: { cookies: [], origins: [] } });

setup('authenticate as admin and persist storage state', async ({ page }) => {
  const login = new LoginPage(page);
  const overview = new OverviewPage(page);

  // Under Keycloak, E2E_ADMIN_EMAIL is whatever the realm's admin user logs
  // in with — Keycloak's hosted form takes a username or an email
  // (loginWithEmailAllowed), so either value works.
  await login.goto();
  await login.login(readEnv('E2E_ADMIN_EMAIL'), readEnv('E2E_ADMIN_PASSWORD'));

  await page.waitForURL(OverviewPage.urlGlob, {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await overview.expectLoaded();

  const cookies = await page.context().cookies();
  expect(
    cookies.some((c) => /next-auth/.test(c.name)),
    'NextAuth session cookie should be set after login',
  ).toBe(true);

  // The first-login effect writes `firstLoginHelp:<identity id>` when it
  // shows the welcome modal. Under the generic auth provider the identity id
  // is always '1' (see genericAdminUser); under Keycloak it's the token's
  // real `sub` claim, a UUID minted per-realm-user that we can't know ahead
  // of time — so read it back from NextAuth's own session endpoint instead
  // of assuming a fixed value.
  const session = await page.request.get('/api/auth/session').then((r) => r.json());
  const identityId: string = session?.user?.sub ?? '1';
  const firstLoginKey = `firstLoginHelp:${identityId}`;

  // Both the flag and the dismissal must be in the captured state: a
  // snapshot taken before the effect fires would put the modal overlay in
  // front of every test that loads it. expectLoaded() may have won its race
  // against the dialog, so give the late mount a real window.
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, firstLoginKey, {
    timeout: 30_000,
  });
  await overview.dismissWelcomeIfPresent(10_000);

  // Pin the locale so every English-text locator stays valid even if the
  // app ever grows an Accept-Language fallback.
  await page.context().addCookies([
    {
      name: 'NEXT_LOCALE',
      value: 'en',
      url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    },
  ]);

  const state = await page.context().storageState({ path: ADMIN_STORAGE_STATE });
  // Exact match, not a substring: under Keycloak the captured state has a
  // second "localhost" origin (Keycloak's own hosted login page, e.g.
  // localhost:8180), and `.includes('localhost')` could non-deterministically
  // grab that one instead of the app's — it has no firstLoginHelp key at all.
  const baseOrigin = new URL(readEnv('E2E_BASE_URL')).origin;
  const origin = state.origins.find((o) => o.origin === baseOrigin);
  expect(
    origin?.localStorage.some((entry) => entry.name === firstLoginKey),
    'captured storage state must contain the dismissed-welcome flag',
  ).toBe(true);
  expect(
    state.cookies.some((c) => c.name === 'NEXT_LOCALE' && c.value === 'en'),
    'captured storage state must pin the locale to en',
  ).toBe(true);
});
