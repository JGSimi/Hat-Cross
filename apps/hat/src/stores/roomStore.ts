// Store zustand das salas: sala ativa, cache de salas/entries por id e
// notificações. Dedupe de entries delegada ao domínio puro (merge.ts).

import { create } from 'zustand';

import { upsertById, upsertEntries as mergeEntries } from '../domain/rooms/merge';
import type {
  Room,
  RoomCluster,
  RoomEntry,
  RoomNotification,
} from '../domain/rooms/types';

export interface RoomStoreState {
  activeRoomId: string | null;
  rooms: Record<string, Room>;
  /** Entries por roomId, sempre deduplicadas e ordenadas por createdAt. */
  entries: Record<string, RoomEntry[]>;
  /** Clusters de consenso por roomId (computados pelo backend). */
  clusters: Record<string, RoomCluster[]>;
  notifications: RoomNotification[];

  setActiveRoom: (id: string | null) => void;
  upsertRoom: (room: Room) => void;
  upsertEntries: (roomId: string, incoming: RoomEntry[]) => void;
  upsertClusters: (roomId: string, incoming: RoomCluster[]) => void;
  upsertNotifications: (incoming: RoomNotification[]) => void;
  /** Marca a notificação como lida (seta readAt). Idempotente: não sobrescreve readAt existente. */
  markNotificationRead: (id: string) => void;
  /** Zera tudo (ex.: logout) — sai da sala ativa e limpa caches. */
  reset: () => void;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  activeRoomId: null,
  rooms: {},
  entries: {},
  clusters: {},
  notifications: [],

  setActiveRoom: (id) => set({ activeRoomId: id }),

  upsertRoom: (room) =>
    set((state) => ({
      rooms: { ...state.rooms, [room.id]: room },
    })),

  upsertEntries: (roomId, incoming) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [roomId]: mergeEntries(state.entries[roomId] ?? [], incoming),
      },
    })),

  upsertClusters: (roomId, incoming) =>
    set((state) => ({
      clusters: {
        ...state.clusters,
        [roomId]: upsertById(state.clusters[roomId] ?? [], incoming),
      },
    })),

  upsertNotifications: (incoming) =>
    set((state) => ({
      notifications: upsertById(state.notifications, incoming),
    })),

  markNotificationRead: (id) =>
    set((state) => {
      let changed = false;
      const notifications = state.notifications.map((notification) => {
        if (notification.id !== id || notification.readAt !== undefined) return notification;
        changed = true;
        return { ...notification, readAt: Date.now() };
      });
      return changed ? { notifications } : {};
    }),

  reset: () =>
    set({ activeRoomId: null, rooms: {}, entries: {}, clusters: {}, notifications: [] }),
}));
