// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

export const NO_TAG_KEY = '__no_tag__';

export interface CalculatorTransaction {
  id: number;
  transactionId: string;
  ocppConnectionName: string;
  totalKwh: number | null;
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
  authorization?: { id: number; idToken: string } | null;
}

export const kwhOf = (tx: CalculatorTransaction): number => Number(tx.totalKwh) || 0;

export const makeMoneyFormatter = (currency: string) => {
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  return (amount: number) => formatter.format(amount);
};

export const formatKwh = (kwh: number) => `${kwh.toFixed(2)} kWh`;

export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

// Day boundaries are taken in the user's local time zone, then sent as UTC instants.
export const localDayStartIso = (yyyyMmDd: string) =>
  new Date(`${yyyyMmDd}T00:00:00`).toISOString();
export const localDayEndIso = (yyyyMmDd: string) =>
  new Date(`${yyyyMmDd}T23:59:59.999`).toISOString();

export interface CardGroup {
  key: string;
  idToken: string | null;
  transactions: CalculatorTransaction[];
  totalKwh: number;
}

export const groupByCard = (transactions: CalculatorTransaction[]): CardGroup[] => {
  const groups = new Map<string, CardGroup>();
  for (const tx of transactions) {
    const idToken = tx.authorization?.idToken ?? null;
    const key = idToken ?? NO_TAG_KEY;
    let group = groups.get(key);
    if (!group) {
      group = { key, idToken, transactions: [], totalKwh: 0 };
      groups.set(key, group);
    }
    group.transactions.push(tx);
    group.totalKwh += kwhOf(tx);
  }
  return Array.from(groups.values()).sort((a, b) => b.totalKwh - a.totalKwh);
};
