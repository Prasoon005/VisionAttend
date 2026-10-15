import type { ColumnDef } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { DataTable } from '@/components/data-table';
import en from '@/messages/en.json';

interface Row {
  name: string;
  score: number;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  { accessorKey: 'score', header: 'Score' },
];

function renderTable(data: Row[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DataTable columns={columns} data={data} caption="People" />
    </NextIntlClientProvider>,
  );
}

const firstColumn = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

describe('DataTable', () => {
  it('renders a row per item', () => {
    renderTable([
      { name: 'Asha', score: 3 },
      { name: 'Ravi', score: 5 },
    ]);
    expect(firstColumn()).toEqual(['Asha', 'Ravi']);
  });

  it('shows the empty state when there are no rows', () => {
    renderTable([]);
    expect(screen.getByText(en.DataTable.empty)).toBeInTheDocument();
  });

  it('sorts only columns that opt in, toggling ascending then descending', async () => {
    const user = userEvent.setup();
    renderTable([
      { name: 'Ravi', score: 5 },
      { name: 'Asha', score: 3 },
      { name: 'Meera', score: 4 },
    ]);
    expect(screen.queryByRole('button', { name: /score/i })).not.toBeInTheDocument();

    const sortByName = screen.getByRole('button', { name: /name/i });
    await user.click(sortByName);
    expect(firstColumn()).toEqual(['Asha', 'Meera', 'Ravi']);
    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(sortByName);
    expect(firstColumn()).toEqual(['Ravi', 'Meera', 'Asha']);
  });
});
