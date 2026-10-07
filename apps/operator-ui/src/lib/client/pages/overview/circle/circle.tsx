// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@lib/client/components/ui/tooltip';
import { ChargerStatusEnum } from '@lib/utils/enums';
import { useChargerStatusLabel } from '@lib/client/pages/overview/charger-status-label';

export interface CircleProps {
  status?: ChargerStatusEnum;
  color?: string;
}

const circleStatusColorMap: Partial<Record<ChargerStatusEnum, string>> = {
  [ChargerStatusEnum.OFFLINE]: '#F61631',
  [ChargerStatusEnum.ONLINE]: '#00C999',
};

export const Circle = ({ status = ChargerStatusEnum.OFFLINE, color }: CircleProps) => {
  const statusLabel = useChargerStatusLabel();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="size-2 rounded-full"
            style={
              color ? { backgroundColor: color } : { backgroundColor: circleStatusColorMap[status] }
            }
          ></div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusLabel(status)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
