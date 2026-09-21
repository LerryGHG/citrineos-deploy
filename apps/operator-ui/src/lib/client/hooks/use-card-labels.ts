// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import { useCallback, useMemo } from 'react';
import { useGqlCustom } from '@lib/utils/use-gql-custom';
import { CARD_LABELS_QUERY } from '@lib/queries/cars';

export interface CardLabel {
  idToken: string;
  name: string;
  car: string;
  notes?: string;
}

export interface CardDescription {
  /** Friendly "Name – Car" if labelled, otherwise the raw tag. */
  title: string;
  /** The raw tag, only when it differs from the title. */
  subtitle?: string;
  name: string;
  car: string;
}

/**
 * Friendly names for RFID cards. If the CardLabels table is not available (e.g. Hasura
 * metadata not applied yet) this degrades to showing the raw tags instead of failing.
 */
export const useCardLabels = () => {
  const {
    query: { data, error, refetch },
  } = useGqlCustom({ gqlQuery: CARD_LABELS_QUERY });

  const labels = useMemo(() => {
    const map = new Map<string, CardLabel>();
    const rows = ((data?.data as any)?.CardLabels ?? []) as CardLabel[];
    for (const label of rows) map.set(label.idToken.toLowerCase(), label);
    return map;
  }, [data]);

  const describe = useCallback(
    (idToken: string): CardDescription => {
      const label = labels.get(idToken.toLowerCase());
      const name = label?.name?.trim() ?? '';
      const car = label?.car?.trim() ?? '';
      if (!name && !car) return { title: idToken, name, car };
      return { title: [name, car].filter(Boolean).join(' – '), subtitle: idToken, name, car };
    },
    [labels],
  );

  return { labels, describe, error, refetch };
};
