// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { OCPP2_0_1 } from '@citrineos/types';
import { findOverallValue, normalizeValue } from '@lib/cls/meter-value-dto';
import { GET_CHARGING_STATIONS_OVERVIEW_GRID } from '@lib/queries/charging-stations';
import { MenuSection } from '@lib/client/components/main-menu/main-menu';
import { ActionType, ResourceType } from '@lib/utils/access-types';
import { useGqlCustom } from '@lib/utils/use-gql-custom';
import { CanAccess, useTranslate } from '@refinedev/core';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@lib/client/components/ui/card';
import { Badge } from '@lib/client/components/ui/badge';
import { ChevronRightIcon, ClockIcon, ZapIcon } from 'lucide-react';
import { heading2Style } from '@lib/client/styles/page';
import { overviewClickableStyle } from '@lib/client/styles/card';
import { OverviewCardSkeleton } from '@lib/client/pages/overview/overview-card-skeleton';
import { AccessDeniedFallbackCard } from '@lib/client/components/access-denied-fallback-card';
import {
  connectorStatusToChargerStatus,
  getStatusColor,
} from '@lib/client/pages/overview/charger-activity/charger-activity-card';
import { useCardLabels } from '@lib/client/hooks/use-card-labels';

const REFRESH_MS = 5000;

// Loose shapes matching exactly what GET_CHARGING_STATIONS_OVERVIEW_GRID returns —
// deliberately not run through the ChargingStationClass/plainToInstance pipeline, since
// that class's @Expose names assume the unaliased field names this query doesn't use.
interface GridMeterValue {
  sampledValue: unknown;
  timestamp: string;
}
interface GridTransaction {
  id: number;
  transactionId: string;
  isActive: boolean;
  totalKwh?: number | null;
  startTime?: string | null;
  authorization?: { idToken: string } | null;
  latestMeterValue?: GridMeterValue[];
}
interface GridStation {
  id: number;
  ocppConnectionName: string;
  isOnline: boolean;
  latestStatusNotifications?: Array<{
    statusNotification?: { connectorStatus?: string } | null;
  }>;
  transactions?: GridTransaction[];
}

const getLatestConnectorStatus = (station: GridStation): string | undefined =>
  station.latestStatusNotifications?.[0]?.statusNotification?.connectorStatus ?? undefined;

const getCurrentAmps = (transaction: GridTransaction): number | null => {
  const meterValue = transaction.latestMeterValue?.[0];
  if (!meterValue?.sampledValue) return null;
  const overall = findOverallValue(
    meterValue.sampledValue as any,
    OCPP2_0_1.MeasurandEnumType.Current_Import,
  );
  if (!overall) return null;
  const normalized = normalizeValue(overall);
  return normalized !== null ? Number(normalized) : null;
};

const formatElapsed = (startTime: string | null | undefined, now: number): string | null => {
  if (!startTime) return null;
  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) return null;
  const totalMinutes = Math.max(0, Math.floor((now - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

// Charging first, then other online stations, then offline; alphabetical within each group.
const sortRank = (station: GridStation): number => {
  if (station.isOnline && (station.transactions?.length ?? 0) > 0) return 0;
  return station.isOnline ? 1 : 2;
};

export const StationsGridCard: React.FC = () => {
  const { push } = useRouter();
  const translate = useTranslate();
  const { describe } = useCardLabels();

  // Re-render every 30 s so the running time keeps counting between data refreshes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const {
    query: { data, isLoading, error },
  } = useGqlCustom({
    gqlQuery: GET_CHARGING_STATIONS_OVERVIEW_GRID,
    queryOptions: { refetchInterval: REFRESH_MS },
  });

  const stations: GridStation[] = useMemo(() => {
    const rows: GridStation[] = (data?.data as any)?.ChargingStations || [];
    return [...rows].sort(
      (a, b) =>
        sortRank(a) - sortRank(b) || a.ocppConnectionName.localeCompare(b.ocppConnectionName),
    );
  }, [data]);

  if (isLoading) return <OverviewCardSkeleton />;

  const activeSessions = stations.reduce(
    (sum, s) => sum + (s.isOnline ? (s.transactions?.length ?? 0) : 0),
    0,
  );

  return (
    <CanAccess
      resource={ResourceType.CHARGING_STATIONS}
      action={ActionType.LIST}
      fallback={<AccessDeniedFallbackCard />}
    >
      <Card className="flex max-h-150 flex-col">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className={heading2Style}>{translate('Overview.stations')}</h2>
              {activeSessions > 0 && (
                <Badge variant="success">
                  {translate('Overview.activeSessionsCount', { count: activeSessions })}
                </Badge>
              )}
            </div>
            <div
              className={overviewClickableStyle}
              onClick={() => push(`/${MenuSection.CHARGING_STATIONS}`)}
            >
              {translate('Overview.viewAllChargers')} <ChevronRightIcon />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {error ? (
            <p>{translate('Overview.errorLoadingData')}</p>
          ) : stations.length === 0 ? (
            <span>{translate('Overview.noStations')}</span>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {stations.map((station) => {
                const connectorStatus = getLatestConnectorStatus(station);
                const chargerStatus =
                  station.isOnline && connectorStatus
                    ? connectorStatusToChargerStatus(connectorStatus)
                    : undefined;
                const sessions = station.isOnline ? (station.transactions ?? []) : [];

                return (
                  <div
                    key={station.id}
                    className="flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors hover:border-primary"
                    onClick={() => push(`/${MenuSection.CHARGING_STATIONS}/${station.id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {sessions.length > 0 && (
                          <span className="size-2 shrink-0 animate-pulse rounded-full bg-success" />
                        )}
                        <span className="truncate font-semibold">{station.ocppConnectionName}</span>
                      </div>
                      {!station.isOnline ? (
                        <Badge variant="muted">{translate('Overview.offline')}</Badge>
                      ) : chargerStatus ? (
                        <Badge variant="outline" className={getStatusColor[chargerStatus]}>
                          {chargerStatus}
                        </Badge>
                      ) : (
                        <Badge variant="muted">{translate('Overview.unknown')}</Badge>
                      )}
                    </div>

                    {sessions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {station.isOnline
                          ? translate('Overview.notCharging')
                          : translate('Overview.stationOffline')}
                      </div>
                    ) : (
                      sessions.map((transaction) => {
                        const idToken = transaction.authorization?.idToken;
                        const card = idToken ? describe(idToken) : null;
                        const amps = getCurrentAmps(transaction);
                        const elapsed = formatElapsed(transaction.startTime, now);

                        return (
                          <div key={transaction.id} className="flex flex-col gap-1">
                            <div className="truncate text-sm text-muted-foreground">
                              #{transaction.transactionId}
                              {card ? ` · ${card.title}` : ''}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              {amps !== null && (
                                <span className="font-semibold">
                                  {translate('Overview.currentDraw', { value: amps.toFixed(1) })}
                                </span>
                              )}
                              <span className="flex items-center gap-1 font-semibold">
                                <ZapIcon className="size-4 text-warning" />
                                {Number(transaction.totalKwh ?? 0).toFixed(2)} kWh
                              </span>
                              {elapsed && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <ClockIcon className="size-3.5" />
                                  {elapsed}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </CanAccess>
  );
};
