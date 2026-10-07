// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { type Locator, type Page, expect } from '@playwright/test';

export class OverviewPage {
  static readonly path = '/overview';
  static readonly urlGlob = '**/overview';

  readonly heading: Locator;
  readonly welcomeDialog: Locator;
  readonly welcomeCloseButton: Locator;

  readonly kpiOnlineHeading: Locator;
  readonly kpiChargerActivityHeading: Locator;
  readonly liveMonitorHeading: Locator;
  readonly stationsHeading: Locator;

  readonly expandSidebarButton: Locator;
  readonly collapseSidebarButton: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      name: /charger online status/i,
    });
    this.welcomeDialog = page.getByRole('dialog', {
      name: /welcome to citrineos/i,
    });
    this.welcomeCloseButton = this.welcomeDialog.getByRole('button', {
      name: /close/i,
    });

    // The dashboard is: Charger Online Status, Charger Activity and Live
    // Monitor across the top, and one Stations card (one tile per station,
    // with its live sessions) underneath. The old Active Transactions,
    // Plug-In Success Rate and Locations/map cards are gone.
    this.kpiOnlineHeading = page.getByRole('heading', {
      name: /charger online status/i,
    });
    this.kpiChargerActivityHeading = page.getByRole('heading', {
      name: /charger activity/i,
    });
    this.liveMonitorHeading = page.getByRole('heading', {
      name: /^live monitor$/i,
    });
    this.stationsHeading = page.getByRole('heading', {
      name: /^stations$/i,
    });

    this.expandSidebarButton = page.getByRole('button', {
      name: /expand sidebar/i,
    });
    this.collapseSidebarButton = page.getByRole('button', {
      name: /collapse sidebar/i,
    });
    this.logoutButton = page.getByRole('button', { name: /^logout$/i });
  }

  async goto(): Promise<void> {
    await this.page.goto(OverviewPage.path, {
      waitUntil: 'domcontentloaded',
    });
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    // Anchor on the Stations card heading. Every card shows a skeleton until
    // its Hasura query returns, so there is no query-free heading to wait on
    // any more; Stations is the main content and the one most tests look at.
    // A one-shot reload retry catches the rare stalled response. The first
    // attempt is capped at 45s so the retry still fits the 150s test budget.
    try {
      await this.settleOverview(45_000);
    } catch {
      await this.page.reload({
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await this.settleOverview(60_000);
    }
  }

  private async settleOverview(timeout: number): Promise<void> {
    await Promise.race([
      this.stationsHeading.waitFor({ state: 'visible', timeout }),
      this.welcomeDialog.waitFor({ state: 'visible', timeout }),
    ]);
    await this.dismissWelcomeIfPresent();
    await expect(this.stationsHeading).toBeVisible({ timeout });
  }

  async dismissWelcomeIfPresent(waitMs = 0): Promise<void> {
    // The dialog mounts from a client effect, so it can appear shortly AFTER
    // the card heading does. Callers that know the first-login flag is absent
    // (admin.setup) pass a wait window to catch the late mount; everyone else
    // keeps the cheap one-shot check — with the flag captured in admin.json
    // the dialog never appears in ordinary tests.
    const visible =
      waitMs > 0
        ? await this.welcomeDialog
            .waitFor({ state: 'visible', timeout: waitMs })
            .then(() => true)
            .catch(() => false)
        : await this.welcomeDialog.isVisible().catch(() => false);
    if (visible) {
      await this.welcomeCloseButton.click();
      await expect(this.welcomeDialog).toBeHidden({ timeout: 15_000 });
    }
  }

  /** The tile for one station inside the Stations card. */
  stationTile(ocppConnectionName: string): Locator {
    // Each tile is a clickable bordered box (it links to the station page).
    return this.page
      .locator('div.cursor-pointer.rounded-lg.border')
      .filter({ has: this.page.getByText(ocppConnectionName, { exact: true }) });
  }

  async expandSidebar(): Promise<void> {
    if (await this.expandSidebarButton.isVisible().catch(() => false)) {
      await this.expandSidebarButton.click();
      await expect(this.collapseSidebarButton).toBeVisible();
    }
  }

  async signOut(): Promise<void> {
    await this.expandSidebar();
    await this.logoutButton.click();
  }
}
