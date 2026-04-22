import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ptSettings from '../../../i18n/locales/pt-BR/settings.json';
import SettingsPanel from '../SettingsPanel';

// Heavyweight card children aren't the unit under test — stub them so the
// tabstrip can be verified in isolation.
vi.mock('../AccountHeader', () => ({
  default: () => <div data-testid="account-header" />,
}));
vi.mock('../cards/GeneralCard', () => ({
  default: () => <div data-testid="card-general" />,
}));
vi.mock('../cards/AppearanceCard', () => ({
  default: () => <div data-testid="card-appearance" />,
}));
vi.mock('../cards/AICard', () => ({
  default: () => <div data-testid="card-ai" />,
}));
vi.mock('../cards/ClipboardCard', () => ({
  default: () => <div data-testid="card-clipboard" />,
}));
vi.mock('../cards/FlashCard', () => ({
  default: () => <div data-testid="card-flash" />,
}));
vi.mock('../cards/PopoverCard', () => ({
  default: () => <div data-testid="card-popover" />,
}));
vi.mock('../cards/NotificationsCard', () => ({
  default: () => <div data-testid="card-notifications" />,
}));
vi.mock('../../Shared/WindowControls', () => ({
  default: () => null,
}));
vi.mock('../../../hooks/usePlatform', () => ({
  usePlatform: () => 'macos',
}));

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

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'settings',
    resources: { 'pt-BR': { settings: ptSettings } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe('SettingsPanel — 3-section tabstrip (DS9)', () => {
  it('renders 3 tabs in order: appearance, flow, stealth', () => {
    render(
      <Wrapper>
        <SettingsPanel onClose={() => {}} />
      </Wrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAccessibleName(/aparência/i);
    expect(tabs[1]).toHaveAccessibleName(/fluxo/i);
    expect(tabs[2]).toHaveAccessibleName(/stealth/i);
  });

  it('defaults to appearance — AppearanceCard visible, others not', () => {
    render(
      <Wrapper>
        <SettingsPanel onClose={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByTestId('card-appearance')).toBeInTheDocument();
    expect(screen.queryByTestId('card-general')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument();
  });

  it('switching to Fluxo shows General + AI + Notifications (and hides Appearance)', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SettingsPanel onClose={() => {}} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('tab', { name: /fluxo/i }));
    expect(screen.getByTestId('card-general')).toBeInTheDocument();
    expect(screen.getByTestId('card-ai')).toBeInTheDocument();
    expect(screen.getByTestId('card-notifications')).toBeInTheDocument();
    expect(screen.queryByTestId('card-appearance')).not.toBeInTheDocument();
  });

  it('switching to Stealth shows Popover + Flash + Clipboard', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SettingsPanel onClose={() => {}} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('tab', { name: /stealth/i }));
    expect(screen.getByTestId('card-popover')).toBeInTheDocument();
    expect(screen.getByTestId('card-flash')).toBeInTheDocument();
    expect(screen.getByTestId('card-clipboard')).toBeInTheDocument();
  });

  it('aria-selected mirrors the active tab', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SettingsPanel onClose={() => {}} />
      </Wrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    await user.click(tabs[1]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('tabpanel id matches the active tab aria-controls (accessibility wiring)', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SettingsPanel onClose={() => {}} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('tab', { name: /stealth/i }));
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'settings-section-stealth');
    expect(panel).toHaveAttribute(
      'aria-labelledby',
      'settings-tab-stealth',
    );
  });

  it('section subtitle is rendered and updates with the active tab', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SettingsPanel onClose={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText(/catálogo de temas/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /stealth/i }));
    expect(screen.getByText(/Hat fica discreto/i)).toBeInTheDocument();
  });
});
