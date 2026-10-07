// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from '../../fixtures';
import { UsersPage } from '../../pages/users/users-page';

test.use({ storageState: 'playwright/.auth/admin.json' });

// The realm file's policy: length(8) and notUsername and notEmail. Nothing
// here saves a password - every dialog is cancelled - so the seeded accounts
// keep theirs.
test.describe('users › change password', () => {
  test('E2E-130: Users lists the seeded admin and user accounts', async ({ page }) => {
    const users = new UsersPage(page);
    await users.goto();
    await expect(users.row('admin')).toBeVisible({ timeout: 30_000 });
    await expect(users.row('user')).toBeVisible();
  });

  test("E2E-131: a password that breaks the policy is flagged and can't be saved", async ({
    page,
  }) => {
    const users = new UsersPage(page);
    await users.goto();
    await users.openChangePassword('user');

    await users.newPassword.fill('short');
    await users.repeatPassword.fill('short');
    await expect(users.rule(/at least 8 characters/i)).toHaveAttribute('data-met', 'false');
    await expect(users.notCompliantWarning).toBeVisible();
    await expect(users.saveButton).toBeDisabled();

    // Compliant, but the repeat doesn't match.
    await users.newPassword.fill('long-enough-1');
    await expect(users.rule(/at least 8 characters/i)).toHaveAttribute('data-met', 'true');
    await expect(users.notCompliantWarning).toBeHidden();
    await expect(users.mismatchMessage).toBeVisible();
    await expect(users.saveButton).toBeDisabled();

    await users.repeatPassword.fill('long-enough-1');
    await expect(users.mismatchMessage).toBeHidden();
    await expect(users.saveButton).toBeEnabled();

    await users.cancelButton.click();
    await expect(users.dialog).toBeHidden();
  });
});
