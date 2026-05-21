import type { ClipboardHistoryEntry } from '../types/clipboard';
import type { Room, RoomEntry } from './rooms';

export function visibleMemberCount(room: Room | null, memberCountFromMembers: number): number {
  return memberCountFromMembers || room?.memberCount || 0;
}

export function canShareClipboardToRoom(room: Room | null, memberCount: number): boolean {
  void memberCount;
  return Boolean(room && room.status === 'open');
}

export function reconcileClipboardRoomShares(
  history: ClipboardHistoryEntry[],
  roomEntries: RoomEntry[],
): ClipboardHistoryEntry[] {
  if (!history.length || !roomEntries.length) return history;
  const remoteIds = new Set(roomEntries.flatMap((entry) => [entry.id, entry.sourceMessageId].filter(Boolean)));
  let changed = false;
  const next = history.map((entry) => {
    if (!entry.sourceMessageId || !remoteIds.has(entry.sourceMessageId)) return entry;
    if (entry.sharedToRoom && !entry.roomSharePending && !entry.roomShareError) return entry;
    changed = true;
    return {
      ...entry,
      sharedToRoom: true,
      roomSharePending: false,
      roomShareError: false,
    };
  });
  return changed ? next : history;
}
