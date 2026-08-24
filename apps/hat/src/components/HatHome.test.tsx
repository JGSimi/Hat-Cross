import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockBridge, type MockBridge } from '../bridge/mock';
import { HatHome } from './HatHome';

describe('HatHome — Flash location selector', () => {
  let bridge: MockBridge;

  beforeEach(() => {
    bridge = createMockBridge();
  });

  async function flush() {
    await act(() => Promise.resolve());
    await act(() => Promise.resolve());
  }

  it('renderiza o seletor de localização do flash com 4 quadrantes', async () => {
    render(<HatHome bridge={bridge} />);
    await flush();

    const picker = screen.getByTestId('flash-location-picker');
    expect(picker).toBeInTheDocument();
    expect(picker).toHaveAttribute('role', 'radiogroup');

    expect(screen.getByTestId('quadrant-top-left')).toBeInTheDocument();
    expect(screen.getByTestId('quadrant-top-right')).toBeInTheDocument();
    expect(screen.getByTestId('quadrant-bottom-left')).toBeInTheDocument();
    expect(screen.getByTestId('quadrant-bottom-right')).toBeInTheDocument();
  });

  it('inicia com top-left selecionado por padrão', async () => {
    render(<HatHome bridge={bridge} />);
    await flush();

    const topLeft = screen.getByTestId('quadrant-top-left');
    const topRight = screen.getByTestId('quadrant-top-right');

    expect(topLeft).toHaveAttribute('aria-checked', 'true');
    expect(topRight).toHaveAttribute('aria-checked', 'false');
  });

  it('ao clicar em um quadrante, salva a posição no bridge nativo e dispara o preview', async () => {
    render(<HatHome bridge={bridge} />);
    await flush();

    const bottomRight = screen.getByTestId('quadrant-bottom-right');
    fireEvent.click(bottomRight);
    await flush();

    expect(bottomRight).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('quadrant-top-left')).toHaveAttribute('aria-checked', 'false');

    const saveCall = bridge.calls.find((c) => c.method === 'flashSavePosition');
    expect(saveCall).toBeDefined();
    expect(saveCall?.args[0]).toEqual(
      expect.objectContaining({
        quadrant: 'bottom-right',
      }),
    );

    const previewCall = bridge.calls.find((c) => c.method === 'flashShowText');
    expect(previewCall).toBeDefined();
    expect(previewCall?.args[0]).toBe('Hat Flash');
  });

  it('permite selecionar cada um dos 4 quadrantes', async () => {
    render(<HatHome bridge={bridge} />);
    await flush();

    const quadrants = ['top-right', 'bottom-left', 'bottom-right', 'top-left'] as const;

    for (const q of quadrants) {
      const btn = screen.getByTestId(`quadrant-${q}`);
      fireEvent.click(btn);
      await flush();
      expect(btn).toHaveAttribute('aria-checked', 'true');
    }
  });
});
