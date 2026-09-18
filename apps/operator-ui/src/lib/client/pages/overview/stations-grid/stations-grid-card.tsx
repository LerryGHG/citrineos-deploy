// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React from 'react';
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
import { ChevronRightIcon } from 'lucide-react';
import { heading2Style } from '@lib/client/styles/page';
import { overviewClickableStyle } from '@lib/client/styles/card';
import { OverviewCardSkeleton } from '@lib/client/pages/overview/overview-card-skeleton';
import { AccessDeniedFallbackCard } from '@lib/client/components/access-denied-fallback-card';
import {
  connectorStatusToChargerStatus,
  getStatusColor,
} from '@lib/client/pages/overview/charger-activity/charger-activity-card';

// Loose shapes matching exactly what GET_CHARGING_STATIONS_OVERVIEW_GRID returns —
// deliberately not run through the ChargingStationClass/plainToInstance pipeline, since
// that class's @Expose names assume the unaliased field names this query doesn't use.
interface GridMeterValue {
  sampledValue: unknown;
  timestamp: string;
}
interface GridTransaction {
  isActive: boolean;
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

function getLatestConnectorStatus(station: GridStation): string | undefined {
  return station.latestStatusNotifications?.[0]?.statusNotification?.connectorStatus ?? undefined;
}

function getCurrentDrawAmps(station: GridStation): number | null {
  const meterValue = station.transactions?.[0]?.latestMeterValue?.[0];
  if (!meterValue?.sampledValue) return null;
  const overall = findOverallValue(
    meterValue.sampledValue as any,
    OCPP2_0_1.MeasurandEnumType.Current_Import,
  );
  if (!overall) return null;
  const normalized = normalizeValue(overall);
  return normalized !== null ? Number(normalized) : null;
}

export const StationsGridCard: React.FC = () => {
  const { push } = useRouter();
  const translate = useTranslate();

  const {
    query: { data, isLoading, error },
  } = useGqlCustom({
    gqlQuery: GET_CHARGING_STATIONS_OVERVIEW_GRID,
  });

  const stations: GridStation[] = data?.data.ChargingStations || [];

  if (isLoading) return <OverviewCardSkeleton />;

  return (
    <CanAccess
      resource={ResourceType.CHARGING_STATIONS}
      action={ActionType.LIST}
      fallback={<AccessDeniedFallbackCard />}
    >
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className={heading2Style}>{translate('Overview.stations')}</h2>
            <div
              className={overviewClickableStyle}
              onClick={() => push(`/${MenuSection.CHARGING_STATIONS}`)}
            >
              {translate('Overview.viewAllChargers')} <ChevronRightIcon />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto flex-1">
          {error ? (
            <p>{translate('Overview.errorLoadingData')}</p>
          ) : stations.length === 0 ? (
            <span>{translate('Overview.noStations')}</span>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {stations.map((station) => {
                const connectorStatus = getLatestConnectorStatus(station);
                const chargerStatus = station.isOnline
                  ? connectorStatus
                    ? connectorStatusToChargerStatus(connectorStatus)
                    : undefined
                  : undefined;
                const amps = station.isOnline ? getCurrentDrawAmps(station) : null;

                return (
                  <div
                    key={station.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 cursor-pointer hover:border-primary transition-colors"
                    onClick={() => push(`/${MenuSection.CHARGING_STATIONS}/${station.id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">{station.ocppConnectionName}</span>
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
                    <div className="text-sm text-muted-foreground">
                      {amps !== null
                        ? translate('Overview.currentDraw', { value: amps.toFixed(1) })
                        : translate('Overview.notCharging')}
                    </div>
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
