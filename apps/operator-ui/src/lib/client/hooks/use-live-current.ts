// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import { useMemo } from 'react';
import { OCPP2_0_1 } from '@citrineos/types';
import { findOverallValue, normalizeValue } from '@lib/cls/meter-value-dto';
import { LIVE_MONITOR_METER_VALUES_QUERY } from '@lib/queries/live-monitor';
import { useGqlCustom } from '@lib/utils/use-gql-custom';

export const LIVE_WINDOW_MS = 15 * 60 * 1000;
const REFRESH_MS = 5000;
const LIVE_COLORS = ['#f5a524', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#14b8a6'];

export interface CurrentPoint {
  t: number;
  amps: number;
}

/**
 * Recent current (A) readings of running sessions, refreshed every few seconds.
 * Shared by the Live Monitor card and the per-station sparklines so both show the same
 * data in the same colours.
 */
export const useLiveCurrent = () => {
  const {
    query: { data, isLoading, error },
  } = useGqlCustom({
    gqlQuery: LIVE_MONITOR_METER_VALUES_QUERY,
    queryOptions: { refetchInterval: REFRESH_MS },
  });

  const rows = useMemo(() => ((data?.data as any)?.MeterValues ?? []) as any[], [data]);

  const derived = useMemo(() => {
    const cutoff = Date.now() - LIVE_WINDOW_MS;
    const pointsByStation = new Map<string, CurrentPoint[]>();
    const byTime = new Map<number, Record<string, number>>();
    const latest = new Map<string, CurrentPoint>();

    for (const row of rows) {
      const t = new Date(row.timestamp).getTime();
      if (Number.isNaN(t) || t < cutoff || !row.sampledValue) continue;
      const overall = findOverallValue(row.sampledValue, OCPP2_0_1.MeasurandEnumType.Current_Import);
      if (!overall) continue;
      const normalized = normalizeValue(overall);
      if (normalized === null) continue;
      const amps = Number(normalized);
      const station: string = row.transaction?.ocppConnectionName ?? '?';

      const list = pointsByStation.get(station) ?? [];
      list.push({ t, amps });
      pointsByStation.set(station, list);

      const bucket = byTime.get(t) ?? {};
      bucket[station] = amps;
      byTime.set(t, bucket);

      const prev = latest.get(station);
      if (!prev || t > prev.t) latest.set(station, { t, amps });
    }

    for (const list of pointsByStation.values()) list.sort((a, b) => a.t - b.t);

    // Stations report at their own moments, so any one timestamp only has a value for one
    // of them. Carry each station's last reading forward so every point (and therefore a
    // hover tooltip) has all stations.
    const lastKnown: Record<string, number> = {};
    const chartData = Array.from(byTime.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, values]) => {
        Object.assign(lastKnown, values);
        return { t, ...lastKnown };
      });

    return {
      pointsByStation,
      chartData,
      stations: Array.from(pointsByStation.keys()).sort(),
      latest,
    };
  }, [rows]);

  const colorFor = (station: string): string => {
    const index = Math.max(0, derived.stations.indexOf(station));
    return LIVE_COLORS[index % LIVE_COLORS.length];
  };

  return { ...derived, colorFor, isLoading, error };
};
