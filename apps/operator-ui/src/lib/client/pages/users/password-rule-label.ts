// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import { useTranslate } from '@refinedev/core';
import type { PasswordRule } from '@lib/utils/password-policy';

/** Returns a function giving a password rule's label in the current language. */
export const usePasswordRuleLabel = () => {
  const translate = useTranslate();
  return (rule: PasswordRule): string => {
    switch (rule.kind) {
      case 'regexPattern':
        return translate('Users.rules.regexPattern', { pattern: rule.pattern });
      case 'notUsername':
      case 'notContainsUsername':
      case 'notEmail':
        return translate(`Users.rules.${rule.kind}`);
      default:
        return translate(`Users.rules.${rule.kind}`, { count: rule.count });
    }
  };
};
