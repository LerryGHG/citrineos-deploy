// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from '../../fixtures';
import { OverviewPage } from '../../pages/overview-page';
import { blockGoogleMaps } from '../../utils/route-overrides';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('overview › dashboard', () => {
  // CI has no Maps key; keep any Maps SDK requests out of these assertions.
  test.beforeEach(async ({ page }) => {
    await blockGoogleMaps(page);
  });

  test('E2E-010: dashboard cards render their headings on /overview', async ({
    page,
    seededLocation,
    seededStation,
    seededTransaction,
  }) => {
    void seededLocation;
    void seededStation;
    void seededTransaction;

    const overview = new OverviewPage(page);
    await overview.goto();

    // The headings sit inside query-bound skeletons; under CI load the
    // Hasura round trips can far outlive the default expect timeout.
    await expect(overview.kpiOnlineHeading).toBeVisible({ timeout: 60_000 });
    await expect(overview.kpiChargerActivityHeading).toBeVisible({ timeout: 60_000 });
    await expect(overview.liveMonitorHeading).toBeVisible({ timeout: 60_000 });
    await expect(overview.stationsHeading).toBeVisible({ timeout: 60_000 });
  });

  test('E2E-012: Stations card shows a station with an active session', async ({
    page,
    seededLocation,
    seededStation,
    seededTransaction,
  }) => {
    void seededLocation;
    void seededTransaction;

    const overview = new OverviewPage(page);
    await overview.goto();

    // The card lists every station (one tile each) and refreshes every 5s,
    // so the seeded station appears without any search.
    await expect(overview.stationTile(seededStation.ocppConnectionName)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('E2E-014: dashboard headings render even with no fixture-seeded data', async ({ page }) => {
    const overview = new OverviewPage(page);
    await overview.goto();

    await expect(overview.kpiOnlineHeading).toBeVisible({ timeout: 60_000 });
    await expect(overview.kpiChargerActivityHeading).toBeVisible({ timeout: 60_000 });
    await expect(overview.liveMonitorHeading).toBeVisible({ timeout: 60_000 });
    await expect(overview.stationsHeading).toBeVisible({ timeout: 60_000 });
  });
});
