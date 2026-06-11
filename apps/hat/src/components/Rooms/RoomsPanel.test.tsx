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
  it('logado: "Nova sala" abre tela dedicada, cria, mostra código e entra', async () => {
    const client = fakeClient();
    render(<RoomsPanel client={client} myUid="me" authed />);

    fireEvent.click(screen.getByText('Nova sala'));
    const input = await screen.findByTestId('create-title'); // tela dedicada (não prompt)
    fireEvent.change(input, { target: { value: 'Prova de Cálculo' } });
    fireEvent.click(screen.getByTestId('create-confirm'));

    // Passo 2: mostra o código compartilhável
    await waitFor(() => expect(client.createRoom).toHaveBeenCalledWith('Prova de Cálculo'));
    const codeBtn = await screen.findByTestId('room-code');
    expect(codeBtn).toHaveTextContent('room-novo');

    // Entrar na sala → vira sala ativa
    fireEvent.click(screen.getByText(/Entrar na sala/i));
    await waitFor(() => expect(useRoomStore.getState().activeRoomId).toBe('room-novo'));
  });

  it('deslogado (client null): "Nova sala" avisa para conectar, sem tela de criação', () => {
    render(<RoomsPanel client={null} myUid={null} authed={false} />);
    fireEvent.click(screen.getByText('Nova sala'));
    expect(screen.queryByTestId('create-title')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/conecte sua conta/i);
  });

  it('título vazio cai no nome padrão', async () => {
    const client = fakeClient();
    render(<RoomsPanel client={client} myUid="me" authed />);
    fireEvent.click(screen.getByText('Nova sala'));
    await screen.findByTestId('create-title');
    fireEvent.click(screen.getByTestId('create-confirm'));
    await waitFor(() => expect(client.createRoom).toHaveBeenCalledWith('Sala de questionário'));
  });

  it('sair da sala pede confirmação e chama leaveRoom', async () => {
    const client = fakeClient();
    useRoomStore.setState({
      activeRoomId: 'r1',
      rooms: {
        r1: {
          id: 'r1',
          title: 'Sala X',
          ownerUid: 'me',
          status: 'open',
          joinCost: 0,
          createdAt: 1,
          updatedAt: 1,
          memberCount: 2,
        },
      },
      entries: {},
      clusters: {},
      notifications: [],
    });
    render(<RoomsPanel client={client} myUid="me" authed />);

    fireEvent.click(screen.getByTestId('leave-room'));
    fireEvent.click(await screen.findByTestId('leave-confirm'));
    await waitFor(() => expect(client.leaveRoom).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(useRoomStore.getState().activeRoomId).toBeNull());
  });
});
