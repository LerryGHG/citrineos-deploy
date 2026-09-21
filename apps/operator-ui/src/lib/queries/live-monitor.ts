// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { gql } from 'graphql-tag';

// Latest meter values of sessions that are currently running. Kept as a fixed window
// (no time variable) so the query key stays stable while the widget polls.
export const LIVE_MONITOR_METER_VALUES_QUERY = gql`
  query LiveMonitorMeterValues {
    MeterValues(
      where: { Transaction: { isActive: { _eq: true } } }
      order_by: { timestamp: desc }
      limit: 600
    ) {
      id
      timestamp
      sampledValue
      transaction: Transaction {
        ocppConnectionName
      }
    }
  }
`;
