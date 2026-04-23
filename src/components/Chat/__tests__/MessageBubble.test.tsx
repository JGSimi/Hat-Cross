import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import MessageBubble from '../MessageBubble';
import type { Message } from '../../../types';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    content: 'oi',
    isUser: true,
    timestamp: 0,
    source: 'chat',
    ...overrides,
  };
}

describe('MessageBubble', () => {
  it('renders a Copiar button with an accessible name', () => {
    render(
      <MessageBubble
        message={makeMessage({ content: 'uma resposta', isUser: false })}
        isGrouped={false}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Copiar mensagem' }),
    ).toBeInTheDocument();
  });

  it('passes axe (user bubble)', async () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ content: 'pergunta do usuário' })}
        isGrouped={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (assistant bubble without thinking)', async () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({
          id: 'a1',
          content: 'uma resposta da IA',
          isUser: false,
        })}
        isGrouped={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (assistant bubble with thinking)', async () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({
          id: 'a2',
          content: 'resposta final',
          isUser: false,
          thinking: 'raciocínio do modelo',
        })}
        isGrouped={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
