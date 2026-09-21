// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CanAccess, useCustomMutation, useTranslate } from '@refinedev/core';
import { Card, CardContent, CardHeader } from '@lib/client/components/ui/card';
import { Badge } from '@lib/client/components/ui/badge';
import { Button } from '@lib/client/components/ui/button';
import { Input } from '@lib/client/components/ui/input';
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
import { CARD_LABEL_UPSERT_MUTATION, CARS_OVERVIEW_QUERY } from '@lib/queries/cars';
import { heading2Style, pageMargin } from '@lib/client/styles/page';

interface AuthorizationRow {
  id: number;
  idToken: string;
  status: string;
}

interface LabelRow {
  idToken: string;
  name: string;
  car: string;
  notes: string;
}

type Draft = Pick<LabelRow, 'name' | 'car' | 'notes'>;

const EMPTY_DRAFT: Draft = { name: '', car: '', notes: '' };

export const CarsList: React.FC = () => {
  const translate = useTranslate();
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    query: { data, isLoading, error, refetch },
  } = useGqlCustom({ gqlQuery: CARS_OVERVIEW_QUERY });

  const { mutate } = useCustomMutation();

  const authorizations: AuthorizationRow[] = (data?.data as any)?.Authorizations ?? [];
  const labels: LabelRow[] = (data?.data as any)?.CardLabels ?? [];

  const labelByToken = useMemo(() => {
    const map = new Map<string, LabelRow>();
    for (const label of labels) map.set(label.idToken.toLowerCase(), label);
    return map;
  }, [labels]);

  // Start every row from what is stored; edits live in `drafts` until saved.
  useEffect(() => {
    setDrafts({});
  }, [data]);

  const savedDraftFor = (idToken: string): Draft => {
    const label = labelByToken.get(idToken.toLowerCase());
    return label ? { name: label.name, car: label.car, notes: label.notes } : EMPTY_DRAFT;
  };

  const draftFor = (idToken: string): Draft => drafts[idToken] ?? savedDraftFor(idToken);

  const isDirty = (idToken: string) => {
    const draft = drafts[idToken];
    if (!draft) return false;
    const saved = savedDraftFor(idToken);
    return draft.name !== saved.name || draft.car !== saved.car || draft.notes !== saved.notes;
  };

  const updateDraft = (idToken: string, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [idToken]: { ...draftFor(idToken), [field]: value } }));
  };

  const save = (idToken: string) => {
    const draft = draftFor(idToken);
    setSavingKey(idToken);
    setSaveError(null);
    mutate(
      {
        url: '', // Required by useCustomMutation, not used for GraphQL
        method: 'post',
        values: {},
        meta: {
          gqlMutation: CARD_LABEL_UPSERT_MUTATION,
          gqlVariables: {
            object: {
              idToken,
              name: draft.name.trim(),
              car: draft.car.trim(),
              notes: draft.notes.trim(),
              updatedAt: new Date().toISOString(),
            },
          },
        },
      },
      {
        onSuccess: () => {
          setSavingKey(null);
          refetch();
        },
        onError: (err: any) => {
          setSavingKey(null);
          setSaveError(err?.message ?? translate('Cars.saveError'));
        },
      },
    );
  };

  const needle = search.trim().toLowerCase();
  const rows = authorizations.filter((auth) => {
    if (!needle) return true;
    const saved = savedDraftFor(auth.idToken);
    return [auth.idToken, saved.name, saved.car, saved.notes].some((v) =>
      v.toLowerCase().includes(needle),
    );
  });

  return (
    <div className={`${pageMargin} flex flex-col gap-4`}>
      <h2 className={heading2Style}>{translate('Cars.title')}</h2>
      <CanAccess
        resource={ResourceType.PARTNERS}
        action={ActionType.LIST}
        fallback={<AccessDeniedFallback />}
      >
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{translate('Cars.description')}</p>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={translate('Cars.search')}
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {saveError && <p className="mb-3 text-sm text-destructive">{saveError}</p>}
            {error ? (
              <p>{translate('Cars.errorLoading')}</p>
            ) : isLoading ? (
              <p>{translate('Cars.loading')}</p>
            ) : rows.length === 0 ? (
              <p>{translate('Cars.noCards')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate('Cars.rfidCard')}</TableHead>
                    <TableHead>{translate('Cars.status')}</TableHead>
                    <TableHead>{translate('Cars.driver')}</TableHead>
                    <TableHead>{translate('Cars.car')}</TableHead>
                    <TableHead>{translate('Cars.notes')}</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((auth) => {
                    const draft = draftFor(auth.idToken);
                    const dirty = isDirty(auth.idToken);
                    return (
                      <TableRow key={auth.id}>
                        <TableCell className="font-medium">{auth.idToken}</TableCell>
                        <TableCell>
                          <Badge variant={auth.status === 'Accepted' ? 'success' : 'muted'}>
                            {auth.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={draft.name}
                            onChange={(e) => updateDraft(auth.idToken, 'name', e.target.value)}
                            placeholder={translate('Cars.driverPlaceholder')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={draft.car}
                            onChange={(e) => updateDraft(auth.idToken, 'car', e.target.value)}
                            placeholder={translate('Cars.carPlaceholder')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={draft.notes}
                            onChange={(e) => updateDraft(auth.idToken, 'notes', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={dirty ? 'success' : 'outline'}
                            disabled={!dirty || savingKey === auth.idToken}
                            onClick={() => save(auth.idToken)}
                          >
                            {savingKey === auth.idToken
                              ? translate('Cars.saving')
                              : translate('Cars.save')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </CanAccess>
    </div>
  );
};
