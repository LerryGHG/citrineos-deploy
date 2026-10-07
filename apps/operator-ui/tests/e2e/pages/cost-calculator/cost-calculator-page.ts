// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The Cost Calculator, which replaced the Tariffs list at /tariffs. (The
 * tariff form and detail pages still live under /tariffs/new and /tariffs/:id.)
 */
export class CostCalculatorPage {
  static readonly path = '/tariffs';

  readonly heading: Locator;
  readonly priceInput: Locator;
  readonly calculatorTab: Locator;
  readonly billingTab: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /^charging cost calculator$/i });
    this.priceInput = page.locator('#price-per-kwh');
    this.calculatorTab = page.getByRole('tab', { name: /^calculator$/i });
    this.billingTab = page.getByRole('tab', { name: /^billing \/ reports$/i });
  }

  async goto(): Promise<void> {
    await this.page.goto(CostCalculatorPage.path, { waitUntil: 'domcontentloaded' });
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** The summary row of one RFID card (its title is the raw tag when unlabelled). */
  cardRow(title: string): Locator {
    return this.page
      .getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name: title, exact: true }) });
  }
}
