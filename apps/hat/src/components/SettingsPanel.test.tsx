import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockBridge, type MockBridge } from '../bridge/mock';
import { SettingsPanel } from './SettingsPanel';

async function setup(): Promise<MockBridge> {
  const bridge = createMockBridge();
  render(<SettingsPanel bridge={bridge} />);
  await waitFor(() => expect(screen.getByTestId('app-version')).toHaveTextContent('0.0.0-test'));
  return bridge;
}

describe('SettingsPanel', () => {
  it('carrega aparência, atalhos e versão do bridge', async () => {
    await setup();
    expect(screen.getByTestId('flash-preview')).toBeInTheDocument();
    // 4 atalhos capturáveis
    expect(screen.getAllByTestId(/^keycap-/)).toHaveLength(4);
    expect(screen.getByLabelText('Opacidade do Flash')).toHaveValue('16');
  });

  it('mudar opacidade persiste via setFlashAppearance', async () => {
    const bridge = await setup();
    fireEvent.change(screen.getByLabelText('Opacidade do Flash'), { target: { value: '50' } });
    const call = [...bridge.calls].reverse().find((c) => c.method === 'setFlashAppearance');
    expect((call?.args[0] as { opacity: number }).opacity).toBe(50);
  });

  it('desligar fundo persiste background=false', async () => {
    const bridge = await setup();
    fireEvent.click(screen.getByLabelText('Mostrar fundo'));
    const call = [...bridge.calls].reverse().find((c) => c.method === 'setFlashAppearance');
    expect((call?.args[0] as { background: boolean }).background).toBe(false);
  });

  it('verificar atualização chama checkForUpdate e mostra status', async () => {
    const bridge = await setup();
    fireEvent.click(screen.getByTestId('check-update'));
    await waitFor(() =>
      expect(bridge.calls.some((c) => c.method === 'checkForUpdate')).toBe(true),
    );
    await screen.findByText(/versão mais recente/i);
  });
});
