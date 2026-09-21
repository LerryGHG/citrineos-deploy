// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CanAccess, useTranslate } from '@refinedev/core';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@lib/client/components/ui/card';
import { Input } from '@lib/client/components/ui/input';
import { Label } from '@lib/client/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@lib/client/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lib/client/components/ui/table';
import { AccessDeniedFallback } from '@lib/utils/access-denied-fallback';
import { ActionType, ResourceType } from '@lib/utils/access-types';
import { useGqlCustom } from '@lib/utils/use-gql-custom';
import { COST_CALCULATOR_TRANSACTIONS_QUERY } from '@lib/queries/cost-calculator';
import { heading2Style, pageMargin } from '@lib/client/styles/page';
import { useCardLabels } from '@lib/client/hooks/use-card-labels';
import { BillingReport } from '@lib/client/pages/cost-calculator/billing-report';
import {
  type CalculatorTransaction,
  formatDateTime,
  formatKwh,
  groupByCard,
  kwhOf,
  localDayEndIso,
  localDayStartIso,
  makeMoneyFormatter,
} from '@lib/client/pages/cost-calculator/shared';

const PRICE_STORAGE_KEY = 'costCalculator.pricePerKwh';
const CURRENCY_STORAGE_KEY = 'costCalculator.currency';
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'BRL'];

export const CostCalculator: React.FC = () => {
  const translate = useTranslate();
  const { describe } = useCardLabels();

  const [pricePerKwh, setPricePerKwh] = useState<string>('0.30');
  const [currency, setCurrency] = useState<string>('EUR');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // The price is a per-browser setting for now; restore it once on mount.
  useEffect(() => {
    try {
      const savedPrice = window.localStorage.getItem(PRICE_STORAGE_KEY);
      const savedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (savedPrice !== null) setPricePerKwh(savedPrice);
      if (savedCurrency && CURRENCIES.includes(savedCurrency)) setCurrency(savedCurrency);
    } catch {
      // localStorage unavailable (private mode etc.) — defaults are fine.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRICE_STORAGE_KEY, pricePerKwh);
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    } catch {
      // ignore
    }
  }, [pricePerKwh, currency]);

  const where = useMemo(() => {
    const conditions: any[] = [];
    if (fromDate) conditions.push({ startTime: { _gte: localDayStartIso(fromDate) } });
    if (toDate) conditions.push({ startTime: { _lte: localDayEndIso(toDate) } });
    return conditions.length > 0 ? { _and: conditions } : {};
  }, [fromDate, toDate]);

  const {
    query: { data, isLoading, error },
  } = useGqlCustom({
    gqlQuery: COST_CALCULATOR_TRANSACTIONS_QUERY,
    variables: { where },
  });

  const transactions: CalculatorTransaction[] = (data?.data as any)?.Transactions ?? [];

  const price = Number(pricePerKwh.replace(',', '.'));
  const validPrice = Number.isFinite(price) && price >= 0 ? price : 0;
  const formatMoney = useMemo(() => makeMoneyFormatter(currency), [currency]);

  const groups = useMemo(() => groupByCard(transactions), [transactions]);
  const grandTotalKwh = groups.reduce((sum, g) => sum + g.totalKwh, 0);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={`${pageMargin} flex flex-col gap-4`}>
      <h2 className={heading2Style}>{translate('CostCalculator.title')}</h2>
      <CanAccess
        resource={ResourceType.TARIFFS}
        action={ActionType.LIST}
        fallback={<AccessDeniedFallback />}
      >
        <Card>
          <CardHeader>
            <h3 className="text-xl font-semibold">{translate('CostCalculator.settings')}</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price-per-kwh">{translate('CostCalculator.pricePerKwh')}</Label>
                <Input
                  id="price-per-kwh"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerKwh}
                  onChange={(e) => setPricePerKwh(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="currency">{translate('CostCalculator.currency')}</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-9 w-28 rounded-md border bg-transparent px-3 text-sm"
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code} className="text-black">
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {translate('CostCalculator.priceStoredNote')}
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="calculator">
          <TabsList>
            <TabsTrigger value="calculator">{translate('CostCalculator.tabCalculator')}</TabsTrigger>
            <TabsTrigger value="billing">{translate('CostCalculator.tabBilling')}</TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="from-date">{translate('CostCalculator.from')}</Label>
                      <Input
                        id="from-date"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-44"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="to-date">{translate('CostCalculator.to')}</Label>
                      <Input
                        id="to-date"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-44"
                      />
                    </div>
                  </div>
                  <div className="text-lg">
                    {translate('CostCalculator.total')}:{' '}
                    <span className="font-semibold">
                      {formatKwh(grandTotalKwh)} · {formatMoney(grandTotalKwh * validPrice)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {error ? (
                  <p>{translate('CostCalculator.errorLoading')}</p>
                ) : isLoading ? (
                  <p>{translate('CostCalculator.loading')}</p>
                ) : groups.length === 0 ? (
                  <p>{translate('CostCalculator.noTransactions')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>{translate('CostCalculator.rfidCard')}</TableHead>
                        <TableHead className="text-right">
                          {translate('CostCalculator.sessions')}
                        </TableHead>
                        <TableHead className="text-right">
                          {translate('CostCalculator.energy')}
                        </TableHead>
                        <TableHead className="text-right">
                          {translate('CostCalculator.cost')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map((group) => {
                        const isOpen = expanded.has(group.key);
                        const card = group.idToken ? describe(group.idToken) : null;
                        return (
                          <React.Fragment key={group.key}>
                            <TableRow className="cursor-pointer" onClick={() => toggle(group.key)}>
                              <TableCell>
                                {isOpen ? (
                                  <ChevronDownIcon className="size-4" />
                                ) : (
                                  <ChevronRightIcon className="size-4" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {card ? card.title : translate('CostCalculator.noTag')}
                                {card?.subtitle && (
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {card.subtitle}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {group.transactions.length}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatKwh(group.totalKwh)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatMoney(group.totalKwh * validPrice)}
                              </TableCell>
                            </TableRow>
                            {isOpen &&
                              group.transactions.map((tx) => (
                                <TableRow key={tx.id} className="bg-muted/30 text-sm">
                                  <TableCell />
                                  <TableCell className="text-muted-foreground">
                                    #{tx.transactionId} · {tx.ocppConnectionName} ·{' '}
                                    {formatDateTime(tx.startTime)}
                                    {tx.isActive ? ` (${translate('CostCalculator.active')})` : ''}
                                  </TableCell>
                                  <TableCell />
                                  <TableCell className="text-right">
                                    {formatKwh(kwhOf(tx))}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(kwhOf(tx) * validPrice)}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <BillingReport pricePerKwh={validPrice} currency={currency} />
          </TabsContent>
        </Tabs>
      </CanAccess>
    </div>
  );
};
