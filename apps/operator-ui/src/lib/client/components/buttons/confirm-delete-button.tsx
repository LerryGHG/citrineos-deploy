// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import { useTranslate } from '@refinedev/core';
import { Trash2 } from 'lucide-react';
import { Button } from '@lib/client/components/ui/button';
import { ConfirmDialog } from '@lib/client/components/ui/confirm';
import { buttonIconSize } from '@lib/client/styles/icon';

interface ConfirmDeleteButtonProps {
  /** Names what goes, e.g. "Delete tariff #3?". */
  title: string;
  /** Defaults to "This action cannot be undone." */
  description?: string;
  onConfirm: () => void;
}

/**
 * The Delete button for detail pages. Nothing is deleted on the first click:
 * it opens a dialog naming what will be deleted, with Cancel (focused) and a
 * second, red Delete button that actually does it.
 */
export const ConfirmDeleteButton = ({
  title,
  description,
  onConfirm,
}: ConfirmDeleteButtonProps) => {
  const translate = useTranslate();
  return (
    <ConfirmDialog
      title={title}
      description={description ?? translate('dialogs.thisActionCannotBeUndone')}
      okText={translate('buttons.delete')}
      okIcon={<Trash2 className="mr-2 h-4 w-4" />}
      okButtonVariant="destructive"
      onConfirm={onConfirm}
    >
      <Button variant="destructive" size="sm">
        <Trash2 className={buttonIconSize} />
        {translate('buttons.delete')}
      </Button>
    </ConfirmDialog>
  );
};
