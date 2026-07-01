import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Farewell } from './Farewell';

describe('Farewell', () => {
  it('despede com o nome e deixa claro que o acesso pausou', () => {
    render(<Farewell name="João" onResubscribe={vi.fn()} />);
    expect(screen.getByTestId('farewell')).toHaveTextContent('Foi bom ter você, João.');
    expect(screen.getByTestId('farewell')).toHaveTextContent(/ficaram em pausa/);
  });

  it('sem nome, a despedida segue inteira', () => {
    render(<Farewell name={null} onResubscribe={vi.fn()} />);
    expect(screen.getByTestId('farewell')).toHaveTextContent('Foi bom ter você.');
  });

  it('CTA reabre o checkout', () => {
    const onResubscribe = vi.fn();
    render(<Farewell name="João" onResubscribe={onResubscribe} />);
    fireEvent.click(screen.getByTestId('farewell-resubscribe'));
    expect(onResubscribe).toHaveBeenCalledOnce();
  });
});
