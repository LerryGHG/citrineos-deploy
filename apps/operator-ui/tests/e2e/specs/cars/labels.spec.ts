// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from '../../fixtures';
import type { ApiClient } from '../../fixtures/api-client';
import { CarsPage } from '../../pages/cars/cars-page';

test.use({ storageState: 'playwright/.auth/admin.json' });

async function labelOf(apiClient: ApiClient, idToken: string) {
  const { CardLabels } = await apiClient.gql<{ CardLabels: { name: string; car: string }[] }>(
    `query CardLabel($idToken: citext!) { CardLabels(where: { idToken: { _eq: $idToken } }) { name car } }`,
    { idToken },
  );
  return CardLabels[0] ?? null;
}

test.describe('cars › driver and car names', () => {
  test('E2E-125: Cars / Drivers lists every RFID card', async ({ page, seededAuthorization }) => {
    const cars = new CarsPage(page);
    await cars.goto();
    await expect(cars.row(seededAuthorization.idToken)).toBeVisible({ timeout: 30_000 });
  });

  test('E2E-126: naming a card saves it and the name survives a reload', async ({
    page,
    apiClient,
    seededAuthorization,
  }) => {
    const { idToken } = seededAuthorization;
    const cars = new CarsPage(page);
    try {
      await cars.goto();
      await cars.driverInput(idToken).fill('E2E Driver');
      await cars.carInput(idToken).fill('E2E Car');
      await cars.saveButton(idToken).click();

      await expect
        .poll(() => labelOf(apiClient, idToken), { timeout: 15_000 })
        .toEqual({ name: 'E2E Driver', car: 'E2E Car' });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await cars.expectLoaded();
      await expect(cars.driverInput(idToken)).toHaveValue('E2E Driver', { timeout: 30_000 });
      await expect(cars.carInput(idToken)).toHaveValue('E2E Car');
    } finally {
      // CardLabels has no foreign key to Authorizations, so the
      // seededAuthorization teardown doesn't remove it.
      await apiClient
        .gql(
          `mutation DeleteCardLabel($idToken: citext!) { delete_CardLabels(where: { idToken: { _eq: $idToken } }) { affected_rows } }`,
          { idToken },
        )
        .catch(() => undefined);
    }
  });
});
