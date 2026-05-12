import { create } from 'zustand';
import type { Room, RoomCluster, RoomEntry, RoomMember, RoomNotification } from '../types/rooms';

interface RoomState {
  rooms: Room[];
  activeRoomId: string | null;
  members: RoomMember[];
  entries: RoomEntry[];
  clusters: RoomCluster[];
  notifications: RoomNotification[];
  isLoading: boolean;
  error: string | null;
  setRooms: (rooms: Room[]) => void;
  setActiveRoom: (roomId: string | null) => void;
  setMembers: (members: RoomMember[]) => void;
  setEntries: (entries: RoomEntry[]) => void;
  setClusters: (clusters: RoomCluster[]) => void;
  setNotifications: (notifications: RoomNotification[]) => void;
  upsertEntry: (entry: RoomEntry) => void;
  markNotificationRead: (notificationId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearRoomData: () => void;
}

function sortByUpdatedAt(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => b.updatedAt - a.updatedAt);
}

function sortEntries(entries: RoomEntry[]): RoomEntry[] {
  return [...entries].sort((a, b) => a.createdAt - b.createdAt);
}

export const useRoomStore = create<RoomState>()((set) => ({
  rooms: [],
  activeRoomId: null,
  members: [],
  entries: [],
  clusters: [],
  notifications: [],
  isLoading: false,
  error: null,

  setRooms: (rooms) => set({ rooms: sortByUpdatedAt(rooms), error: null }),
  setActiveRoom: (activeRoomId) => set({ activeRoomId }),
  setMembers: (members) => set({ members }),
  setEntries: (entries) => set({ entries: sortEntries(entries), error: null }),
  setClusters: (clusters) =>
    set({
      clusters: [...clusters].sort((a, b) => b.updatedAt - a.updatedAt),
      error: null,
    }),
  setNotifications: (notifications) =>
    set({
      notifications: [...notifications].sort((a, b) => b.createdAt - a.createdAt),
      error: null,
    }),
  upsertEntry: (entry) =>
    set((state) => {
      const without = state.entries.filter((item) => item.id !== entry.id);
      return { entries: sortEntries([...without, entry]) };
    }),
  markNotificationRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === notificationId ? { ...item, readAt: Date.now() } : item,
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearRoomData: () => set({ members: [], entries: [], clusters: [], notifications: [] }),
}));
