import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ptThemes from '../../../i18n/locales/pt-BR/themes.json';
import TierProgressionStrip from '../TierProgressionStrip';
import { useCreditsStore } from '../../../stores/creditsStore';
import { THEME_PRESETS, type AppTheme } from '../../../types';

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
    defaultNS: 'themes',
    resources: { 'pt-BR': { themes: ptThemes } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

function setCreditsStore(creditsSpent: number, unlockedNames: AppTheme[] = []) {
  useCreditsStore.setState({
    creditsSpent,
    unlockedThemes: new Set<AppTheme>(unlockedNames),
  });
}

describe('TierProgressionStrip', () => {
  beforeEach(() => {
    // Fresh user — 100 credits spent, no theme unlocks beyond free.
    const freeNames = THEME_PRESETS.filter(
      (t) => t.unlockAt === 0,
    ).map((t) => t.name);
    setCreditsStore(100, freeNames);
  });

  it('renders the next-tier remaining label and percent', () => {
    render(
      <Wrapper>
        <TierProgressionStrip />
      </Wrapper>,
    );
    // 100 / 500 = 20% toward the first paid unlock (Spark tier).
    expect(screen.getByText(/^20%$/)).toBeInTheDocument();
    expect(screen.getByText(/Faltam/i)).toBeInTheDocument();
  });

  it('exposes a labelled group for screen readers', () => {
    render(
      <Wrapper>
        <TierProgressionStrip />
      </Wrapper>,
    );
    const group = screen.getByRole('group', {
      name: /Progresso para o próximo tier/i,
    });
    expect(group).toBeInTheDocument();
  });

  it('uses pt-BR locale formatting for remaining credits (periods as thousands)', () => {
    // 10k spent, unlockAt of next is 25k (Radiante) assuming linear progression.
    const freeNames = THEME_PRESETS.filter(
      (t) => t.unlockAt <= 10_000,
    ).map((t) => t.name);
    setCreditsStore(10_000, freeNames);
    render(
      <Wrapper>
        <TierProgressionStrip />
      </Wrapper>,
    );
    // Remaining should be 15000 → formatted as "15.000" in pt-BR.
    expect(screen.getByText(/15\.000/)).toBeInTheDocument();
  });

  it('renders nothing when every theme is unlocked (null branch)', () => {
    const allNames = THEME_PRESETS.map((t) => t.name);
    setCreditsStore(10_000_000, allNames);
    const { container } = render(
      <Wrapper>
        <TierProgressionStrip />
      </Wrapper>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('passes axe', async () => {
    const { container } = render(
      <Wrapper>
        <TierProgressionStrip />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
