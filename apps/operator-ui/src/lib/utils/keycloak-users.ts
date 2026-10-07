// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

// Shared by the server actions in lib/server/actions/users and the Users page
// ('use server' files may only export async functions).

export interface KeycloakUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  enabled: boolean;
}

export interface UsersAndPasswordPolicy {
  users: KeycloakUser[];
  /** Keycloak's policy string, e.g. "length(8) and notUsername and notEmail". */
  passwordPolicy: string;
}

/** Keycloak refused the admin API call: the role setup in RUNBOOK.md is missing. */
export const KEYCLOAK_FORBIDDEN = 'KEYCLOAK_FORBIDDEN';
