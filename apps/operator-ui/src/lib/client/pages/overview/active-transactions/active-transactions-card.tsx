// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import { type TransactionDto, BaseProps, TransactionProps } from '@citrineos/types';
import { Combobox } from '@lib/client/components/combobox';
import { MenuSection } from '@lib/client/components/main-menu/main-menu';
import { TransactionClass } from '@lib/cls/transaction-dto';
import { TRANSACTION_LIST_QUERY } from '@lib/queries/transactions';
import { ActionType, ResourceType } from '@lib/utils/access-types';
import { getPlainToInstanceOptions } from '@lib/utils/tables';
import { CanAccess, useList, useTranslate } from '@refinedev/core';
import { ChevronRightIcon, ClockIcon, ZapIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@lib/client/components/ui/badge';
import { Card, CardContent, CardHeader } from '@lib/client/components/ui/card';
import { heading2Style } from '@lib/client/styles/page';
import { overviewClickableStyle } from '@lib/client/styles/card';
import { Skeleton } from '@lib/client/components/ui/skeleton';
import { AccessDeniedFallbackCard } from '@lib/client/components/access-denied-fallback-card';
import { useCardLabels } from '@lib/client/hooks/use-card-labels';

const MAX_LISTED = 6;

const formatElapsed = (startTime: string | Date | null | undefined, now: number): string | null => {
  if (!startTime) return null;
  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) return null;
  const totalMinutes = Math.max(0, Math.floor((now - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const ActiveTransactionsCard = () => {
  const { push } = useRouter();
  const translate = useTranslate();
  const { describe } = useCardLabels();
  const [searchFilters, setSearchFilters] = useState<any[]>([]);

  // Re-render every 30 s so the running time keeps counting.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const {
    query: { data, isLoading, isError },
  } = useList<TransactionDto>({
    resource: ResourceType.TRANSACTIONS,
    meta: {
      gqlQuery: TRANSACTION_LIST_QUERY,
      gqlVariables: {
        offset: 0,
        limit: MAX_LISTED,
        where: { isActive: { _eq: true } },
      },
    },
    queryOptions: getPlainToInstanceOptions(TransactionClass),
    sorters: [{ field: BaseProps.updatedAt, order: 'desc' }],
    pagination: {
      mode: 'off',
    },
  });

  const {
    query: { data: searchData },
  } = useList<TransactionDto>({
    resource: ResourceType.TRANSACTIONS,
    filters: searchFilters,
    meta: {
      gqlQuery: TRANSACTION_LIST_QUERY,
      gqlVariables: {
        offset: 0,
        limit: 5,
        where: { isActive: { _eq: true } },
      },
    },
    queryOptions: {
      ...getPlainToInstanceOptions(TransactionClass),
      enabled: searchFilters.length > 0,
    },
    sorters: [{ field: BaseProps.updatedAt, order: 'desc' }],
    pagination: { mode: 'off' },
  });

  const handleSearch = (value: string) => {
    if (!value) {
      setSearchFilters([]);
      return;
    }
    setSearchFilters([
      {
        operator: 'and',
        value: [
          {
            field: TransactionProps.transactionId,
            operator: 'contains',
            value,
          },
        ],
      },
    ]);
  };

  const searchResults = searchData?.data || [];
  const transactions = data?.data ?? [];
  const total = data?.total ?? 0;

  if (isLoading) {
    return <Skeleton className="size-full" />;
  }

  return (
    <CanAccess
      resource={ResourceType.TRANSACTIONS}
      action={ActionType.LIST}
      fallback={<AccessDeniedFallbackCard />}
    >
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className={heading2Style}>{translate('Overview.activeTransactions')}</h2>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <div
              className={overviewClickableStyle}
              onClick={() => push(`/${MenuSection.TRANSACTIONS}`)}
            >
              {translate('Overview.viewAllTransactions')} <ChevronRightIcon />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {isError ? (
            <p>{translate('Overview.errorLoadingData')}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="max-w-md">
                <Combobox<number>
                  options={searchResults.map((tx) => ({
                    label: tx.transactionId,
                    value: tx.id!,
                  }))}
                  onSelect={(id) => push(`/${MenuSection.TRANSACTIONS}/${id}`)}
                  onSearch={handleSearch}
                  placeholder={translate('placeholders.search')}
                />
              </div>

              {transactions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {transactions.map((transaction) => {
                    const idToken = (transaction as any).authorization?.idToken as
                      | string
                      | undefined;
                    const card = idToken ? describe(idToken) : null;
                    const elapsed =
                      formatElapsed((transaction as any).startTime, now) ??
                      (transaction.timeSpentCharging
                        ? String(transaction.timeSpentCharging)
                        : null);

                    return (
                      <div
                        key={transaction.id}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary"
                        onClick={() => push(`/${MenuSection.TRANSACTIONS}/${transaction.id}`)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="size-2 shrink-0 animate-pulse rounded-full bg-success" />
                            <span className="truncate font-semibold">
                              {transaction.ocppConnectionName}
                            </span>
                          </div>
                          <div className="truncate text-sm text-muted-foreground">
                            #{transaction.transactionId}
                            {card ? ` · ${card.title}` : ''}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="flex items-center justify-end gap-1 font-semibold">
                            <ZapIcon className="size-4 text-warning" />
                            {Number(transaction.totalKwh ?? 0).toFixed(2)} kWh
                          </div>
                          {elapsed && (
                            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                              <ClockIcon className="size-3" />
                              {elapsed}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {total > transactions.length && (
                    <div
                      className="cursor-pointer pt-1 text-center text-sm text-muted-foreground hover:text-primary"
                      onClick={() => push(`/${MenuSection.TRANSACTIONS}`)}
                    >
                      +{total - transactions.length} {translate('Overview.more')}
                    </div>
                  )}
                </div>
              ) : (
                <span>{translate('Overview.noActiveTransactions')}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </CanAccess>
  );
};
