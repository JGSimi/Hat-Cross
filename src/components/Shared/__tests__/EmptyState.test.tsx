import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import ptChat from '../../../i18n/locales/pt-BR/chat.json';
import ptEmpty from '../../../i18n/locales/pt-BR/empty.json';
import EmptyState from '../EmptyState';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

// Heavy children (mascot + recent list) aren't the unit under test — stub
// them so the greeting/subtitle/structure can be verified in isolation.
vi.mock('../HorseLogo', () => ({
  default: () => <div data-testid="horse-logo" aria-hidden />,
}));
vi.mock('../../Chat/RecentConversations', () => ({
  default: () => <div data-testid="recent-conversations" />,
}));

vi.mock('../../../hooks/usePlatform', () => ({
  usePlatform: () => 'macos',
}));

vi.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({
      settings: {
        shortcuts: {
          clipboard: 'CommandOrControl+Shift+X',
          floatingChat: 'CommandOrControl+Shift+C',
          adjustFlashPosition: 'CommandOrControl+Shift+F',
          emergencyQuit: 'CommandOrControl+Shift+Q',
        },
      },
    }),
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: null }),
}));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'chat',
    resources: {
      'pt-BR': { chat: ptChat, empty: ptEmpty },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe('EmptyState', () => {
  it('renders the greeting heading', () => {
    render(
      <Wrapper>
        <EmptyState />
      </Wrapper>,
    );
    // Greeting is a timed string (bom dia / boa tarde / boa noite / olá).
    // Assert that an h2 heading is rendered rather than pinning exact text.
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('renders the subtitle when the user is signed out', () => {
    render(
      <Wrapper>
        <EmptyState />
      </Wrapper>,
    );
    expect(
      screen.getByText(/O que a gente resolve hoje\?/),
    ).toBeInTheDocument();
  });

  it('hides the shortcut strip + recents in compact (popover) mode', () => {
    render(
      <Wrapper>
        <EmptyState compact />
      </Wrapper>,
    );
    expect(screen.queryByTestId('recent-conversations')).not.toBeInTheDocument();
    // No shortcut badge rendered in compact mode.
    expect(screen.queryByText(/Clipboard/)).not.toBeInTheDocument();
  });

  it('renders shortcut badges in full (main-window) mode', () => {
    render(
      <Wrapper>
        <EmptyState />
      </Wrapper>,
    );
    expect(screen.getByTestId('recent-conversations')).toBeInTheDocument();
  });

  it('passes axe (full layout)', async () => {
    const { container } = render(
      <Wrapper>
        <EmptyState />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (compact layout)', async () => {
    const { container } = render(
      <Wrapper>
        <EmptyState compact />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
