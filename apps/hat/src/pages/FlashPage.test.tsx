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

  describe('tamanho fixo (área escolhida pelo usuário)', () => {
    const sizes: Record<string, { scrollHeight: number; clientHeight: number }> = {};
    let restore: (() => void) | null = null;

    beforeEach(() => {
      const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
      const ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get(this: HTMLElement) {
          return sizes[this.dataset['testid'] ?? '']?.scrollHeight ?? 0;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get(this: HTMLElement) {
          return sizes[this.dataset['testid'] ?? '']?.clientHeight ?? 0;
        },
      });
      restore = () => {
        if (sh) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', sh);
        if (ch) Object.defineProperty(HTMLElement.prototype, 'clientHeight', ch);
      };
    });

    afterEach(() => {
      restore?.();
      for (const k of Object.keys(sizes)) delete sizes[k];
    });

    function finish(text: string) {
      act(() => {
        bridge.emit('flash:show', { state: 'processing', text: '', position: POS });
        bridge.emit('stream:chunk', { streamId: 1, text, isFinished: true, contentType: 'text' });
      });
    }

    it('o card nunca passa do tamanho da janela (a área)', () => {
      render(<FlashPage bridge={bridge} />);
      finish('oi');
      const card = screen.getByTestId('flash-card');
      expect(card.style.maxHeight).toBe('100%');
      expect(card.style.maxWidth).toBe('100%');
      expect(card.style.overflow).toBe('hidden');
    });

    it('não pede mais para o nativo esticar a janela', () => {
      render(<FlashPage bridge={bridge} />);
      finish('x'.repeat(900));
      expect(bridge.calls.some((c) => c.method === 'flashResize')).toBe(false);
    });

    it('resposta que cabe não rola', () => {
      sizes['flash-content'] = { scrollHeight: 80, clientHeight: 80 };
      sizes['flash-card'] = { scrollHeight: 80, clientHeight: 120 };
      render(<FlashPage bridge={bridge} />);
      finish('B) Paris');
      expect(screen.getByTestId('flash-content').style.transform).toBe('');
    });

    it('resposta maior que a área rola sozinha até o fim e só depois some', () => {
      sizes['flash-content'] = { scrollHeight: 420, clientHeight: 420 };
      sizes['flash-card'] = { scrollHeight: 420, clientHeight: 200 };
      render(<FlashPage bridge={bridge} />);
      finish('x'.repeat(900));
      const content = screen.getByTestId('flash-content');
      // 220 px de sobra → 1,5 s de espera + 10 s rolando + 2 s parado no fim.
      expect(content.style.transform).toBe('translateY(-220px)');
      expect(content.style.transition).toBe('transform 10000ms linear 1500ms');
      act(() => {
        vi.advanceTimersByTime(6500); // tempo normal: ainda NÃO some
      });
      expect(screen.getByTestId('flash-card')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(13500 - 6500);
      });
      expect(screen.queryByTestId('flash-card')).toBeNull();
    });

    it('gruda a resposta no canto da área mais perto da borda', () => {
      render(<FlashPage bridge={bridge} />);
      act(() => {
        bridge.emit('flash:show', {
          state: 'answer',
          text: 'oi',
          position: POS,
          area: { x: 0.68, y: 0.76, w: 0.3, h: 0.22 },
        });
      });
      const wrapper = screen.getByRole('status');
      expect(wrapper.style.justifyContent).toBe('flex-end');
      expect(wrapper.style.alignItems).toBe('flex-end');
    });

    it('prévia mostra o contorno da área e some sozinha', () => {
      render(<FlashPage bridge={bridge} />);
      act(() => {
        bridge.emit('flash:show', { state: 'preview', text: '', position: POS });
      });
      expect(screen.getByTestId('flash-area-preview')).toHaveTextContent('O Hat responde aqui');
      expect(screen.queryByTestId('flash-card')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(2600);
      });
      expect(screen.queryByTestId('flash-area-preview')).toBeNull();
      expect(bridge.calls.some((c) => c.method === 'flashHide')).toBe(true);
      expect(bridge.calls.some((c) => c.method === 'writeClipboard')).toBe(false);
    });
  });
});
