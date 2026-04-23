import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import MessageList from '../MessageList';
import type { Message } from '../../../types';

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

// MessageBubble + ThinkingBlock are covered elsewhere; stub them so the list
// unit can be asserted in isolation (logging region + streaming placeholder).
vi.mock('../MessageBubble', () => ({
  default: ({ message }: { message: Message }) => (
    <div data-testid={`bubble-${message.id}`}>{message.content}</div>
  ),
}));
vi.mock('../ThinkingBlock', () => ({
  default: () => <div data-testid="thinking" />,
}));

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

describe('MessageList', () => {
  it('exposes role=log with aria-live=polite for streaming announcements', () => {
    render(
      <MessageList
        messages={[]}
        streamingContent=""
        streamingThinking=""
        isStreaming={false}
      />,
    );
    const log = screen.getByRole('log', { name: 'Conversa com o Hat' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-relevant', 'additions');
    expect(log).toHaveAttribute('aria-atomic', 'false');
    expect(log).toHaveAttribute('aria-busy', 'false');
  });

  it('toggles aria-busy when streaming', () => {
    render(
      <MessageList
        messages={[makeMessage()]}
        streamingContent=""
        streamingThinking=""
        isStreaming={true}
      />,
    );
    expect(screen.getByRole('log')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the typing indicator with role=status when streaming without tokens yet', () => {
    render(
      <MessageList
        messages={[makeMessage()]}
        streamingContent=""
        streamingThinking=""
        isStreaming={true}
      />,
    );
    expect(
      screen.getByRole('status', { name: /Hat está pensando/i }),
    ).toBeInTheDocument();
  });

  it('passes axe (empty list)', async () => {
    const { container } = render(
      <MessageList
        messages={[]}
        streamingContent=""
        streamingThinking=""
        isStreaming={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (with messages + streaming placeholder)', async () => {
    const { container } = render(
      <MessageList
        messages={[
          makeMessage({ id: 'u1', content: 'olá', isUser: true }),
          makeMessage({
            id: 'a1',
            content: 'oi, tudo bem?',
            isUser: false,
            timestamp: 10,
          }),
        ]}
        streamingContent=""
        streamingThinking=""
        isStreaming={true}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (with system notice)', async () => {
    const { container } = render(
      <MessageList
        messages={[
          makeMessage({
            id: 'sys',
            content: '**Nova conversa criada automaticamente** — contexto',
            isUser: false,
          }),
        ]}
        streamingContent=""
        streamingThinking=""
        isStreaming={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
