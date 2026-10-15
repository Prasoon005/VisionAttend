'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Generic sortable table. Columns with `enableSorting: true` get a sort
 * button in their header; everything else renders as plain cells.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  caption,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  caption?: string;
}) {
  const t = useTranslations('DataTable');
  const [sorting, setSorting] = useState<SortingState>([]);
  // TanStack Table v8 returns unmemoizable functions; fine because this app
  // does not use the React Compiler (the rule only warns about compiler output).
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Opt-in per column. (A table-level `enableSorting: false` would override
    // every column's own setting, so the default is set per column instead.)
    defaultColumn: { enableSorting: false },
  });

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        {caption && <TableCaption className="sr-only">{caption}</TableCaption>}
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const label = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {label}
                        {sorted === 'asc' ? (
                          <ArrowUp aria-label={t('sortAscending')} className="size-3.5" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown aria-label={t('sortDescending')} className="size-3.5" />
                        ) : (
                          <ArrowUpDown aria-hidden className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <EmptyState icon={Inbox} title={t('empty')} />
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
