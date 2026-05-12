import { useEffect } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { isTauriRuntime } from '../utils/tauriRuntime';

export function useConversations() {
  const store = useConversationStore();

  useEffect(() => {
    if (!store.loaded) {
      if (!isTauriRuntime()) {
        useConversationStore.setState({ loaded: true });
        return;
      }
      store.loadConversations();
    }
  }, [store.loaded]);

  return store;
}
