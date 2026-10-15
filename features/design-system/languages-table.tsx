'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { LOCALE_META, LOCALES, type Direction, type Locale } from '@/i18n/locales';

interface LanguageRow {
  code: Locale;
  nativeName: string;
  englishName: string;
  dir: Direction;
}

/** Shows the DataTable with real data: the locales this build ships with. */
export function LanguagesTable() {
  const t = useTranslations('DesignSystem');

  const columns = useMemo<ColumnDef<LanguageRow>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('columnCode'),
        enableSorting: true,
        cell: ({ getValue }) => <code className="font-mono text-xs">{getValue<string>()}</code>,
      },
      {
        accessorKey: 'nativeName',
        header: t('columnNative'),
        cell: ({ row }) => <span lang={row.original.code}>{row.original.nativeName}</span>,
      },
      { accessorKey: 'englishName', header: t('columnEnglish'), enableSorting: true },
      {
        accessorKey: 'dir',
        header: t('columnDirection'),
        cell: ({ getValue }) => (
          <Badge variant="secondary">
            {getValue<Direction>() === 'rtl' ? t('directionRtl') : t('directionLtr')}
          </Badge>
        ),
      },
    ],
    [t],
  );

  const data = useMemo(() => LOCALES.map((code) => ({ code, ...LOCALE_META[code] })), []);

  return <DataTable columns={columns} data={data} caption={t('languagesCaption')} />;
}
