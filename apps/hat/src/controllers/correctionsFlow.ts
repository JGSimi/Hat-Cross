// Correções da sala no Flash, sob demanda. O atalho global (Rust) emite
// 'shortcut:show-correction'; aqui pegamos a próxima correção não-lida, a
// mostramos no Flash e marcamos como lida localmente.

import type { NativeBridge } from '../bridge/native';
import { correctionFlashText, nextUnread } from '../domain/rooms/corrections';
import type { RoomNotification } from '../domain/rooms/types';

export interface CorrectionsFlowDeps {
  bridge: NativeBridge;
  /** Snapshot atual das notificações (do store) no momento do atalho. */
  getNotifications: () => RoomNotification[];
  markRead: (id: string) => void;
  /** Reporta quando não há correção pendente (UI pode dar um feedback sutil). */
  onEmpty?: () => void;
  onError?: (error: unknown) => void;
}

export function startCorrectionsFlow(deps: CorrectionsFlowDeps): () => void {
  return deps.bridge.on('shortcut:show-correction', () => {
    const next = nextUnread(deps.getNotifications());
    if (!next) {
      deps.onEmpty?.();
      return;
    }
    void (async () => {
      try {
        await deps.bridge.flashShowText(correctionFlashText(next));
        deps.markRead(next.id);
      } catch (error) {
        deps.onError?.(error);
      }
    })();
  });
}
