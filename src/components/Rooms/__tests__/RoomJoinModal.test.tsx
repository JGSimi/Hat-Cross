import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import ptRooms from '../../../i18n/locales/pt-BR/rooms.json';
import RoomJoinModal from '../RoomJoinModal';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'rooms',
    resources: { 'pt-BR': { rooms: ptRooms } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

function renderModal(credits: number) {
  return render(
    <I18nextProvider i18n={i18n}>
      <RoomJoinModal
        open
        credits={credits}
        busy={false}
        onClose={() => {}}
        onCreate={() => {}}
        onJoin={() => {}}
      />
    </I18nextProvider>,
  );
}

describe('RoomJoinModal', () => {
  it('shows 800 credit cost', () => {
    renderModal(1000);
    expect(screen.getByText('Custa 800 creditos por usuario.')).toBeInTheDocument();
  });

  it('disables paid actions when balance is below 800', () => {
    renderModal(100);
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    expect(screen.getByText('Saldo menor que 800 creditos.')).toBeInTheDocument();
  });
});
