// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CanAccess, useTranslate } from '@refinedev/core';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@lib/client/components/ui/alert';
import { Badge } from '@lib/client/components/ui/badge';
import { Button } from '@lib/client/components/ui/button';
import { Card, CardContent, CardHeader } from '@lib/client/components/ui/card';
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
import {
  KEYCLOAK_FORBIDDEN,
  type KeycloakUser,
  type UsersAndPasswordPolicy,
} from '@lib/utils/keycloak-users';
import { parsePasswordPolicy } from '@lib/utils/password-policy';
import { getUsersAndPasswordPolicy } from '@lib/server/actions/users/keycloak-users';
import { ChangePasswordDialog } from '@lib/client/pages/users/change-password-dialog';
import { usePasswordRuleLabel } from '@lib/client/pages/users/password-rule-label';
import { heading2Style, pageMargin } from '@lib/client/styles/page';

export const UsersList: React.FC = () => {
  const translate = useTranslate();
  return (
    <div className={`${pageMargin} flex flex-col gap-4`}>
      <h2 className={heading2Style}>{translate('Users.title')}</h2>
      <CanAccess
        resource={ResourceType.USERS}
        action={ActionType.LIST}
        fallback={<AccessDeniedFallback />}
      >
        <UsersCard />
      </CanAccess>
    </div>
  );
};

const UsersCard: React.FC = () => {
  const translate = useTranslate();
  const ruleLabel = usePasswordRuleLabel();
  const [data, setData] = useState<UsersAndPasswordPolicy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<KeycloakUser | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);

  useEffect(() => {
    getUsersAndPasswordPolicy().then((result) => {
      if (result.success) {
        setData(result.data);
      } else {
        setLoadError(result.error);
      }
    });
  }, []);

  const rules = useMemo(() => parsePasswordPolicy(data?.passwordPolicy), [data]);

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">{translate('Users.description')}</p>
        {data && (
          <p className="text-sm text-muted-foreground">
            {rules.length > 0
              ? translate('Users.rulesSummary', { rules: rules.map(ruleLabel).join(' · ') })
              : translate('Users.noRules')}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {savedFor && (
          <p className="text-sm text-success">{translate('Users.saved', { username: savedFor })}</p>
        )}
        {loadError === KEYCLOAK_FORBIDDEN ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{translate('Users.keycloakForbidden')}</AlertDescription>
          </Alert>
        ) : loadError ? (
          <p>{translate('Users.errorLoading', { reason: loadError })}</p>
        ) : !data ? (
          <p>{translate('Users.loading')}</p>
        ) : data.users.length === 0 ? (
          <p>{translate('Users.noUsers')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate('Users.username')}</TableHead>
                <TableHead>{translate('Users.name')}</TableHead>
                <TableHead>{translate('Users.email')}</TableHead>
                <TableHead>{translate('Users.status')}</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{[user.firstName, user.lastName].filter(Boolean).join(' ')}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.enabled ? 'success' : 'muted'}>
                      {user.enabled ? translate('Users.enabled') : translate('Users.disabled')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSavedFor(null);
                        setEditing(user);
                      }}
                    >
                      {translate('Users.changePassword')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {editing && (
        <ChangePasswordDialog
          key={editing.id}
          user={editing}
          rules={rules}
          onClose={() => setEditing(null)}
          onSaved={(username) => {
            setEditing(null);
            setSavedFor(username);
          }}
        />
      )}
    </Card>
  );
};
