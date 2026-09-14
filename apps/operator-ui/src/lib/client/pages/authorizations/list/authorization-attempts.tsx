// SPDX-FileCopyrightText: 2026 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import {
  type OCPPMessageDto,
  MessageOrigin,
  OCPP_CallAction,
  OCPPMessageProps,
} from '@citrineos/types';
import { DebounceSearch } from '@lib/client/components/debounce-search';
import { CollapsibleOCPPMessageViewer } from '@lib/client/pages/charging-stations/detail/collapsible-ocpp-message-viewer';
import { Table } from '@lib/client/components/table';
import { TableQueryStateSchema } from '@lib/client/components/table/fields/table-query-state';
import { TimestampDisplay } from '@lib/client/components/timestamp-display';
import { Badge } from '@lib/client/components/ui/badge';
import { Button } from '@lib/client/components/ui/button';
import { DateTimePicker } from '@lib/client/components/ui/date-time-picker';
import { Label } from '@lib/client/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@lib/client/components/ui/select';
import { Switch } from '@lib/client/components/ui/switch';
import { OCPPMessageClass } from '@lib/cls/ocpp-message-dto';
import { ResourceType } from '@lib/utils/access-types';
import { getPageSizePreference } from '@lib/utils/store/table-preferences-slice';
import { getPlainToInstanceOptions } from '@lib/utils/tables';
import { useInvalidate, useTranslate } from '@refinedev/core';
import type { CellContext } from '@tanstack/react-table';
import { gql } from 'graphql-tag';
import { RefreshCw } from 'lucide-react';
import { parseAsJson, useQueryState } from 'nuqs';
import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

// Attempts are only ever OCPP `Authorize` calls (the request carrying the
// idTag) and their matching results (the CSMS's Accepted/Blocked/etc verdict)
// — unlike the station-scoped OCPP Messages tab, this view is never meant to
// show other actions, so there's no action filter to reset.
const RESOURCE_KEY = `${ResourceType.OCPP_MESSAGES}-authorize-attempts`;
const allOption = 'all';

// Renders a plain JS value as inline GraphQL syntax (unquoted object keys)
// rather than JSON. Only ever fed our own hand-built bool_exp fragments
// (identifier keys, string/object values), so this simple key-unquoting pass
// is sufficient — it doesn't need to handle arbitrary JSON.
const toGraphQLLiteral = (value: unknown): string =>
  JSON.stringify(value).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:');

const resultFromPayload = (
  message: OCPPMessageDto,
): { label: string; variant: 'success' | 'destructive' | 'muted' } | null => {
  const payload = message.payload as Record<string, any> | undefined;
  if (!payload) return null;
  if (message.origin === MessageOrigin.ChargingStation && payload.idTag) {
    return { label: payload.idTag, variant: 'muted' };
  }
  const status = payload.idTagInfo?.status;
  if (!status) return null;
  return { label: status, variant: status === 'Accepted' ? 'success' : 'destructive' };
};

export const AuthorizationAttempts: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [searchIdTag, setSearchIdTag] = useState<string>('');
  const [selectedOrigin, setSelectedOrigin] = useState<string>(allOption);
  const [liveLogEnabled, setLiveLogEnabled] = useState(false);
  const translate = useTranslate();
  const invalidate = useInvalidate();

  const originOptions = useMemo(
    () => [
      { label: translate('ChargingStations.ocppMessages.allOrigins'), value: allOption },
      ...Object.values(MessageOrigin).map((o) => ({
        label: o.toUpperCase(),
        value: o,
      })),
    ],
    [translate],
  );

  const [tableQueryState] = useQueryState(RESOURCE_KEY, parseAsJson(TableQueryStateSchema.parse));

  const pageSizePreference = useSelector((state) => getPageSizePreference(state, RESOURCE_KEY));

  const handleRefresh = () => {
    invalidate({ resource: ResourceType.OCPP_MESSAGES, invalidates: ['list'] });
  };

  // Built as raw Hasura bool_exp fragments (rather than going through Refine's
  // generic CrudFilter -> operator translation) because that translation maps
  // 'contains' to `_ilike`, which Hasura doesn't expose for jsonb columns, and
  // an unrecognized operator name never reaches the network at all — Refine's
  // filter-to-variable merging silently breaks (an array meant for `$where`
  // comes out the other side as an object with numeric-string keys, which
  // Hasura then rejects). So the where-clause is spliced directly into the
  // query text below as inline GraphQL syntax, bypassing that layer of
  // translation and merging entirely — there's no `$where` variable left for
  // Refine to touch.
  const query = useMemo(() => {
    const clauses: Record<string, any>[] = [{ action: { _eq: OCPP_CallAction.Authorize } }];
    if (searchIdTag.trim()) {
      // idTag only ever lives on the request payload (`{ idTag: "..." }`); the
      // response payload carries `idTagInfo` instead, so containment on the
      // idTag key alone is enough to scope this to matching requests.
      clauses.push({ payload: { _contains: { idTag: searchIdTag.trim() } } });
    }
    if (startDate) {
      clauses.push({ timestamp: { _gte: startDate.toISOString() } });
    }
    if (endDate) {
      clauses.push({ timestamp: { _lte: endDate.toISOString() } });
    }
    if (selectedOrigin && selectedOrigin !== allOption) {
      clauses.push({ origin: { _eq: selectedOrigin } });
    }
    const whereLiteral = toGraphQLLiteral({ _and: clauses });
    // Built as a plain string (not a `gql` tagged template) because the
    // where-clause has to be spliced into the query TEXT, not passed as an
    // interpolated tag value — `gql` tag interpolation is for composing other
    // DocumentNode fragments, not arbitrary strings. `gql(str)` (function
    // call form) parses a complete query string the same as the tag would.
    // Refine's data-provider always sends a `where` variable regardless of
    // whether the query declares/uses one, so `$where` has to be declared
    // here and folded in (as a harmless extra `_and` branch) — a query that
    // ignored it outright would fail Hasura's "unexpected variable" check.
    const queryString = `
      query GetOCPPMessagesListForAttempts(
        $where: [OCPPMessages_bool_exp!] = []
        $order_by: [OCPPMessages_order_by!] = {}
        $offset: Int
        $limit: Int
      ) {
        OCPPMessages(
          where: { _and: [${whereLiteral}, { _and: $where }] }
          order_by: $order_by
          offset: $offset
          limit: $limit
        ) {
          id
          ocppConnectionName
          correlationId
          origin
          type
          protocol
          action
          payload
          raw
          timestamp
          createdAt
          updatedAt
        }
        OCPPMessages_aggregate(where: { _and: [${whereLiteral}, { _and: $where }] }) {
          aggregate {
            count
          }
        }
      }
    `;
    return gql(queryString);
  }, [startDate, endDate, searchIdTag, selectedOrigin]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {translate(
            'Authorizations.attempts.description',
            'Every Authorize request received from a charging station, and the CSMS response, across all stations.',
          )}
        </p>
        <div className="flex items-center gap-3">
          {!liveLogEnabled && (
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Switch checked={liveLogEnabled} onCheckedChange={setLiveLogEnabled} />
          <Label className="font-medium">{translate('ChargingStations.liveLog')}</Label>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 w-full">
        <DebounceSearch
          onSearch={setSearchIdTag}
          placeholder={translate('Authorizations.attempts.searchIdTag')}
          className="relative w-full"
        />
        <Select value={selectedOrigin ?? ''} onValueChange={setSelectedOrigin}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={translate('ChargingStations.ocppMessages.filterOrigins')} />
          </SelectTrigger>
          <SelectContent>
            {originOptions.map((opt) => (
              <SelectItem key={opt.label} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateTimePicker
          date={startDate ?? undefined}
          onSelectDateAction={(date) => setStartDate(date ?? null)}
          placeholder={translate('ChargingStations.ocppMessages.pickStartDate')}
        />
        <DateTimePicker
          date={endDate ?? undefined}
          onSelectDateAction={(date) => setEndDate(date ?? null)}
          placeholder={translate('ChargingStations.ocppMessages.pickEndDate')}
        />
      </div>

      <Table<OCPPMessageDto>
        key={liveLogEnabled ? 'authorize-attempts-live' : 'authorize-attempts-static'}
        refineCoreProps={{
          resource: ResourceType.OCPP_MESSAGES,
          liveMode: liveLogEnabled ? 'auto' : 'off',
          pagination: {
            currentPage: tableQueryState?.page ?? 1,
            pageSize: tableQueryState?.size ?? pageSizePreference,
          },
          sorters: {
            initial: [{ field: OCPPMessageProps.timestamp, order: 'desc' }],
          },
          meta: {
            gqlQuery: query,
          },
          queryOptions: getPlainToInstanceOptions(OCPPMessageClass),
        }}
        rowClassName={(record) =>
          record.origin === MessageOrigin.ChargingStation ? 'bg-secondary/25' : 'bg-success/25'
        }
        enableSorting
        enableFilters
        showHeader
        tableStateKey={RESOURCE_KEY}
      >
        {[
          <Table.Column
            id="timestamp"
            key="timestamp"
            accessorKey="timestamp"
            header={translate('ChargingStations.ocppMessages.timestamp')}
            enableSorting
            cell={({ row }: CellContext<OCPPMessageDto, unknown>) => (
              <TimestampDisplay isoTimestamp={row.original.timestamp} format="yyyy-MM-dd HH:mm:ss.SSS" />
            )}
          />,
          <Table.Column
            id="station"
            key="station"
            accessorKey="ocppConnectionName"
            header={translate('Authorizations.attempts.station', 'Charging Station')}
            cell={({ row }: CellContext<OCPPMessageDto, unknown>) => (
              <span>{row.original.ocppConnectionName ?? '-'}</span>
            )}
          />,
          <Table.Column
            id="direction"
            key="direction"
            accessorKey="origin"
            header={translate('ChargingStations.ocppMessages.actionOrigin')}
            cell={({ row }: CellContext<OCPPMessageDto, unknown>) => (
              <span>
                {row.original.origin === MessageOrigin.ChargingStation
                  ? translate('Authorizations.attempts.request', 'Request')
                  : translate('Authorizations.attempts.response', 'Response')}
              </span>
            )}
          />,
          <Table.Column
            id="result"
            key="result"
            accessorKey="payload"
            header={translate('Authorizations.attempts.idTagOrResult', 'ID Tag / Result')}
            cell={({ row }: CellContext<OCPPMessageDto, unknown>) => {
              const result = resultFromPayload(row.original);
              return result ? <Badge variant={result.variant}>{result.label}</Badge> : <span>-</span>;
            }}
          />,
          <Table.Column
            id="message"
            key="message"
            accessorKey="message"
            header={translate('ChargingStations.ocppMessages.content')}
            cell={({ row }: CellContext<OCPPMessageDto, unknown>) => (
              <CollapsibleOCPPMessageViewer
                ocppMessageDto={row.original}
                unparsed={row.original.payload === undefined}
              />
            )}
          />,
        ]}
      </Table>
    </div>
  );
};

export default AuthorizationAttempts;
