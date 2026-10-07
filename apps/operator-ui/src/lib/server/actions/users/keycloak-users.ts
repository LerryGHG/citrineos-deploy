// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use server';

import config from '@lib/utils/config';
import { authedActionWithRole, type ActionResult } from '@lib/utils/action-guard';
import {
  KEYCLOAK_FORBIDDEN,
  type KeycloakUser,
  type UsersAndPasswordPolicy,
} from '@lib/utils/keycloak-users';

const keycloakServerUrl = config.keycloakServerUrl || config.keycloakUrl;

// Keycloak user ids are UUIDs; anything else never reaches the URL.
const USER_ID_REGEX = /^[0-9a-f-]{36}$/i;

/**
 * Calls Keycloak's admin REST API with the signed-in admin's own access token,
 * so Keycloak checks the permission as well as this server: the citrineos-ui
 * `admin` role includes realm-management's view-users, manage-users and
 * view-realm (see apps/ocpp-server/keycloak/citrineos-realm.json).
 */
async function keycloakAdmin(accessToken: string, path: string, init?: RequestInit) {
  const url = `${keycloakServerUrl}/admin/realms/${config.keycloakRealm}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (response.status === 403) {
    throw new Error(KEYCLOAK_FORBIDDEN);
  }
  return response;
}

export async function getUsersAndPasswordPolicy(): Promise<ActionResult<UsersAndPasswordPolicy>> {
  return authedActionWithRole('admin', async (session) => {
    const [usersResponse, realmResponse] = await Promise.all([
      keycloakAdmin(session.accessToken, '/users?briefRepresentation=true&max=500'),
      keycloakAdmin(session.accessToken, ''),
    ]);
    if (!usersResponse.ok || !realmResponse.ok) {
      console.error('Keycloak admin API error:', usersResponse.status, realmResponse.status);
      throw new Error(`Keycloak returned ${usersResponse.status} / ${realmResponse.status}`);
    }

    // Only the fields the page shows leave the server.
    const keycloakUsers: KeycloakUser[] = await usersResponse.json();
    const users = keycloakUsers.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      enabled: user.enabled,
    }));
    const realm = await realmResponse.json();
    return { users, passwordPolicy: realm.passwordPolicy ?? '' };
  });
}

/**
 * Keycloak checks the realm's password policy again here; if it refuses, the
 * thrown message is its own explanation (e.g. "Invalid password: minimum
 * length 8.") and the password is unchanged.
 */
export async function setUserPassword(
  userId: string,
  password: string,
): Promise<ActionResult<null>> {
  return authedActionWithRole('admin', async (session) => {
    if (!USER_ID_REGEX.test(userId)) {
      throw new Error('Invalid user id');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password is required');
    }

    const response = await keycloakAdmin(session.accessToken, `/users/${userId}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ type: 'password', value: password, temporary: false }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error_description || body.error || `Keycloak returned ${response.status}`,
      );
    }
    return null;
  });
}
