// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Keycloak keeps a realm's password policy as one string, e.g.
 * "length(8) and notUsername and notEmail". This parses the rules a browser
 * can check before the password is sent, so a password Keycloak would reject
 * is flagged while it's typed. Rules that need Keycloak's stored data
 * (passwordHistory, passwordBlacklist, ...) are skipped here; Keycloak still
 * applies them when the password is saved.
 */

export type CountedRuleKind =
  | 'length'
  | 'maxLength'
  | 'digits'
  | 'lowerCase'
  | 'upperCase'
  | 'specialChars';

export type PasswordRule =
  | { kind: CountedRuleKind; count: number }
  | { kind: 'notUsername' | 'notContainsUsername' | 'notEmail' }
  | { kind: 'regexPattern'; pattern: string; regex: RegExp };

export interface PasswordAccount {
  username: string;
  email?: string;
}

// Keycloak's own defaults when a policy names a rule without a value.
const COUNTED_DEFAULTS: Record<CountedRuleKind, number> = {
  length: 8,
  maxLength: 64,
  digits: 1,
  lowerCase: 1,
  upperCase: 1,
  specialChars: 1,
};

const POLICY_ENTRY = /^\s*([A-Za-z]+)\s*(?:\((.*)\))?\s*$/;

export function parsePasswordPolicy(policy: string | undefined | null): PasswordRule[] {
  if (!policy) return [];
  const rules: PasswordRule[] = [];
  for (const entry of policy.split(' and ')) {
    const match = POLICY_ENTRY.exec(entry);
    if (!match) continue;
    const [, name, value] = match;
    if (name in COUNTED_DEFAULTS) {
      const parsed = parseInt(value ?? '', 10);
      const kind = name as CountedRuleKind;
      rules.push({ kind, count: Number.isNaN(parsed) ? COUNTED_DEFAULTS[kind] : parsed });
    } else if (name === 'notUsername' || name === 'notContainsUsername' || name === 'notEmail') {
      rules.push({ kind: name });
    } else if (name === 'regexPattern' && value) {
      // Keycloak (Java) requires the whole password to match. A pattern
      // JavaScript can't compile is left to Keycloak.
      try {
        rules.push({
          kind: 'regexPattern',
          pattern: value,
          regex: new RegExp(`^(?:${value})$`, 'u'),
        });
      } catch {
        // skipped
      }
    }
  }
  return rules;
}

const countMatches = (password: string, pattern: RegExp) => password.match(pattern)?.length ?? 0;

export function passwordRuleMet(
  rule: PasswordRule,
  password: string,
  account: PasswordAccount,
): boolean {
  switch (rule.kind) {
    case 'length':
      return password.length >= rule.count;
    case 'maxLength':
      return password.length <= rule.count;
    case 'digits':
      return countMatches(password, /\p{Nd}/gu) >= rule.count;
    case 'lowerCase':
      return countMatches(password, /\p{Ll}/gu) >= rule.count;
    case 'upperCase':
      return countMatches(password, /\p{Lu}/gu) >= rule.count;
    case 'specialChars':
      // Keycloak counts every character that isn't a letter or a digit.
      return countMatches(password, /[^\p{L}\p{Nd}]/gu) >= rule.count;
    case 'notUsername':
      return password.toLowerCase() !== account.username.toLowerCase();
    case 'notContainsUsername':
      return !password.toLowerCase().includes(account.username.toLowerCase());
    case 'notEmail':
      return !account.email || password.toLowerCase() !== account.email.toLowerCase();
    case 'regexPattern':
      return rule.regex.test(password);
  }
}
