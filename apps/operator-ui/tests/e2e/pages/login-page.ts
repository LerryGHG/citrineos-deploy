// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { type Locator, type Page, expect } from '@playwright/test';
import { isKeycloakProvider } from '../utils/env';

export class LoginPage {
  static readonly path = '/login';

  // Generic provider: an inline form rendered on the app's own /login page.
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  // Keycloak provider: /login redirects (a client effect, no form of its
  // own) to the realm's hosted login page — a different origin entirely.
  // These field ids (#username, #password, #kc-login, #input-error) are
  // Keycloak's default theme's own stable, documented ids, not anything
  // this app controls.
  readonly keycloakUsernameInput: Locator;
  readonly keycloakPasswordInput: Locator;
  readonly keycloakSubmitButton: Locator;
  readonly keycloakErrorMessage: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByRole('textbox', { name: /email/i });
    this.passwordInput = page.getByRole('textbox', { name: /password/i });
    this.submitButton = page.getByRole('button', { name: /sign in/i });
    this.errorAlert = page.getByRole('alert');

    this.keycloakUsernameInput = page.locator('#username');
    this.keycloakPasswordInput = page.locator('#password');
    this.keycloakSubmitButton = page.locator('#kc-login');
    this.keycloakErrorMessage = page.locator('#input-error, .kc-feedback-text, #form-error-message');
  }

  async goto(): Promise<void> {
    await this.page.goto(LoginPage.path, {
      waitUntil: 'domcontentloaded',
    });

    if (isKeycloakProvider()) {
      // Wait for the redirect to actually land on the realm's authorization
      // endpoint before touching the form — the app's own /login never
      // renders one under this provider.
      await this.page.waitForURL(/\/protocol\/openid-connect\/auth/, {
        timeout: 30_000,
      });
      await expect(this.keycloakSubmitButton).toBeVisible({ timeout: 30_000 });
      return;
    }

    // The first visit to /login on a dev server pays the cold-compile cost
    // (20–40s). Production builds are pre-compiled, so this budget is unused
    // on `next start`. Keep it for the dev-mode path that most contributors
    // run locally.
    await expect(this.submitButton).toBeVisible({ timeout: 60_000 });
  }

  async login(usernameOrEmail: string, password: string): Promise<void> {
    if (isKeycloakProvider()) {
      await this.keycloakUsernameInput.fill(usernameOrEmail);
      await this.keycloakPasswordInput.fill(password);
      await this.keycloakSubmitButton.click();
      return;
    }

    await this.emailInput.fill(usernameOrEmail);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
