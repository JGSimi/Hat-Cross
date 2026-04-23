import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import AttachmentPreview from '../AttachmentPreview';
import type { ChatAttachment } from '../../../types';

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

function makeAttachment(overrides: Partial<ChatAttachment> = {}): ChatAttachment {
  return {
    id: 'att-1',
    name: 'screenshot.png',
    data: 'iVBORw0KGgo=',
    content: null,
    isImage: true,
    ...overrides,
  };
}

describe('AttachmentPreview', () => {
  it('renders nothing when there are no attachments', () => {
    const { container } = render(
      <AttachmentPreview attachments={[]} onRemove={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders image attachments with alt text', () => {
    render(
      <AttachmentPreview
        attachments={[makeAttachment({ name: 'foto.png' })]}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByAltText('foto.png')).toBeInTheDocument();
  });

  it('exposes an accessible remove button per attachment', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <AttachmentPreview
        attachments={[makeAttachment({ id: 'a1', name: 'notas.png' })]}
        onRemove={onRemove}
      />,
    );
    const button = screen.getByRole('button', { name: /Remover anexo notas\.png/i });
    await user.click(button);
    expect(onRemove).toHaveBeenCalledWith('a1');
  });

  it('passes axe with a mix of image + file attachments', async () => {
    const { container } = render(
      <AttachmentPreview
        attachments={[
          makeAttachment({ id: 'img', name: 'captura.png', isImage: true }),
          makeAttachment({
            id: 'doc',
            name: 'notas.txt',
            isImage: false,
            data: null,
            content: 'conteúdo',
          }),
        ]}
        onRemove={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
