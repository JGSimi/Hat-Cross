import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ptChat from '../../../i18n/locales/pt-BR/chat.json';
import ptCommon from '../../../i18n/locales/pt-BR/common.json';
import RecentConversations from '../RecentConversations';
import { useConversationStore } from '../../../stores/conversationStore';
import type { Conversation } from '../../../types';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return { ...actual, useReducedMotion: () => false };
});

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'chat',
    resources: { 'pt-BR': { chat: ptChat, common: ptCommon } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

function makeConv(
  id: string,
  title: string,
  lastContent: string,
  updatedAt: number,
): Conversation {
  return {
    id,
    title,
    messages: [
      {
        id: `${id}-m1`,
        content: 'Pergunta inicial',
        isUser: true,
        timestamp: updatedAt - 1000,
      },
      {
        id: `${id}-m2`,
        content: lastContent,
        isUser: false,
        timestamp: updatedAt,
      },
    ],
    createdAt: updatedAt - 10_000,
    updatedAt,
    pinned: false,
  };
}

describe('RecentConversations — empty-home returning user surface', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: [] });
  });

  it('renders nothing when the user has zero conversations', () => {
    const { container } = render(
      <Wrapper>
        <RecentConversations />
      </Wrapper>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows up to 3 most-recent conversations in updatedAt order', () => {
    const now = Date.now();
    useConversationStore.setState({
      conversations: [
        makeConv('a', 'Mais antiga', 'resposta a', now - 10_000),
        makeConv('b', 'Mais nova', 'resposta b', now),
        makeConv('c', 'Meio', 'resposta c', now - 5_000),
        makeConv('d', 'Quarta', 'resposta d', now - 50_000),
      ],
    });
    render(
      <Wrapper>
        <RecentConversations />
      </Wrapper>,
    );
    const titles = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(titles).toHaveLength(3);
    expect(titles[0]).toMatch(/Mais nova/);
    expect(titles[1]).toMatch(/Meio/);
    expect(titles[2]).toMatch(/Mais antiga/);
    // "Quarta" falls off — only 3 shown.
    expect(
      screen.queryByRole('button', { name: /Quarta/i }),
    ).not.toBeInTheDocument();
  });

  it('clicking a row calls setActiveConversation with its id', async () => {
    const user = userEvent.setup();
    useConversationStore.setState({
      conversations: [makeConv('xyz', 'Conversa teste', 'resposta', Date.now())],
    });
    const setActive = vi.spyOn(
      useConversationStore.getState(),
      'setActiveConversation',
    );
    render(
      <Wrapper>
        <RecentConversations />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /Conversa teste/i }));
    expect(setActive).toHaveBeenCalledWith('xyz');
  });

  it('skips the "Nova conversa criada automaticamente" system notice in the preview', () => {
    useConversationStore.setState({
      conversations: [
        {
          id: 'sn1',
          title: 'System notice convo',
          messages: [
            {
              id: 'm1',
              content: 'Pergunta real',
              isUser: true,
              timestamp: 100,
            },
            {
              id: 'm2',
              content:
                '**Nova conversa criada automaticamente** — blah blah',
              isUser: false,
              timestamp: 200,
            },
          ],
          createdAt: 0,
          updatedAt: 200,
          pinned: false,
        },
      ],
    });
    render(
      <Wrapper>
        <RecentConversations />
      </Wrapper>,
    );
    // The preview line should be the real user question, not the system notice.
    expect(screen.getByText(/Pergunta real/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Nova conversa criada automaticamente/),
    ).not.toBeInTheDocument();
  });

  it('exposes a labeled group for screen readers', () => {
    useConversationStore.setState({
      conversations: [makeConv('a', 'Teste', 'resp', Date.now())],
    });
    render(
      <Wrapper>
        <RecentConversations />
      </Wrapper>,
    );
    expect(
      screen.getByRole('group', { name: /Conversas recentes/i }),
    ).toBeInTheDocument();
  });

  it('passes axe', async () => {
    useConversationStore.setState({
      conversations: [
        makeConv('a', 'A', 'resposta a', Date.now() - 1000),
        makeConv('b', 'B', 'resposta b', Date.now()),
      ],
    });
    const { container } = render(
      <Wrapper>
        <RecentConversations />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
