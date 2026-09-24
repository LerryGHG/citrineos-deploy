// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

const REQUIRED_KEYS = [
  'E2E_BASE_URL',
  'HASURA_URL',
  'CITRINE_CORE_URL',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
] as const;

const OPTIONAL_KEYS = ['E2E_TENANT_ID', 'E2E_AUTH_PROVIDER', 'HASURA_ADMIN_SECRET'] as const;

export type RequiredEnvKey = (typeof REQUIRED_KEYS)[number];
export type OptionalEnvKey = (typeof OPTIONAL_KEYS)[number];
export type EnvKey = RequiredEnvKey | OptionalEnvKey;

export function readEnv(key: RequiredEnvKey): string;
export function readEnv(key: OptionalEnvKey, fallback: string): string;
export function readEnv(key: OptionalEnvKey): string | undefined;
export function readEnv(key: EnvKey, fallback?: string): string | undefined {
  const value = process.env[key];
  if (value !== undefined && value !== '') return value;
  if ((REQUIRED_KEYS as readonly string[]).includes(key)) {
    throw new Error(
      `Missing required environment variable "${key}". ` +
        `Expected values in .env.test (see .env.test.example).`,
    );
  }
  return fallback;
}

export function assertRequiredEnv(): void {
  const missing = REQUIRED_KEYS.filter((k) => !process.env[k]);
  if (missing.length === 0) return;
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
      `Copy .env.test.example to .env.test and fill in values.`,
  );
}

// Which login flow the SUT is actually running — the app's own
// NEXT_PUBLIC_AUTH_PROVIDER, mirrored here so the harness knows whether
// /login renders an inline form (generic) or immediately redirects to a
// realm's hosted login page (keycloak). Not auto-detected: keeping it an
// explicit env var matches how logout.spec.ts already gates its
// Keycloak-only assertions, and avoids the suite silently testing the wrong
// flow's UI just because a redirect happened to look similar.
export function isKeycloakProvider(): boolean {
  return readEnv('E2E_AUTH_PROVIDER', 'generic') === 'keycloak';
}
