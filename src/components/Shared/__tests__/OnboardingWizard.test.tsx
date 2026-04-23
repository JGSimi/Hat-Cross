import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ptOnboarding from '../../../i18n/locales/pt-BR/onboarding.json';
import OnboardingWizard from '../OnboardingWizard';

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

vi.mock('../HorseLogo', () => ({
  default: () => <div data-testid="horse-logo" aria-hidden />,
}));

vi.mock('../../../hooks/usePlatform', () => ({
  usePlatform: () => 'macos',
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      user: null,
      isSigningIn: false,
      signInError: null,
      signInWithGoogle: vi.fn(),
    }),
}));

vi.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        settings: {
          shortcuts: {
            clipboard: 'CommandOrControl+Shift+X',
            floatingChat: 'CommandOrControl+Shift+C',
          },
        },
      }),
    {
      getState: () => ({
        settings: {
          shortcuts: {
            clipboard: 'CommandOrControl+Shift+X',
            floatingChat: 'CommandOrControl+Shift+C',
          },
        },
      }),
    },
  ),
}));

vi.mock('../../../stores/creditsStore', () => ({
  useCreditsStore: (selector: (s: unknown) => unknown) =>
    selector({
      pricing: { brlToCredits: 700, tierBrls: [5, 10, 20, 50] },
    }),
}));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'onboarding',
    resources: { 'pt-BR': { onboarding: ptOnboarding } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe('OnboardingWizard', () => {
  it('renders the welcome step with an h1', () => {
    render(
      <Wrapper>
        <OnboardingWizard onComplete={() => {}} />
      </Wrapper>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /Bem-vindo ao Hat/ }),
    ).toBeInTheDocument();
  });

  it('exposes a Pular tutorial button on non-terminal steps', () => {
    render(
      <Wrapper>
        <OnboardingWizard onComplete={() => {}} />
      </Wrapper>,
    );
    expect(
      screen.getByRole('button', { name: 'Pular tutorial' }),
    ).toBeInTheDocument();
  });

  it('navigates forward when Próximo is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <OnboardingWizard onComplete={() => {}} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /Próximo/i }));
    // Shortcuts step h2 should be visible now
    expect(
      screen.getByRole('heading', { level: 2, name: /Três atalhos/ }),
    ).toBeInTheDocument();
  });

  it('passes axe (welcome step)', async () => {
    const { container } = render(
      <Wrapper>
        <OnboardingWizard onComplete={() => {}} />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (shortcuts step after advancing)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Wrapper>
        <OnboardingWizard onComplete={() => {}} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /Próximo/i }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
