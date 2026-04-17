import { create } from 'zustand';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '../services/auth/firebase';
import { useAuthStore } from './authStore';
import type { AIMode } from '../types/account';

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
  isLoading: boolean;
  lastConsumed: number | null;
  selectedMode: AIMode;
  pricing: PricingSnapshot;
  setSelectedMode: (mode: AIMode) => void;
  markConsumed: (amount: number) => void;
}

export const useCreditsStore = create<CreditsState>((set) => ({
  credits: 0,
  isLoading: true,
  lastConsumed: null,
  selectedMode: 'standard',
  pricing: {
    brlToCredits: DEFAULT_BRL_TO_CREDITS,
    tierBrls: DEFAULT_TIER_BRLS,
  },
  setSelectedMode: (selectedMode) => set({ selectedMode }),
  markConsumed: (amount) => set({ lastConsumed: amount }),
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
    useCreditsStore.setState({ credits: 0, isLoading: false, lastConsumed: null });
    return;
  }

  useCreditsStore.setState({ isLoading: true });
  attachPricingListener();

  const ref = doc(firestore, 'users', state.user.uid);
  unsubscribeUser = onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      useCreditsStore.setState({
        credits: typeof data?.credits === 'number' ? data.credits : 0,
        isLoading: false,
      });
    },
    (err) => {
      console.error('[creditsStore] snapshot error:', err);
      useCreditsStore.setState({ isLoading: false });
    },
  );
});
