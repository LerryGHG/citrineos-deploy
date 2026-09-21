// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React, { useMemo, useState } from 'react';
import { useTranslate } from '@refinedev/core';
import { DownloadIcon, PrinterIcon } from 'lucide-react';
import { Button } from '@lib/client/components/ui/button';
import { Card, CardContent, CardHeader } from '@lib/client/components/ui/card';
import { Input } from '@lib/client/components/ui/input';
import { Label } from '@lib/client/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lib/client/components/ui/table';
import { useGqlCustom } from '@lib/utils/use-gql-custom';
import { COST_CALCULATOR_TRANSACTIONS_QUERY } from '@lib/queries/cost-calculator';
import { useCardLabels } from '@lib/client/hooks/use-card-labels';
import {
  type CalculatorTransaction,
  type CardGroup,
  formatDateTime,
  formatKwh,
  groupByCard,
  kwhOf,
  makeMoneyFormatter,
} from '@lib/client/pages/cost-calculator/shared';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthRange = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-').map(Number);
  return {
    startIso: new Date(year, month - 1, 1).toISOString(),
    endIso: new Date(year, month, 1).toISOString(),
  };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export interface BillingReportProps {
  pricePerKwh: number;
  currency: string;
}

export const BillingReport: React.FC<BillingReportProps> = ({ pricePerKwh, currency }) => {
  const translate = useTranslate();
  const { describe } = useCardLabels();

  const [month, setMonth] = useState<string>(currentMonth());
  const [selectedKey, setSelectedKey] = useState<string>('all');

  const effectiveMonth = /^\d{4}-\d{2}$/.test(month) ? month : currentMonth();
  const where = useMemo(() => {
    const { startIso, endIso } = monthRange(effectiveMonth);
    return { _and: [{ startTime: { _gte: startIso } }, { startTime: { _lt: endIso } }] };
  }, [effectiveMonth]);

  const {
    query: { data, isLoading, error },
  } = useGqlCustom({
    gqlQuery: COST_CALCULATOR_TRANSACTIONS_QUERY,
    variables: { where },
  });

  const transactions: CalculatorTransaction[] = (data?.data as any)?.Transactions ?? [];
  const formatMoney = useMemo(() => makeMoneyFormatter(currency), [currency]);

  const groups = useMemo(() => groupByCard(transactions), [transactions]);
  const activeKey = groups.some((g) => g.key === selectedKey) ? selectedKey : 'all';
  const visibleGroups = activeKey === 'all' ? groups : groups.filter((g) => g.key === activeKey);
  const totalKwh = visibleGroups.reduce((sum, g) => sum + g.totalKwh, 0);

  const groupTitle = (group: CardGroup) =>
    group.idToken ? describe(group.idToken) : {
      title: translate('CostCalculator.noTag'),
      subtitle: undefined,
      name: '',
      car: '',
    };

  const exportCsv = () => {
    const numberFormat = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
      useGrouping: false,
    });
    const cell = (value: string) => (/[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const header = [
      translate('CostCalculator.rfidCard'),
      translate('CostCalculator.driver'),
      translate('CostCalculator.car'),
      translate('CostCalculator.transaction'),
      translate('CostCalculator.station'),
      translate('CostCalculator.start'),
      translate('CostCalculator.end'),
      'kWh',
      `${translate('CostCalculator.pricePerKwh')} (${currency})`,
      `${translate('CostCalculator.cost')} (${currency})`,
    ];
    const lines = [header.map(cell).join(';')];
    for (const group of visibleGroups) {
      const card = groupTitle(group);
      for (const tx of group.transactions) {
        lines.push(
          [
            group.idToken ?? '',
            card.name,
            card.car,
            tx.transactionId,
            tx.ocppConnectionName,
            formatDateTime(tx.startTime),
            formatDateTime(tx.endTime),
            numberFormat.format(kwhOf(tx)),
            numberFormat.format(pricePerKwh),
            numberFormat.format(kwhOf(tx) * pricePerKwh),
          ]
            .map((v) => cell(String(v)))
            .join(';'),
        );
      }
    }
    // BOM so Excel opens it as UTF-8.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billing-${effectiveMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printStatement = () => {
    const title = `${translate('CostCalculator.statementTitle')} ${effectiveMonth}`;
    const sections = visibleGroups
      .map((group) => {
        const card = groupTitle(group);
        const rows = group.transactions
          .map(
            (tx) => `<tr>
              <td>#${escapeHtml(String(tx.transactionId))}</td>
              <td>${escapeHtml(tx.ocppConnectionName)}</td>
              <td>${escapeHtml(formatDateTime(tx.startTime))}</td>
              <td>${escapeHtml(formatDateTime(tx.endTime))}</td>
              <td class="r">${escapeHtml(formatKwh(kwhOf(tx)))}</td>
              <td class="r">${escapeHtml(formatMoney(kwhOf(tx) * pricePerKwh))}</td>
            </tr>`,
          )
          .join('');
        return `<section>
          <h2>${escapeHtml(card.title)}</h2>
          ${card.subtitle ? `<div class="sub">${escapeHtml(card.subtitle)}</div>` : ''}
          <table>
            <thead><tr>
              <th>${escapeHtml(translate('CostCalculator.transaction'))}</th>
              <th>${escapeHtml(translate('CostCalculator.station'))}</th>
              <th>${escapeHtml(translate('CostCalculator.start'))}</th>
              <th>${escapeHtml(translate('CostCalculator.end'))}</th>
              <th class="r">${escapeHtml(translate('CostCalculator.energy'))}</th>
              <th class="r">${escapeHtml(translate('CostCalculator.cost'))}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr>
              <td colspan="4">${escapeHtml(translate('CostCalculator.subtotal'))}</td>
              <td class="r">${escapeHtml(formatKwh(group.totalKwh))}</td>
              <td class="r">${escapeHtml(formatMoney(group.totalKwh * pricePerKwh))}</td>
            </tr></tfoot>
          </table>
        </section>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 32px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        h2 { font-size: 16px; margin: 24px 0 2px; }
        .sub { color: #666; font-size: 12px; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
        th, td { padding: 5px 6px; border-bottom: 1px solid #ddd; text-align: left; }
        th { border-bottom: 2px solid #999; }
        tfoot td { font-weight: 600; border-top: 2px solid #999; border-bottom: none; }
        .r { text-align: right; }
        section { page-break-inside: avoid; }
        .grand { margin-top: 28px; font-size: 15px; font-weight: 600; text-align: right; }
      </style></head><body>
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">${escapeHtml(translate('CostCalculator.pricePerKwh'))}: ${escapeHtml(formatMoney(pricePerKwh))}</div>
      ${sections || `<p>${escapeHtml(translate('CostCalculator.noTransactions'))}</p>`}
      <div class="grand">${escapeHtml(translate('CostCalculator.total'))}: ${escapeHtml(formatKwh(totalKwh))} · ${escapeHtml(formatMoney(totalKwh * pricePerKwh))}</div>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      window.alert(translate('CostCalculator.popupBlocked'));
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="billing-month">{translate('CostCalculator.month')}</Label>
                <Input
                  id="billing-month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="billing-card">{translate('CostCalculator.rfidCard')}</Label>
                <select
                  id="billing-card"
                  value={activeKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="h-9 w-64 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="all" className="text-black">
                    {translate('CostCalculator.allCards')}
                  </option>
                  {groups.map((group) => (
                    <option key={group.key} value={group.key} className="text-black">
                      {groupTitle(group).title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCsv} disabled={visibleGroups.length === 0}>
                <DownloadIcon /> {translate('CostCalculator.exportCsv')}
              </Button>
              <Button variant="outline" onClick={printStatement} disabled={visibleGroups.length === 0}>
                <PrinterIcon /> {translate('CostCalculator.print')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg">
            {translate('CostCalculator.total')}:{' '}
            <span className="font-semibold">
              {formatKwh(totalKwh)} · {formatMoney(totalKwh * pricePerKwh)}
            </span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p>{translate('CostCalculator.errorLoading')}</p>
      ) : isLoading ? (
        <p>{translate('CostCalculator.loading')}</p>
      ) : visibleGroups.length === 0 ? (
        <p>{translate('CostCalculator.noTransactions')}</p>
      ) : (
        visibleGroups.map((group) => {
          const card = groupTitle(group);
          return (
            <Card key={group.key}>
              <CardHeader>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-semibold">{card.title}</h3>
                    {card.subtitle && (
                      <div className="text-sm text-muted-foreground">{card.subtitle}</div>
                    )}
                  </div>
                  <div className="text-lg font-semibold">
                    {formatKwh(group.totalKwh)} · {formatMoney(group.totalKwh * pricePerKwh)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate('CostCalculator.transaction')}</TableHead>
                      <TableHead>{translate('CostCalculator.station')}</TableHead>
                      <TableHead>{translate('CostCalculator.start')}</TableHead>
                      <TableHead>{translate('CostCalculator.end')}</TableHead>
                      <TableHead className="text-right">
                        {translate('CostCalculator.energy')}
                      </TableHead>
                      <TableHead className="text-right">
                        {translate('CostCalculator.cost')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>#{tx.transactionId}</TableCell>
                        <TableCell>{tx.ocppConnectionName}</TableCell>
                        <TableCell>{formatDateTime(tx.startTime)}</TableCell>
                        <TableCell>
                          {tx.isActive
                            ? translate('CostCalculator.active')
                            : formatDateTime(tx.endTime)}
                        </TableCell>
                        <TableCell className="text-right">{formatKwh(kwhOf(tx))}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(kwhOf(tx) * pricePerKwh)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};
