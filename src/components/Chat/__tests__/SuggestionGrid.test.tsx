import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ptChat from '../../../i18n/locales/pt-BR/chat.json';
import SuggestionGrid from '../SuggestionGrid';
import { useChatStore } from '../../../stores/chatStore';

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

beforeEach(() => {
  useChatStore.setState({ pendingInput: null });
});

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return { ...actual, useReducedMotion: () => false };
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe('SuggestionGrid — empty-chat starter shortcuts', () => {
  it('renders exactly 4 starter suggestions in pt-BR', () => {
    render(
      <Wrapper>
        <SuggestionGrid />
      </Wrapper>,
    );
    expect(screen.getByText('Resumir texto')).toBeInTheDocument();
    expect(screen.getByText('Explicar código')).toBeInTheDocument();
    expect(screen.getByText('Debugar erro')).toBeInTheDocument();
    expect(screen.getByText('Revisar escrita')).toBeInTheDocument();
  });

  it('exposes a labeled group containing 4 suggestion buttons', () => {
    render(
      <Wrapper>
        <SuggestionGrid />
      </Wrapper>,
    );
    const group = screen.getByRole('group', { name: 'Atalhos de partida' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('clicking a suggestion writes its prompt to chatStore.pendingInput', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SuggestionGrid />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /resumir texto/i }));
    const pending = useChatStore.getState().pendingInput;
    expect(pending).not.toBeNull();
    expect(pending).toMatch(/^Resuma isto em até 3 bullets/);
    expect(pending).toMatch(/:\n\n$/);
  });

  it('debug prompt asks for cause + fix, not just the error text back', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SuggestionGrid />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /debugar erro/i }));
    const pending = useChatStore.getState().pendingInput ?? '';
    expect(pending).toMatch(/causa mais provável/);
    expect(pending).toMatch(/como conserto/);
  });

  it('passes axe', async () => {
    const { container } = render(
      <Wrapper>
        <SuggestionGrid />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
