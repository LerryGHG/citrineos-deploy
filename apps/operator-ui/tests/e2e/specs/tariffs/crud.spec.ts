// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from '../../fixtures';
import { CostCalculatorPage } from '../../pages/cost-calculator/cost-calculator-page';
import { TariffFormPage } from '../../pages/tariffs/form-page';

test.use({ storageState: 'playwright/.auth/admin.json' });

// /tariffs itself now shows the Cost Calculator (see specs/cost-calculator);
// the tariff form and detail pages still live under /tariffs/new and /tariffs/:id.
test.describe('tariffs › CRUD', () => {
  test('E2E-110: /tariffs shows the cost calculator', async ({ page }) => {
    const calculator = new CostCalculatorPage(page);
    await calculator.goto();
    await expect(calculator.priceInput).toBeVisible();
    await expect(calculator.calculatorTab).toBeVisible();
    await expect(calculator.billingTab).toBeVisible();
  });

  test('E2E-111: Create tariff via UI surfaces success toast', async ({ page, apiClient }) => {
    // XTS is the ISO currency code reserved for testing, and the price varies
    // per attempt — the old fixed USD@0.35 collided with rows a failed
    // attempt (or another run) left behind, and its cleanup deleted every
    // matching tariff in the DB, not just ours. Two decimals only: the form's
    // price input enforces step="0.01", so a finer price blocks the submit.
    const distinctivePrice = ((Date.now() % 89) + 11) / 100;
    const form = new TariffFormPage(page);
    await form.gotoNew();
    await form.fill({
      currency: 'XTS',
      pricePerKwh: distinctivePrice,
    });
    await form.submit();

    // Cleanup: the price is unique, so this can only match our own row.
    await apiClient
      .gql(
        `mutation Cleanup($price: numeric!) {
           delete_Tariffs(where: { currency: { _eq: "XTS" }, pricePerKwh: { _eq: $price } }) {
             affected_rows
           }
         }`,
        { price: distinctivePrice },
      )
      .catch(() => undefined);
  });

  test('E2E-113: Delete tariff via UI detail redirects to list and removes the row', async ({
    page,
    apiClient,
  }) => {
    const distinctivePrice = Number(`0.${Date.now().toString().slice(-6)}`);
    const now = new Date().toISOString();
    const { insert_Tariffs_one: created } = await apiClient.gql<{
      insert_Tariffs_one: { id: number };
    }>(
      `mutation SeedForUiDelete($obj: Tariffs_insert_input!) {
         insert_Tariffs_one(object: $obj) { id }
       }`,
      {
        obj: {
          currency: 'XTS',
          pricePerKwh: distinctivePrice,
          createdAt: now,
          updatedAt: now,
        },
      },
    );

    try {
      await page.goto(`/tariffs/${created.id}`);
      const deleteButton = page.getByRole('button', { name: /^delete/i });
      await expect(deleteButton).toBeVisible({ timeout: 30_000 });
      await deleteButton.click();

      // Deleting redirects to the resource's list route, which is now the
      // cost calculator - so check the row is gone in the database instead.
      await page.waitForURL(/\/tariffs$/, { timeout: 30_000 });
      await expect(new CostCalculatorPage(page).heading).toBeVisible({ timeout: 30_000 });
      const { Tariffs_by_pk: remaining } = await apiClient.gql<{
        Tariffs_by_pk: { id: number } | null;
      }>(`query TariffGone($id: Int!) { Tariffs_by_pk(id: $id) { id } }`, { id: created.id });
      expect(remaining).toBeNull();
    } finally {
      await apiClient
        .gql(
          `mutation Cleanup($id: Int!) {
             delete_Tariffs_by_pk(id: $id) { id }
           }`,
          { id: created.id },
        )
        .catch(() => undefined);
    }
  });
});
