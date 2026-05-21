export type ClipboardHistoryStatus = 'processing' | 'done' | 'error';

export interface ClipboardHistoryEntry {
  id: string;
  createdAt: number;
  text: string;
  image: string | null;
  response: string;
  roomId: string | null;
  roomTitle: string;
  sourceMessageId?: string | null;
  sharedToRoom?: boolean;
  roomSharePending?: boolean;
  roomShareError?: boolean;
  status: ClipboardHistoryStatus;
  flashShown: boolean;
}
