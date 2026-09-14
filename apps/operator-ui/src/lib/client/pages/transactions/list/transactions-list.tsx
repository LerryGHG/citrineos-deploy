// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import { Table } from '@lib/client/components/table';
import {
  getTransactionsColumns,
  getTransactionsFilters,
  transactionAuthorizationIdTokenField,
  transactionChargingStationLocationNameField,
  transactionStationIdField,
} from '@lib/client/pages/transactions/columns';
import { TransactionClass } from '@lib/cls/transaction-dto';
import { TransactionProps } from '@citrineos/types';
import { TRANSACTION_LIST_QUERY } from '@lib/queries/transactions';
import { ActionType, ResourceType } from '@lib/utils/access-types';
import { AccessDeniedFallback } from '@lib/utils/access-denied-fallback';
import { DEFAULT_SORTERS, EMPTY_FILTER } from '@lib/utils/consts';
import { getPlainToInstanceOptions } from '@lib/utils/tables';
import { CanAccess, useDataProvider, useTranslate } from '@refinedev/core';
import { useState } from 'react';
import { heading2Style, pageMargin } from '@lib/client/styles/page';
import {
  tableHeaderWrapperFlex,
  tableSearchFlex,
  tableWrapperStyle,
} from '@lib/client/styles/table';
import { DebounceSearch } from '@lib/client/components/debounce-search';
import { Button } from '@lib/client/components/ui/button';
import { buttonIconSize } from '@lib/client/styles/icon';
import { useColumnPreferences } from '@lib/client/hooks/use-column-preferences';
import { usePreview } from '@lib/client/hooks/use-preview';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Quoted per RFC 4180: doubles embedded quotes, wraps any field containing a
// comma/quote/newline. Written by hand rather than via Refine's `useExport`
// (download: true) because that produced no visible download at all here —
// no error, no file — for reasons that weren't worth chasing further.
const toCsvField = (value: unknown): string => {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const downloadCsv = (headers: string[], rows: unknown[][], filename: string) => {
  const lines = [headers.join(','), ...rows.map((row) => row.map(toCsvField).join(','))];
  // Excel picks its CSV delimiter from the OS's regional "list separator"
  // setting rather than sniffing the file, so on locales where that's ';'
  // (common outside the US) a plain comma-separated file opens as one column
  // per row instead of splitting. `sep=,` as the literal first line is an
  // Excel-specific override that fixes this on a plain double-click open;
  // Excel itself strips the line before treating row 2 as the header.
  const blob = new Blob([`sep=,\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// One extractor per column `key` from getTransactionsColumns, so the CSV can
// follow whatever columns are actually visible (and in whatever order the
// user has them) instead of a separately-maintained hardcoded list — export
// a hidden column and it's just as absent from the file as it is on screen.
const transactionColumnValueExtractors: Record<string, (t: any) => unknown> = {
  [TransactionProps.transactionId]: (t) => t.transactionId,
  [TransactionProps.isActive]: (t) => (t.isActive ? 'Yes' : 'No'),
  [transactionStationIdField]: (t) => t.chargingStation?.ocppConnectionName,
  [transactionChargingStationLocationNameField]: (t) => t.location?.name,
  [transactionAuthorizationIdTokenField]: (t) => t.authorization?.idToken,
  [TransactionProps.totalKwh]: (t) => t.totalKwh,
  status: (t) => t.chargingState,
  [TransactionProps.startTime]: (t) => t.startTime,
  [TransactionProps.endTime]: (t) => t.endTime,
  [TransactionProps.createdAt]: (t) => t.createdAt,
  [TransactionProps.updatedAt]: (t) => t.updatedAt,
};

export const TransactionsList = () => {
  const [filters, setFilters] = useState<any>(EMPTY_FILTER);
  const { openPreview } = usePreview();
  const handlePreview = (station: { ocppConnectionName?: string | null }) => {
    if (station.ocppConnectionName) openPreview(station.ocppConnectionName);
  };
  const translate = useTranslate();

  const { renderedVisibleColumns, columnSelector, visibleColumns } = useColumnPreferences(
    getTransactionsColumns(translate, handlePreview),
    ResourceType.TRANSACTIONS,
  );

  const onSearch = (value: string) => {
    setFilters(value ? getTransactionsFilters(value) : EMPTY_FILTER);
  };

  const getDataProvider = useDataProvider();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data } = await getDataProvider().getList<TransactionClass>({
        resource: ResourceType.TRANSACTIONS,
        pagination: { currentPage: 1, pageSize: 10000, mode: 'server' },
        // dataProvider.getList() takes a plain CrudSort[] — unlike
        // `refineCoreProps.sorters`, which takes the hook-config wrapper
        // shape `{ initial: [...] }` that DEFAULT_SORTERS is built for.
        sorters: DEFAULT_SORTERS.initial,
        // EMPTY_FILTER is `[{ operator: 'or', value: [] }]` — a no-op
        // sentinel the Table component's own filter-merging logic treats as
        // "no filter", but a vacuous OR (zero branches) taken literally by
        // the raw data provider matches nothing at all, which is why the
        // first version of this exported a file with zero rows even though
        // the fetch itself succeeded.
        filters: filters === EMPTY_FILTER ? [] : filters,
        meta: {
          gqlQuery: TRANSACTION_LIST_QUERY,
        },
      });

      const headers = visibleColumns.map((c) => c.header);
      const rows = data.map((transaction) =>
        visibleColumns.map((c) => transactionColumnValueExtractors[c.key]?.(transaction) ?? ''),
      );

      downloadCsv(headers, rows, `transactions-${Date.now()}.csv`);
    } catch (err) {
      // JSON.stringify(err) prints '{}' for a plain Error (message/stack
      // aren't enumerable own properties), which is why the first version of
      // this surfaced a blank error — pull the message out explicitly.
      console.error('Transaction CSV export failed:', err);
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      toast.error(translate('Transactions.exportToCsvError', { error: message }));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`${pageMargin} ${tableWrapperStyle}`}>
      <div className={tableHeaderWrapperFlex}>
        <h2 className={heading2Style}>{translate('Transactions.Transactions')}</h2>
        <div className={tableSearchFlex}>
          <CanAccess resource={ResourceType.TRANSACTIONS} action={ActionType.LIST}>
            <Button variant="secondary" disabled={isExporting} onClick={handleExport}>
              {isExporting ? (
                <Loader2 className={`${buttonIconSize} animate-spin`} />
              ) : (
                <Download className={buttonIconSize} />
              )}
              {translate('buttons.exportToCsv')}
            </Button>
            {columnSelector}
            <DebounceSearch
              onSearch={onSearch}
              placeholder={`${translate('placeholders.search')} ${translate('Transactions.Transactions')}`}
            />
          </CanAccess>
        </div>
      </div>
      <CanAccess
        resource={ResourceType.TRANSACTIONS}
        action={ActionType.LIST}
        fallback={<AccessDeniedFallback />}
      >
        <Table
          refineCoreProps={{
            resource: ResourceType.TRANSACTIONS,
            sorters: DEFAULT_SORTERS,
            filters: {
              permanent: filters,
            },
            meta: {
              gqlQuery: TRANSACTION_LIST_QUERY,
            },
            queryOptions: {
              ...getPlainToInstanceOptions(TransactionClass),
              select: (data: any) => {
                return data;
              },
            },
          }}
          enableSorting
          enableFilters
          showHeader
          tableStateKey={ResourceType.TRANSACTIONS}
        >
          {renderedVisibleColumns}
        </Table>
      </CanAccess>
    </div>
  );
};
