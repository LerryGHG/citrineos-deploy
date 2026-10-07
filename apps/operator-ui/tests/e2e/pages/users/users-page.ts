// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Users (admin only): the Keycloak accounts, each with a Change password
 * dialog that checks the realm's password policy while typing.
 */
export class UsersPage {
  static readonly path = '/users';

  readonly heading: Locator;
  readonly dialog: Locator;
  readonly newPassword: Locator;
  readonly repeatPassword: Locator;
  readonly notCompliantWarning: Locator;
  readonly mismatchMessage: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /^users$/i });
    this.dialog = page.getByRole('dialog');
    this.newPassword = this.dialog.getByLabel(/^new password$/i);
    this.repeatPassword = this.dialog.getByLabel(/^repeat new password$/i);
    this.notCompliantWarning = this.dialog
      .getByRole('alert')
      .filter({ hasText: /doesn't meet the rules/i });
    this.mismatchMessage = this.dialog.getByText(/passwords don't match/i);
    this.saveButton = this.dialog.getByRole('button', { name: /^save password$/i });
    this.cancelButton = this.dialog.getByRole('button', { name: /^cancel$/i });
  }

  async goto(): Promise<void> {
    await this.page.goto(UsersPage.path, { waitUntil: 'domcontentloaded' });
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  row(username: string): Locator {
    return this.page
      .getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name: username, exact: true }) });
  }

  async openChangePassword(username: string): Promise<void> {
    await this.row(username)
      .getByRole('button', { name: /^change password$/i })
      .click();
    await expect(this.dialog).toBeVisible();
  }

  /** One line of the dialog's rule checklist; `data-met` is "true"/"false" once typing starts. */
  rule(text: RegExp): Locator {
    return this.dialog
      .getByRole('list', { name: /password rules/i })
      .getByRole('listitem')
      .filter({ hasText: text });
  }
}
