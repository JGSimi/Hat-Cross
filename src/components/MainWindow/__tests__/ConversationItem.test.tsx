import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ptChat from '../../../i18n/locales/pt-BR/chat.json';
import ConversationItem from '../ConversationItem';
import type { Conversation } from '../../../types';

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

vi.mock('../../../stores/toastStore', () => ({
  useToastStore: Object.assign(() => ({}), {
    getState: () => ({ showToast: vi.fn() }),
  }),
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

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    title: 'Conversa de teste',
    messages: [
      {
        id: 'm1',
        content: 'oi',
        isUser: true,
        timestamp: 0,
        source: 'chat',
      },
      {
        id: 'm2',
        content: 'resposta da IA',
        isUser: false,
        timestamp: 1,
        source: 'chat',
      },
    ],
    isPinned: false,
    createdAt: 0,
    updatedAt: 1,
    ...overrides,
  };
}

describe('ConversationItem', () => {
  it('exposes an accessible options button', () => {
    render(
      <Wrapper>
        <ConversationItem
          conversation={makeConversation()}
          isActive={false}
          onSelect={() => {}}
          onPin={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </Wrapper>,
    );
    expect(
      screen.getByRole('button', { name: 'Opções da conversa' }),
    ).toBeInTheDocument();
  });

  it('announces message count via aria-label', () => {
    render(
      <Wrapper>
        <ConversationItem
          conversation={makeConversation()}
          isActive={false}
          onSelect={() => {}}
          onPin={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </Wrapper>,
    );
    expect(screen.getByLabelText('2 mensagens')).toBeInTheDocument();
  });

  it('reveals pin / rename / delete actions when the kebab is open', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <ConversationItem
          conversation={makeConversation()}
          isActive={false}
          onSelect={() => {}}
          onPin={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </Wrapper>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Opções da conversa' }),
    );
    expect(
      screen.getByRole('button', { name: 'Fixar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Renomear' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Excluir' }),
    ).toBeInTheDocument();
  });

  it('passes axe (inactive)', async () => {
    const { container } = render(
      <Wrapper>
        <ConversationItem
          conversation={makeConversation()}
          isActive={false}
          onSelect={() => {}}
          onPin={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (active + pinned)', async () => {
    const { container } = render(
      <Wrapper>
        <ConversationItem
          conversation={makeConversation({ isPinned: true })}
          isActive={true}
          onSelect={() => {}}
          onPin={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
