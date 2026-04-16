import { create } from 'zustand';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '../services/auth/firebase';
import { useAuthStore } from './authStore';
import type { AIMode } from '../types/account';

interface CreditsState {
  credits: number;
  isLoading: boolean;
  lastConsumed: number | null; // last debit amount, for "−N créditos" badge
  selectedMode: AIMode;
  setSelectedMode: (mode: AIMode) => void;
  markConsumed: (amount: number) => void;
}

export const useCreditsStore = create<CreditsState>((set) => ({
  credits: 0,
  isLoading: true,
  lastConsumed: null,
  selectedMode: 'standard',
  setSelectedMode: (selectedMode) => set({ selectedMode }),
  markConsumed: (amount) => set({ lastConsumed: amount }),
}));

const firestore = getFirestore(firebaseApp);
let unsubscribeFirestore: (() => void) | null = null;

// Attach/detach a Firestore realtime listener on users/{uid} whenever the
// signed-in user changes. This keeps `credits` live without polling.
useAuthStore.subscribe((state, prev) => {
  if (state.user?.uid === prev.user?.uid) return;

  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }

  if (!state.user) {
    useCreditsStore.setState({ credits: 0, isLoading: false, lastConsumed: null });
    return;
  }

  useCreditsStore.setState({ isLoading: true });
  const ref = doc(firestore, 'users', state.user.uid);
  unsubscribeFirestore = onSnapshot(
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
