import { LazyStore } from '@tauri-apps/plugin-store';
import { isTauriRuntime } from '../utils/tauriRuntime';
import {
  getWindowsStoreValue,
  isWindowsStoreRuntime,
  setWindowsStoreValue,
} from './windowsStore';

const CLEANUP_VERSION = 'hat-flash-clean-v1';
const markerStore = new LazyStore('hat-flash-cleanup.json');
const conversationsStore = new LazyStore('conversations-data.json');
const activeConversationStore = new LazyStore('conversation-state.json');
const draftsStore = new LazyStore('drafts-data.json');

export async function cleanupLegacyConversationData(): Promise<void> {
  if (!isTauriRuntime()) return;

  if (isWindowsStoreRuntime()) {
    const alreadyClean = await getWindowsStoreValue<boolean>('hat-flash-cleanup.json', CLEANUP_VERSION);
    if (alreadyClean) return;

    await Promise.all([
      setWindowsStoreValue('conversations-data.json', 'conversations', []),
      setWindowsStoreValue('conversation-state.json', 'activeId', null),
      setWindowsStoreValue('drafts-data.json', 'drafts', {}),
      setWindowsStoreValue('hat-flash-cleanup.json', CLEANUP_VERSION, true),
    ]);
    return;
  }

  const alreadyClean = await markerStore.get<boolean>(CLEANUP_VERSION);
  if (alreadyClean) return;

  await Promise.all([
    conversationsStore.set('conversations', []),
    activeConversationStore.set('activeId', null),
    draftsStore.set('drafts', {}),
  ]);
  await Promise.all([
    conversationsStore.save(),
    activeConversationStore.save(),
    draftsStore.save(),
  ]);

  await markerStore.set(CLEANUP_VERSION, true);
  await markerStore.save();
}
