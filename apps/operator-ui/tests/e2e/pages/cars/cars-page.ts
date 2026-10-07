// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Cars / Drivers, which replaced the Partners list at /partners: one row per
 * RFID card with an editable driver and car name. (The partner form pages
 * still live under /partners/new and /partners/:id.)
 */
export class CarsPage {
  static readonly path = '/partners';

  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /^cars \/ drivers$/i });
  }

  async goto(): Promise<void> {
    await this.page.goto(CarsPage.path, { waitUntil: 'domcontentloaded' });
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  row(idToken: string): Locator {
    return this.page
      .getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name: idToken, exact: true }) });
  }

  driverInput(idToken: string): Locator {
    return this.row(idToken).getByPlaceholder(/anna/i);
  }

  carInput(idToken: string): Locator {
    return this.row(idToken).getByPlaceholder(/tesla model 3/i);
  }

  saveButton(idToken: string): Locator {
    return this.row(idToken).getByRole('button', { name: /^save$/i });
  }
}
