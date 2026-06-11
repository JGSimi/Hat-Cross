import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomsPanel } from './RoomsPanel';
import type { RoomsClient } from '../../services/rooms/client';
import { useRoomStore } from '../../stores/roomStore';

function fakeClient(over: Partial<RoomsClient> = {}): RoomsClient {
  return {
    createRoom: vi.fn(async () => ({ roomId: 'room-novo' })),
    joinRoom: vi.fn(async (id: string) => ({ roomId: id })),
    leaveRoom: vi.fn(async () => {}),
    ...over,
  };
}

beforeEach(() => {
  useRoomStore.setState({ activeRoomId: null, rooms: {}, entries: {}, clusters: {}, notifications: [] });
});

describe('RoomsPanel — criar sala (sem window.prompt)', () => {
  it('logado: "Nova sala" abre input inline e cria via client', async () => {
    const client = fakeClient();
    render(<RoomsPanel client={client} myUid="me" authed />);

    fireEvent.click(screen.getByText('Nova sala'));
    const input = await screen.findByTestId('create-title'); // input aparece (não prompt)
    fireEvent.change(input, { target: { value: 'Prova de Cálculo' } });
    fireEvent.click(screen.getByTestId('create-confirm'));

    await waitFor(() => expect(client.createRoom).toHaveBeenCalledWith('Prova de Cálculo'));
    await waitFor(() => expect(useRoomStore.getState().activeRoomId).toBe('room-novo'));
  });

  it('deslogado (client null): "Nova sala" avisa para conectar, sem input', () => {
    render(<RoomsPanel client={null} myUid={null} authed={false} />);
    fireEvent.click(screen.getByText('Nova sala'));
    expect(screen.queryByTestId('create-title')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/conecte sua conta/i);
  });

  it('título vazio cai no nome padrão', async () => {
    const client = fakeClient();
    render(<RoomsPanel client={client} myUid="me" authed />);
    fireEvent.click(screen.getByText('Nova sala'));
    fireEvent.click(screen.getByTestId('create-confirm'));
    await waitFor(() => expect(client.createRoom).toHaveBeenCalledWith('Sala de questionário'));
  });
});
