// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from '../../fixtures';
import { deleteTransaction } from '../../fixtures/seeded-data';
import { CostCalculatorPage } from '../../pages/cost-calculator/cost-calculator-page';
import { shortId } from '../../utils/random';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('cost calculator', () => {
  test("E2E-116: a card's energy and cost appear at the set price", async ({
    page,
    apiClient,
    seededAuthorization,
    seededStation,
  }) => {
    // A finished 12.5 kWh session charged to the seeded RFID card.
    // seedTransaction has no authorization option, so insert it directly.
    const transactionId = `${shortId()}-tx`;
    const now = new Date().toISOString();
    await apiClient.gql(
      `mutation SeedChargedSession($obj: Transactions_insert_input!) {
         insert_Transactions_one(object: $obj) { id }
       }`,
      {
        obj: {
          transactionId,
          ocppConnectionName: seededStation.ocppConnectionName,
          authorizationId: seededAuthorization.id,
          isActive: false,
          totalKwh: 12.5,
          startTime: now,
          endTime: now,
          createdAt: now,
          updatedAt: now,
        },
      },
    );

    try {
      const calculator = new CostCalculatorPage(page);
      await calculator.goto();
      await calculator.priceInput.fill('0.40');

      // Unlabelled cards are titled with their raw tag.
      const row = calculator.cardRow(seededAuthorization.idToken);
      await expect(row).toBeVisible({ timeout: 30_000 });
      await expect(row).toContainText('12.50 kWh');
      // 12.5 kWh x 0.40 = 5.00, formatted in the browser's locale.
      await expect(row).toContainText(/5[.,]00/);
    } finally {
      await deleteTransaction(apiClient, transactionId).catch(() => undefined);
    }
  });

  test('E2E-117: the price per kWh is remembered across reloads', async ({ page }) => {
    const calculator = new CostCalculatorPage(page);
    await calculator.goto();
    await calculator.priceInput.fill('0.37');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await calculator.expectLoaded();
    await expect(calculator.priceInput).toHaveValue('0.37');
  });
});
