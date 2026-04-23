import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import ptChat from '../../../i18n/locales/pt-BR/chat.json';
import InputArea from '../InputArea';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return {
    ...actual,
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// ModeSelector pulls from creditsStore (firebase). Stub it — the tabstrip
// has its own coverage in ModeSelector.test.tsx.
vi.mock('../ModeSelector', () => ({
  default: () => <div data-testid="mode-selector" />,
}));

vi.mock('../../../stores/draftsStore', () => ({
  useDraftsStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        drafts: {},
        getDraft: () => undefined,
        setDraft: () => {},
        clearDraft: () => {},
      }),
    {
      getState: () => ({
        drafts: {},
        getDraft: () => undefined,
        setDraft: () => {},
        clearDraft: () => {},
      }),
    },
  ),
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { uid: 'u1', displayName: 'Jo' } }),
}));

vi.mock('../../../stores/creditsStore', () => ({
  useCreditsStore: (selector: (s: unknown) => unknown) =>
    selector({ selectedMode: 'hat' }),
}));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'chat',
    resources: { 'pt-BR': { chat: ptChat } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe('InputArea', () => {
  it('exposes a labeled textarea', () => {
    render(
      <Wrapper>
        <InputArea
          onSend={() => {}}
          onCancel={() => {}}
          isStreaming={false}
          attachments={[]}
          onRemoveAttachment={() => {}}
          conversationId={null}
        />
      </Wrapper>,
    );
    const textarea = screen.getByRole('textbox', { name: 'Mensagem' });
    expect(textarea).toBeInTheDocument();
  });

  it('shows the Enviar button when idle', () => {
    render(
      <Wrapper>
        <InputArea
          onSend={() => {}}
          onCancel={() => {}}
          isStreaming={false}
          attachments={[]}
          onRemoveAttachment={() => {}}
          conversationId={null}
        />
      </Wrapper>,
    );
    expect(
      screen.getByRole('button', { name: 'Enviar' }),
    ).toBeInTheDocument();
  });

  it('shows the Parar button while streaming', () => {
    render(
      <Wrapper>
        <InputArea
          onSend={() => {}}
          onCancel={() => {}}
          isStreaming={true}
          attachments={[]}
          onRemoveAttachment={() => {}}
          conversationId={null}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: 'Parar' })).toBeInTheDocument();
  });

  it('passes axe (idle state, signed-in)', async () => {
    const { container } = render(
      <Wrapper>
        <InputArea
          onSend={() => {}}
          onCancel={() => {}}
          isStreaming={false}
          attachments={[]}
          onRemoveAttachment={() => {}}
          conversationId={'conv-1'}
        />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (streaming state)', async () => {
    const { container } = render(
      <Wrapper>
        <InputArea
          onSend={() => {}}
          onCancel={() => {}}
          isStreaming={true}
          attachments={[]}
          onRemoveAttachment={() => {}}
          conversationId={'conv-1'}
        />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
