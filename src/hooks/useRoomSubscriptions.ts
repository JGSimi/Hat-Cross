import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useRoomSubscriptions(enabled: boolean): void {
  const authUid = useAuthStore((s) => s.user?.uid ?? null);
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const shouldTrackRooms = Boolean(authUid && (enabled || activeRoomId));

  useEffect(() => {
    const store = useRoomStore.getState();

    if (!authUid) {
      store.setRooms([]);
      store.setActiveRoom(null);
      store.clearRoomData();
      store.setLoading(false);
      return undefined;
    }

    if (!shouldTrackRooms) {
      store.setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    store.setLoading(true);

    void import('../services/rooms/listeners')
      .then(({ listenRooms }) => {
        if (cancelled) return;

        unsubscribe = listenRooms(
          authUid,
          (rooms) => {
            const openRooms = rooms.filter((room) => room.status === 'open');
            const current = useRoomStore.getState();
            current.setRooms(openRooms);

            if (openRooms.length === 0) {
              current.setActiveRoom(null);
              current.clearRoomData();
            } else if (!current.activeRoomId || !openRooms.some((room) => room.id === current.activeRoomId)) {
              current.setActiveRoom(openRooms[0].id);
            }

            current.setLoading(false);
          },
          (error) => {
            const current = useRoomStore.getState();
            current.setError(messageFromError(error));
            current.setLoading(false);
          },
        );
      })
      .catch((error: unknown) => {
        const current = useRoomStore.getState();
        current.setError(messageFromError(error));
        current.setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [authUid, shouldTrackRooms]);

  useEffect(() => {
    if (!authUid || !activeRoomId || !enabled) {
      useRoomStore.getState().clearRoomData();
      return undefined;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void import('../services/rooms/listeners')
      .then(({ listenRoomData }) => {
        if (cancelled) return;

        unsubscribe = listenRoomData(activeRoomId, authUid, {
          onRoom: (room) => {
            if (room) {
              const current = useRoomStore.getState();
              const exists = current.rooms.some((item) => item.id === room.id);
              current.setRooms(exists ? current.rooms.map((item) => (item.id === room.id ? room : item)) : [room, ...current.rooms]);
            }
          },
          onMembers: (members) => useRoomStore.getState().setMembers(members),
          onEntries: (entries) => useRoomStore.getState().setEntries(entries),
          onClusters: (clusters) => useRoomStore.getState().setClusters(clusters),
          onNotifications: (notifications) => useRoomStore.getState().setNotifications(notifications),
          onError: (error) => useRoomStore.getState().setError(messageFromError(error)),
        });
      })
      .catch((error: unknown) => {
        useRoomStore.getState().setError(messageFromError(error));
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeRoomId, authUid, enabled]);
}
