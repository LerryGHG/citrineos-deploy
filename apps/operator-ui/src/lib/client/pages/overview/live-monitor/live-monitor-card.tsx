// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React from 'react';
import { CanAccess, useTranslate } from '@refinedev/core';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader } from '@lib/client/components/ui/card';
import { AccessDeniedFallbackCard } from '@lib/client/components/access-denied-fallback-card';
import { OverviewCardSkeleton } from '@lib/client/pages/overview/overview-card-skeleton';
import { useLiveCurrent } from '@lib/client/hooks/use-live-current';
import { ActionType, ResourceType } from '@lib/utils/access-types';
import { heading2Style } from '@lib/client/styles/page';

const NOMINAL_VOLTS = 230;

const formatClock = (t: number, withSeconds = false) =>
  new Date(t).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });

export const LiveMonitorCard: React.FC = () => {
  const translate = useTranslate();
  const { chartData, stations, latest, colorFor, isLoading, error } = useLiveCurrent();

  if (isLoading) return <OverviewCardSkeleton />;

  // With only a couple of minutes of data, HH:MM labels would all read the same.
  const spanMs =
    chartData.length > 1 ? chartData[chartData.length - 1].t - chartData[0].t : 0;
  const withSeconds = spanMs < 5 * 60 * 1000;

  const totalAmps = Array.from(latest.values()).reduce((sum, v) => sum + v.amps, 0);
  const approxKw = (totalAmps * NOMINAL_VOLTS) / 1000;

  return (
    <CanAccess
      resource={ResourceType.TRANSACTIONS}
      action={ActionType.LIST}
      fallback={<AccessDeniedFallbackCard />}
    >
      <Card>
        <CardHeader>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className={heading2Style}>{translate('Overview.liveMonitor')}</h2>
            {stations.length > 0 && (
              <div className="text-right">
                <div className="text-lg font-semibold">{totalAmps.toFixed(1)} A</div>
                <div className="text-xs text-muted-foreground">≈ {approxKw.toFixed(2)} kW</div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p>{translate('Overview.errorLoadingData')}</p>
          ) : stations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {translate('Overview.noActiveSessions')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(t) => formatClock(Number(t), withSeconds)}
                      tickCount={3}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                    <Tooltip
                      labelFormatter={(t) => formatClock(Number(t), true)}
                      formatter={(value) => `${Number(value).toFixed(1)} A`}
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: 'var(--popover)',
                        color: 'var(--card-foreground)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                      }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                    />
                    {stations.map((station) => (
                      <Line
                        key={station}
                        type="monotone"
                        dataKey={station}
                        stroke={colorFor(station)}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {stations.map((station) => (
                  <span key={station} className="flex items-center gap-1">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: colorFor(station) }}
                    />
                    {station}: {latest.get(station)?.amps.toFixed(1)} A
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </CanAccess>
  );
};
