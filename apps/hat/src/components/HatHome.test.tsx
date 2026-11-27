import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('permite desligar e religar a proteção de captura', async () => {
    render(<HatHome bridge={bridge} />);
    await flush();
    const toggle = screen.getByRole('switch', { name: 'Esconder em capturas de tela' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await flush();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    await flush();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(bridge.calls.filter(c => c.method === 'setCaptureProtection').map(c => c.args)).toEqual([[false], [true]]);
  });

  it('carrega a preferência desligada e mantém o estado se salvar falhar', async () => {
    bridge.getCaptureProtection = async () => false;
    bridge.setCaptureProtection = async () => { throw new Error('native error'); };
    render(<HatHome bridge={bridge} />);
    await flush();
    const toggle = screen.getByRole('switch', { name: 'Esconder em capturas de tela' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    await flush();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).not.toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível alterar');
  });

  describe('área do Flash (tamanho fixo)', () => {
    async function openEditor() {
      render(<HatHome bridge={bridge} />);
      await flush();
      fireEvent.click(screen.getByTestId('flash-area-open'));
      await flush();
      const screenEl = screen.getByTestId('flash-area-screen');
      // jsdom não faz layout: a miniatura da tela tem 400x250 px.
      screenEl.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 400, height: 250, right: 400, bottom: 250, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
      return screenEl;
    }

    function lastSaved() {
      const saves = bridge.calls.filter((c) => c.method === 'setFlashArea');
      return saves[saves.length - 1]?.args[0];
    }

    it('mostra na tela principal onde a resposta aparece, em palavras', async () => {
      render(<HatHome bridge={bridge} />);
      await flush();
      const open = screen.getByTestId('flash-area-open');
      expect(open).toHaveAccessibleName(/onde a resposta aparece/i);
      expect(screen.getByText('Canto superior esquerdo · ocupa 7% da tela')).toBeInTheDocument();
    });

    it('abre o ajuste com instrução clara, a área verde e os 4 cantos', async () => {
      await openEditor();
      const dialog = screen.getByRole('dialog', { name: 'Onde a resposta aparece' });
      expect(dialog).toHaveTextContent('Arraste a área verde');
      expect(dialog).toHaveTextContent('Puxe a quina');
      expect(screen.getByTestId('flash-area')).toBeInTheDocument();
      for (const q of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
        expect(screen.getByTestId(`quadrant-${q}`)).toBeInTheDocument();
      }
      expect(screen.getByTestId('quadrant-top-left')).toHaveAttribute('aria-pressed', 'true');
    });

    it('a área verde é desenhada na proporção da tela', async () => {
      await openEditor();
      const area = screen.getByTestId('flash-area');
      expect(area.style.left).toBe('2%');
      expect(area.style.top).toBe('2%');
      expect(area.style.width).toBe('30%');
      expect(area.style.height).toBe('22%');
    });

    it('clicar num canto leva a área para lá, salva e mostra a prévia na tela', async () => {
      await openEditor();
      fireEvent.click(screen.getByTestId('quadrant-bottom-right'));
      await flush();
      expect(lastSaved()).toEqual({ x: 0.68, y: 0.76, w: 0.3, h: 0.22 });
      expect(screen.getByTestId('quadrant-bottom-right')).toHaveAttribute('aria-pressed', 'true');
      // A prévia espera as mudanças pararem (debounce curto).
      await waitFor(() => expect(bridge.calls.some((c) => c.method === 'flashPreviewArea')).toBe(true));
    });

    it('arrastar a área verde muda o lugar', async () => {
      await openEditor();
      const area = screen.getByTestId('flash-area');
      fireEvent.pointerDown(area, { clientX: 50, clientY: 50, pointerId: 1 });
      fireEvent.pointerMove(area, { clientX: 90, clientY: 75, pointerId: 1 }); // +0.1, +0.1
      fireEvent.pointerUp(area, { clientX: 90, clientY: 75, pointerId: 1 });
      await flush();
      expect(lastSaved()).toEqual({ x: 0.12, y: 0.12, w: 0.3, h: 0.22 });
      expect(within(screen.getByRole('dialog')).getByText('Canto superior esquerdo · ocupa 7% da tela')).toBeInTheDocument();
    });

    it('puxar a quina muda o tamanho', async () => {
      await openEditor();
      const handle = screen.getByTestId('flash-area-handle-se');
      fireEvent.pointerDown(handle, { clientX: 128, clientY: 60, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 168, clientY: 85, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientX: 168, clientY: 85, pointerId: 1 });
      await flush();
      expect(lastSaved()).toEqual({ x: 0.02, y: 0.02, w: 0.4, h: 0.32 });
      expect(within(screen.getByRole('dialog')).getByText('Canto superior esquerdo · ocupa 13% da tela')).toBeInTheDocument();
    });

    it('não salva nada enquanto só move o mouse sem arrastar', async () => {
      await openEditor();
      fireEvent.pointerMove(screen.getByTestId('flash-area'), { clientX: 300, clientY: 200, pointerId: 1 });
      await flush();
      expect(lastSaved()).toBeUndefined();
    });

    it('teclado: setas movem e Shift + setas mudam o tamanho', async () => {
      await openEditor();
      const area = screen.getByTestId('flash-area');
      expect(area).toHaveAccessibleName(/setas/i);
      fireEvent.keyDown(area, { key: 'ArrowRight' });
      await flush();
      expect(lastSaved()).toEqual({ x: 0.04, y: 0.02, w: 0.3, h: 0.22 });
      fireEvent.keyDown(area, { key: 'ArrowDown', shiftKey: true });
      await flush();
      expect(lastSaved()).toEqual({ x: 0.04, y: 0.02, w: 0.3, h: 0.24 });
    });

    it('"Voltar ao padrão" restaura o canto superior esquerdo pequeno', async () => {
      await openEditor();
      fireEvent.click(screen.getByTestId('quadrant-bottom-right'));
      await flush();
      fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
      await flush();
      expect(lastSaved()).toEqual({ x: 0.02, y: 0.02, w: 0.3, h: 0.22 });
    });

    it('"Pronto" e Esc fecham o ajuste', async () => {
      await openEditor();
      fireEvent.click(screen.getByRole('button', { name: 'Pronto' }));
      await flush();
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(screen.getByTestId('flash-area-open'));
      await flush();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await flush();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('carrega a área salva pelo nativo', async () => {
      bridge.getFlashArea = async () => ({ x: 0.6, y: 0.7, w: 0.3, h: 0.2 });
      render(<HatHome bridge={bridge} />);
      await flush();
      expect(screen.getByText('Canto inferior direito · ocupa 6% da tela')).toBeInTheDocument();
    });
      describe('setas seguidas com o nativo lento', () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      it('não perde passos nem volta para trás quando as respostas chegam atrasadas', async () => {
        const pending: (() => void)[] = [];
        bridge.setFlashArea = (area) => {
          bridge.calls.push({ method: 'setFlashArea', args: [area] });
          return new Promise((resolve) => pending.push(() => resolve(area)));
        };
        await openEditor();
        const area = screen.getByTestId('flash-area');
        fireEvent.keyDown(area, { key: 'ArrowRight' });
        fireEvent.keyDown(area, { key: 'ArrowRight' });
        fireEvent.keyDown(area, { key: 'ArrowRight' });
        // Resposta da 1ª seta chega por último.
        await act(async () => {
          pending[1]?.();
          pending[2]?.();
          pending[0]?.();
        });
        await flush();
        expect(lastSaved()).toEqual({ x: 0.08, y: 0.02, w: 0.3, h: 0.22 });
        expect(area.style.left).toBe('8%');
      });

      it('várias mudanças seguidas mostram a prévia na tela uma vez só', async () => {
        await openEditor();
        vi.useFakeTimers();
        const area = screen.getByTestId('flash-area');
        fireEvent.keyDown(area, { key: 'ArrowRight' });
        fireEvent.keyDown(area, { key: 'ArrowRight' });
        fireEvent.keyDown(area, { key: 'ArrowRight' });
        await act(async () => {
          await Promise.resolve();
          vi.advanceTimersByTime(1000);
          await Promise.resolve();
        });
        expect(bridge.calls.filter((c) => c.method === 'flashPreviewArea')).toHaveLength(1);
      });
    });

    it('ao fechar, o foco volta para o botão que abriu o ajuste', async () => {
      await openEditor();
      fireEvent.click(screen.getByRole('button', { name: 'Pronto' }));
      await flush();
      expect(screen.getByTestId('flash-area-open')).toHaveFocus();
    });

    it('Tab não sai do ajuste enquanto ele está aberto', async () => {
      await openEditor();
      const pronto = screen.getByRole('button', { name: 'Pronto' });
      pronto.focus();
      fireEvent.keyDown(pronto, { key: 'Tab' });
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    });
  });
});