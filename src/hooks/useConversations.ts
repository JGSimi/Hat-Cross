import { useEffect } from 'react';
import { useConversationStore } from '../stores/conversationStore';

export function useConversations() {
  const store = useConversationStore();

  useEffect(() => {
    if (!store.loaded) {
      store.loadConversations();
    }
  }, [store.loaded]);

  return store;
}
