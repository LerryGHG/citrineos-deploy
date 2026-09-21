// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import { ChargerActivityCard } from '@lib/client/pages/overview/charger-activity/charger-activity-card';
import { StationsGridCard } from '@lib/client/pages/overview/stations-grid/stations-grid-card';
import { OnlineStatusCard } from '@lib/client/pages/overview/online-status/online-status-card';
import { LiveMonitorCard } from '@lib/client/pages/overview/live-monitor/live-monitor-card';

export const Overview = () => {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OnlineStatusCard />
        <ChargerActivityCard />
        <LiveMonitorCard />
      </div>
      <StationsGridCard />
    </div>
  );
};
