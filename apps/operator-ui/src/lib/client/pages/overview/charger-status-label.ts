// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import { ChargerStatusEnum } from '@lib/utils/enums';
import { useTranslate } from '@refinedev/core';

const STATUS_KEYS: Record<ChargerStatusEnum, string> = {
  [ChargerStatusEnum.CHARGING]: 'charging',
  [ChargerStatusEnum.CHARGING_SUSPENDED]: 'chargingSuspended',
  [ChargerStatusEnum.PREPARING]: 'preparing',
  [ChargerStatusEnum.AVAILABLE]: 'available',
  [ChargerStatusEnum.UNAVAILABLE]: 'unavailable',
  [ChargerStatusEnum.FAULTED]: 'faulted',
  [ChargerStatusEnum.OFFLINE]: 'offline',
  [ChargerStatusEnum.ONLINE]: 'online',
};

/**
 * Display name for a charger status in the current language. The enum values
 * themselves are English and double as keys elsewhere (colours, sorting), so
 * they must not be shown directly.
 */
export const useChargerStatusLabel = () => {
  const translate = useTranslate();
  return (status?: ChargerStatusEnum): string =>
    status ? translate(`Overview.chargerStatus.${STATUS_KEYS[status]}`) : '';
};
