// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The Delete button on detail pages (ConfirmDeleteButton): the first click
 * only opens an alert dialog naming what will be deleted; its own red Delete
 * button does it, Cancel keeps everything.
 */
export class ConfirmDelete {
  readonly openButton: Locator;
  readonly dialog: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(private readonly page: Page) {
    this.openButton = page.getByRole('button', { name: /^delete$/i });
    this.dialog = page.getByRole('alertdialog');
    this.confirmButton = this.dialog.getByRole('button', { name: /^delete$/i });
    this.cancelButton = this.dialog.getByRole('button', { name: /^cancel$/i });
  }

  /** Clicks Delete and checks the dialog names the record (`title`). */
  async open(title: RegExp): Promise<void> {
    await expect(this.openButton).toBeEnabled({ timeout: 30_000 });
    await this.openButton.click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole('heading', { name: title })).toBeVisible();
  }

  async confirm(title: RegExp): Promise<void> {
    await this.open(title);
    await this.confirmButton.click();
  }
}
