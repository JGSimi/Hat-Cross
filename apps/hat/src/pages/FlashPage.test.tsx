import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBridge, type MockBridge } from '../bridge/mock';
import { FlashPage } from './FlashPage';

const POS = { x: 24, y: 24 };

describe('FlashPage', () => {
  let bridge: MockBridge;

  beforeEach(() => {
    bridge = createMockBridge();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não renderiza nada até receber flash:show', () => {
    render(<FlashPage bridge={bridge} />);
    expect(screen.queryByTestId('flash-card')).toBeNull();
  });

  it('mostra "Processando…" no estado processing sem texto', () => {
    render(<FlashPage bridge={bridge} />);
    act(() => {
      bridge.emit('flash:show', { state: 'processing', text: '', position: POS });
    });
    expect(screen.getByTestId('flash-card')).toHaveTextContent('Processando');
  });

  it('acumula chunks de texto e ignora os de thinking', () => {
    render(<FlashPage bridge={bridge} />);
    act(() => {
      bridge.emit('flash:show', { state: 'processing', text: '', position: POS });
      bridge.emit('stream:chunk', {
        streamId: 1,
        text: 'pensando',
        isFinished: false,
        contentType: 'thinking',
      });
      bridge.emit('stream:chunk', {
        streamId: 1,
        text: 'Resposta ',
        isFinished: false,
        contentType: 'text',
      });
      bridge.emit('stream:chunk', {
        streamId: 1,
        text: 'final',
        isFinished: false,
        contentType: 'text',
      });
    });
    const card = screen.getByTestId('flash-card');
    expect(card).toHaveTextContent('Resposta final');
    expect(card).not.toHaveTextContent('pensando');
  });

  it('ao finalizar, auto-esconde após o hold e chama flashHide', () => {
    render(<FlashPage bridge={bridge} />);
    act(() => {
      bridge.emit('flash:show', { state: 'processing', text: '', position: POS });
      bridge.emit('stream:chunk', {
        streamId: 1,
        text: 'ok',
        isFinished: true,
        contentType: 'text',
      });
    });
    // 'ok' = 2 chars → holdMs mínimo (1800). Antes disso segue visível.
    expect(screen.getByTestId('flash-card')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(screen.queryByTestId('flash-card')).toBeNull();
    expect(bridge.calls.some((c) => c.method === 'flashHide')).toBe(true);
  });

  it('ao terminar, escreve a resposta no clipboard (uma vez)', () => {
    render(<FlashPage bridge={bridge} />);
    act(() => {
      bridge.emit('flash:show', { state: 'processing', text: '', position: POS });
      bridge.emit('stream:chunk', { streamId: 1, text: 'B) Paris', isFinished: true, contentType: 'text' });
    });
    const writes = bridge.calls.filter((c) => c.method === 'writeClipboard');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.args[0]).toBe('B) Paris');
  });

  it('erro não vai para o clipboard', () => {
    render(<FlashPage bridge={bridge} />);
    act(() => {
      bridge.emit('flash:show', { state: 'processing', text: '', position: POS });
      bridge.emit('stream:chunk', {
        streamId: 1,
        text: 'error:serverError:500:x',
        isFinished: true,
        contentType: 'text',
      });
    });
    expect(bridge.calls.some((c) => c.method === 'writeClipboard')).toBe(false);
  });

  it('erro do proxy vira mensagem limpa, sem JSON cru', () => {
    render(<FlashPage bridge={bridge} />);
    act(() => {
      bridge.emit('flash:show', { state: 'processing', text: '', position: POS });
      bridge.emit('stream:chunk', {
        streamId: 1,
        text: 'error:serverError:500:Gemini 429: {"error":{"code":429}}',
        isFinished: true,
        contentType: 'text',
      });
    });
    const card = screen.getByTestId('flash-card');
    expect(card).toHaveTextContent(/indisponível/i);
    expect(card.textContent).not.toContain('{');
    expect(card.textContent).not.toContain('429');
  });

  it('flash:hide some imediatamente', () => {
    render(<FlashPage bridge={bridge} />);
    act(() => {
      bridge.emit('flash:show', { state: 'answer', text: 'oi', position: POS });
    });
    expect(screen.getByTestId('flash-card')).toBeInTheDocument();
    act(() => {
      bridge.emit('flash:hide', undefined);
    });
    expect(screen.queryByTestId('flash-card')).toBeNull();
  });
});
