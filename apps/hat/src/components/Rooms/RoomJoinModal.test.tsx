import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoomJoinModal } from './RoomJoinModal';
import type { Room } from '../../domain/rooms/types';

const room: Room = {
  id: 'r1',
  title: 'Prova de Cálculo',
  ownerUid: 'u-owner',
  status: 'open',
  joinCost: 800,
  createdAt: 1,
  updatedAt: 2,
  memberCount: 3,
};

function setup(credits: number | null, extra: Partial<Parameters<typeof RoomJoinModal>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <RoomJoinModal
      room={room}
      credits={credits}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...extra}
    />,
  );
  return { onConfirm, onCancel };
}

describe('RoomJoinModal', () => {
  it('mostra custo de 800, saldo atual e saldo após entrar', () => {
    setup(2400);
    expect(screen.getByTestId('join-cost')).toHaveTextContent('800');
    expect(screen.getByTestId('join-balance')).toHaveTextContent('2400 cr');
    expect(screen.getByTestId('join-balance-after')).toHaveTextContent('1600 cr');
  });

  it('saldo desconhecido mostra travessão e não bloqueia', () => {
    setup(null);
    expect(screen.getByTestId('join-balance')).toHaveTextContent('—');
    expect(screen.queryByTestId('join-insufficient')).toBeNull();
  });

  it('exige consentimento de privacidade antes de habilitar o botão', () => {
    const { onConfirm } = setup(2400);
    const confirm = screen.getByTestId('join-confirm');
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByTestId('join-consent'));
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('saldo insuficiente desabilita mesmo com consentimento', () => {
    setup(799);
    fireEvent.click(screen.getByTestId('join-consent'));
    expect(screen.getByTestId('join-confirm')).toBeDisabled();
    expect(screen.getByTestId('join-insufficient')).toBeInTheDocument();
  });

  it('estado busy desabilita e mostra progresso', () => {
    setup(2400, { busy: true });
    expect(screen.getByTestId('join-confirm')).toBeDisabled();
    expect(screen.getByTestId('join-confirm')).toHaveTextContent('Entrando…');
  });

  it('erro aparece como alerta', () => {
    setup(2400, { error: 'Créditos insuficientes.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Créditos insuficientes.');
  });

  it('cancelar chama onCancel', () => {
    const { onCancel } = setup(2400);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
