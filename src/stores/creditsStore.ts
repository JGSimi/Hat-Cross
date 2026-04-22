import { create } from 'zustand';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '../services/auth/firebase';
import { useAuthStore } from './authStore';
import { VALID_MODES, type AIMode } from '../types/account';
import type { AppTheme } from '../types';
import { resolveUnlockedSet } from '../utils/themeUnlocks';

// Defaults applied until the pricing doc loads. Must stay in sync with the
// admin tool's DEFAULT_BRL_TO_CREDITS, but the live Firestore value wins.
const DEFAULT_BRL_TO_CREDITS = 700;
const DEFAULT_TIER_BRLS = [5, 10, 20, 50];

export interface PricingSnapshot {
  brlToCredits: number;
  tierBrls: number[];
}

interface CreditsState {
  credits: number;
  // Cumulativo — incrementa a cada charge no backend, NUNCA decrementa.
  // Drives theme unlocks. Se o campo ainda não existir no Firestore
  // (backend antigo), ficamos em 0 e só os free themes aparecem.
  creditsSpent: number;
  // Autoritativo: array escrito pelo backend ao cruzar milestones.
  // Combinamos com fallback derivado via resolveUnlockedSet.
  unlockedThemes: Set<AppTheme>;
  isLoading: boolean;
  lastConsumed: number | null;
  selectedMode: AIMode;
  pricing: PricingSnapshot;
  setSelectedMode: (mode: AIMode) => void;
  markConsumed: (amount: number) => void;
  isThemeUnlocked: (theme: AppTheme) => boolean;
}

export const useCreditsStore = create<CreditsState>((set, get) => ({
  credits: 0,
  creditsSpent: 0,
  unlockedThemes: resolveUnlockedSet(0, undefined),
  isLoading: true,
  lastConsumed: null,
  selectedMode: 'hat',
  pricing: {
    brlToCredits: DEFAULT_BRL_TO_CREDITS,
    tierBrls: DEFAULT_TIER_BRLS,
  },
  // Guard: modos legados ou valores corrompidos (ex: snapshot antigo no Firestore)
  // caem silenciosamente no default `hat` em vez de causar 400 no Worker.
  setSelectedMode: (selectedMode) =>
    set({ selectedMode: VALID_MODES.has(selectedMode) ? selectedMode : 'hat' }),
  markConsumed: (amount) => set({ lastConsumed: amount }),
  isThemeUnlocked: (theme) => get().unlockedThemes.has(theme),
}));

const firestore = getFirestore(firebaseApp);
let unsubscribeUser: (() => void) | null = null;
let unsubscribePricing: (() => void) | null = null;

function attachPricingListener() {
  if (unsubscribePricing) return;
  const ref = doc(firestore, 'config', 'pricing');
  unsubscribePricing = onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const brlToCredits =
        typeof data?.brlToCredits === 'number' && data.brlToCredits > 0
          ? data.brlToCredits
          : DEFAULT_BRL_TO_CREDITS;
      const tierBrls =
        Array.isArray(data?.tierBrls) && data.tierBrls.length > 0
          ? (data.tierBrls as unknown[])
              .map((v) => Number(v))
              .filter((n) => Number.isFinite(n) && n > 0)
          : DEFAULT_TIER_BRLS;
      useCreditsStore.setState({ pricing: { brlToCredits, tierBrls } });
    },
    (err) => {
      console.warn('[creditsStore] pricing snapshot error:', err);
    },
  );
}

useAuthStore.subscribe((state, prev) => {
  if (state.user?.uid === prev.user?.uid) return;

  if (unsubscribeUser) {
    unsubscribeUser();
    unsubscribeUser = null;
  }
  if (unsubscribePricing) {
    unsubscribePricing();
    unsubscribePricing = null;
  }

  if (!state.user) {
    useCreditsStore.setState({
      credits: 0,
      creditsSpent: 0,
      unlockedThemes: resolveUnlockedSet(0, undefined),
      isLoading: false,
      lastConsumed: null,
    });
    return;
  }

  useCreditsStore.setState({ isLoading: true });
  attachPricingListener();

  const ref = doc(firestore, 'users', state.user.uid);
  unsubscribeUser = onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const credits = typeof data?.credits === 'number' ? data.credits : 0;
      const creditsSpent = typeof data?.creditsSpent === 'number' ? data.creditsSpent : 0;
      const firestoreUnlocked = Array.isArray(data?.unlockedThemes)
        ? (data.unlockedThemes as unknown[]).filter((v): v is string => typeof v === 'string')
        : undefined;
      useCreditsStore.setState({
        credits,
        creditsSpent,
        unlockedThemes: resolveUnlockedSet(creditsSpent, firestoreUnlocked),
        isLoading: false,
      });
    },
    (err) => {
      console.error('[creditsStore] snapshot error:', err);
      useCreditsStore.setState({ isLoading: false });
    },
  );
});
