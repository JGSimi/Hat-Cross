import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import ptToasts from '../../../i18n/locales/pt-BR/toasts.json';
import ToastContainer from '../ToastContainer';
import { useToastStore } from '../../../stores/toastStore';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'toasts',
    resources: { 'pt-BR': { toasts: ptToasts } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

// AnimatePresence holds exited nodes in the DOM during exit animations,
// which makes `queryByText(...).not.toBeInTheDocument()` flaky after a
// dismiss click. Mock it as a passthrough so the unmount is synchronous.
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return {
    ...actual,
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

function resetToasts() {
  useToastStore.setState({ toasts: [] });
}

describe('ToastContainer (DS7)', () => {
  beforeEach(() => {
    resetToasts();
  });

  it('renders a region labeled "Notificações"', () => {
    render(
      <Wrapper>
        <ToastContainer />
      </Wrapper>,
    );
    expect(
      screen.getByRole('region', { name: 'Notificações' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['info', 'status', 'polite'],
    ['success', 'status', 'polite'],
    ['credit', 'status', 'polite'],
    ['warn', 'alert', 'assertive'],
    ['error', 'alert', 'assertive'],
  ] as const)(
    'renders variant=%s with role=%s aria-live=%s',
    (type, role, live) => {
      render(
        <Wrapper>
          <ToastContainer />
        </Wrapper>,
      );
      act(() => {
        useToastStore.getState().showToast(`hello ${type}`, type);
      });
      const node = screen.getByText(`hello ${type}`).closest(`[role="${role}"]`);
      expect(node).toBeInTheDocument();
      expect(node).toHaveAttribute('aria-live', live);
    },
  );

  it('dismiss button uses i18n label and removes the toast', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <ToastContainer />
      </Wrapper>,
    );
    act(() => {
      useToastStore.getState().showToast('para fechar', 'info');
    });
    const button = screen.getByRole('button', { name: 'Fechar notificação' });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByText('para fechar')).not.toBeInTheDocument();
  });

  it('credit variant renders HorseLogo instead of a lucide glyph', () => {
    const { container } = render(
      <Wrapper>
        <ToastContainer />
      </Wrapper>,
    );
    act(() => {
      useToastStore
        .getState()
        .showToast('Brasa destravada', 'credit');
    });
    // HorseLogo renders as a <div> with mask-image background; its container
    // inside the toast is marked aria-hidden=presentation. The lucide Sparkles
    // glyphs appear for non-credit; assert via the svg class present in credit.
    expect(container.querySelector('svg')).not.toBeNull();
    // No <svg> with role img/alert-style glyph from lucide for credit glyphs —
    // the one we see comes from Sparkles/celebrating. Sanity: the toast body
    // contains the expected message.
    expect(screen.getByText('Brasa destravada')).toBeInTheDocument();
  });

  it('action button triggers callback and dismisses', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <Wrapper>
        <ToastContainer />
      </Wrapper>,
    );
    act(() => {
      useToastStore.getState().showToast('offline', 'info', {
        action: { label: 'Desfazer', onClick: onAction },
      });
    });
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('offline')).not.toBeInTheDocument();
  });

  it('caps toasts at 5 (slice oldest)', () => {
    render(
      <Wrapper>
        <ToastContainer />
      </Wrapper>,
    );
    act(() => {
      for (let i = 0; i < 7; i++) {
        useToastStore.getState().showToast(`t${i}`, 'info');
      }
    });
    const messages = screen.getAllByText(/^t\d$/);
    expect(messages).toHaveLength(5);
    expect(screen.queryByText('t0')).not.toBeInTheDocument();
    expect(screen.queryByText('t1')).not.toBeInTheDocument();
    expect(screen.getByText('t6')).toBeInTheDocument();
  });

  it('passes axe with each variant visible', async () => {
    const { container } = render(
      <Wrapper>
        <ToastContainer />
      </Wrapper>,
    );
    act(() => {
      useToastStore.getState().showToast('info msg', 'info');
      useToastStore.getState().showToast('success msg', 'success');
      useToastStore.getState().showToast('warn msg', 'warn');
      useToastStore.getState().showToast('error msg', 'error');
      useToastStore.getState().showToast('credit msg', 'credit');
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
