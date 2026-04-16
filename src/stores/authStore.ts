import { create } from 'zustand';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth, signOut as firebaseSignOut } from '../services/auth/firebase';
import type { HatUser } from '../types/account';

interface AuthState {
  user: HatUser | null;
  isLoading: boolean;
  isHydrated: boolean;
  signOut: () => Promise<void>;
}

function toHatUser(user: User): HatUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  isLoading: true,
  isHydrated: false,
  signOut: async () => {
    await firebaseSignOut();
    // onAuthStateChanged clears `user` automatically — no need to setState here.
  },
}));

// Subscribe to Firebase auth state on module load. Fires once synchronously
// with the cached user (if any) and then on every sign-in / sign-out.
onAuthStateChanged(firebaseAuth, (user) => {
  useAuthStore.setState({
    user: user ? toHatUser(user) : null,
    isLoading: false,
    isHydrated: true,
  });
});
