// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { OverviewPage } from '../../pages/overview-page';
import { blockGoogleMaps } from '../../utils/route-overrides';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.setTimeout(90_000);

// The Stations card heading in each language, and the language switcher's
// own label (it is translated too, so switching back needs the localized one).
const LANGUAGES = [
  { label: 'German', name: /^deutsch$/i, stations: /^stationen$/i, switcher: /^sprache$/i },
  {
    label: 'Portuguese',
    name: /portugu[êe]s \(brasil\)/i,
    stations: /^estações$/i,
    switcher: /^idioma$/i,
  },
];

async function pickLanguage(page: Page, switcher: RegExp, language: RegExp) {
  await page.getByRole('button', { name: switcher }).click();
  await page.getByRole('menuitemradio', { name: language }).click();
}

test.describe('overview › locale', () => {
  // Keep any Maps SDK requests out of these navigations.
  test.beforeEach(async ({ page }) => {
    await blockGoogleMaps(page);
  });

  for (const language of LANGUAGES) {
    test(`E2E-018: switching to ${language.label} changes the UI language and persists across reload`, async ({
      page,
    }) => {
      const overview = new OverviewPage(page);
      await overview.goto();
      await expect(overview.stationsHeading).toBeVisible({ timeout: 30_000 });

      await pickLanguage(page, /^language$/i, language.name);
      const localizedHeading = page.getByRole('heading', { name: language.stations });
      await expect(localizedHeading).toBeVisible({ timeout: 30_000 });

      // The selection is stored in the NEXT_LOCALE cookie and survives a reload.
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(localizedHeading).toBeVisible({ timeout: 60_000 });

      await pickLanguage(page, language.switcher, /^english$/i);
      await expect(overview.stationsHeading).toBeVisible({ timeout: 30_000 });
      // No reset needed: each test loads a fresh context from admin.json
      // storageState, so the locale cookie cannot leak into another test.
    });
  }
});
