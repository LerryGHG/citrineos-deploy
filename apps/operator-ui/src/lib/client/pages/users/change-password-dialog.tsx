// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React, { useState } from 'react';
import { useTranslate } from '@refinedev/core';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Alert, AlertDescription } from '@lib/client/components/ui/alert';
import { Button } from '@lib/client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@lib/client/components/ui/dialog';
import { Input } from '@lib/client/components/ui/input';
import { Label } from '@lib/client/components/ui/label';
import { cn } from '@lib/utils/cn';
import type { KeycloakUser } from '@lib/utils/keycloak-users';
import { type PasswordRule, passwordRuleMet } from '@lib/utils/password-policy';
import { setUserPassword } from '@lib/server/actions/users/keycloak-users';
import { usePasswordRuleLabel } from '@lib/client/pages/users/password-rule-label';

interface ChangePasswordDialogProps {
  user: KeycloakUser;
  rules: PasswordRule[];
  onClose: () => void;
  onSaved: (username: string) => void;
}

/**
 * Keycloak's own console only flashes a short-lived error when a password
 * breaks the policy, and saves nothing - easy to miss. Here every rule is
 * checked while typing, a password that breaks one can't be submitted, and if
 * Keycloak still refuses (a rule only it can check, like password history)
 * its reason stays in the dialog.
 */
export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  user,
  rules,
  onClose,
  onSaved,
}) => {
  const translate = useTranslate();
  const ruleLabel = usePasswordRuleLabel();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const results = rules.map((rule) => ({ rule, met: passwordRuleMet(rule, password, user) }));
  const typed = password.length > 0;
  const breaksRules = typed && results.some((result) => !result.met);
  const mismatch = repeat.length > 0 && repeat !== password;
  const canSave = typed && !breaksRules && repeat === password && !saving;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const result = await setUserPassword(user.id, password);
    setSaving(false);
    if (result.success) {
      onSaved(user.username);
    } else {
      setSaveError(result.error);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{translate('Users.dialogTitle', { username: user.username })}</DialogTitle>
            <DialogDescription>{translate('Users.dialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">{translate('Users.newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSaveError(null);
              }}
              aria-invalid={breaksRules}
            />
          </div>

          {results.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{translate('Users.rulesTitle')}</p>
              <ul
                className="flex flex-col gap-1 text-sm"
                aria-label={translate('Users.rulesTitle')}
              >
                {results.map(({ rule, met }) => (
                  <li
                    key={rule.kind}
                    data-met={typed ? met : undefined}
                    className={cn(
                      'flex items-center gap-2',
                      !typed && 'text-muted-foreground',
                      typed && met && 'text-success',
                      typed && !met && 'text-destructive',
                    )}
                  >
                    {typed && !met ? <X className="size-4" /> : <Check className="size-4" />}
                    {ruleLabel(rule)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {breaksRules && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{translate('Users.notCompliant')}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="repeat-password">{translate('Users.repeatPassword')}</Label>
            <Input
              id="repeat-password"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => {
                setRepeat(e.target.value);
                setSaveError(null);
              }}
              aria-invalid={mismatch}
            />
            {mismatch && <p className="text-sm text-destructive">{translate('Users.mismatch')}</p>}
          </div>

          {saveError && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>
                {translate('Users.saveFailed', { reason: saveError })}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {translate('Users.cancel')}
            </Button>
            <Button type="submit" variant="success" disabled={!canSave}>
              {saving ? translate('Users.saving') : translate('Users.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
