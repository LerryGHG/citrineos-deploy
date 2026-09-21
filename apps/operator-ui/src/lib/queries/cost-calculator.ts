// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { gql } from 'graphql-tag';

export const COST_CALCULATOR_TRANSACTIONS_QUERY = gql`
  query CostCalculatorTransactions($where: Transactions_bool_exp) {
    Transactions(where: $where, order_by: { startTime: desc }) {
      id
      transactionId
      ocppConnectionName
      totalKwh
      startTime
      endTime
      isActive
      authorization: Authorization {
        id
        idToken
      }
    }
  }
`;
