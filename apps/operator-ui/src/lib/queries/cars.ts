// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { gql } from 'graphql-tag';

export const CARD_LABELS_QUERY = gql`
  query CardLabels {
    CardLabels {
      idToken
      name
      car
      notes
    }
  }
`;

export const CARS_OVERVIEW_QUERY = gql`
  query CarsOverview {
    Authorizations(order_by: { idToken: asc }) {
      id
      idToken
      status
    }
    CardLabels {
      idToken
      name
      car
      notes
    }
  }
`;

export const CARD_LABEL_UPSERT_MUTATION = gql`
  mutation CardLabelUpsert($object: CardLabels_insert_input!) {
    insert_CardLabels_one(
      object: $object
      on_conflict: {
        constraint: CardLabels_pkey
        update_columns: [name, car, notes, updatedAt]
      }
    ) {
      idToken
      name
      car
      notes
    }
  }
`;
