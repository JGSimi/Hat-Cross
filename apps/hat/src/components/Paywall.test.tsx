import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Paywall } from './Paywall';

describe('Paywall', () => {
  it('exibe o preco atual de R$50 por mes', () => {
    render(<Paywall trialEndsAt={null} onSubscribe={vi.fn()} />);

    expect(screen.getByTestId('paywall')).toHaveTextContent('R$50');
    expect(screen.getByTestId('paywall')).not.toHaveTextContent('R$30');
  });
});
