import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/empty-state';

describe('EmptyState', () => {
  it('renders the title, description and action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing here"
        description="Add something to begin."
        action={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add something to begin.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('omits the description when none is given', () => {
    const { container } = render(<EmptyState icon={Inbox} title="Only a title" />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
