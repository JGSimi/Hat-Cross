// Toggle do gabarito por atalho. O atalho global (Rust) emite
// 'shortcut:toggle-gabarito'; aqui alternamos a visibilidade do overlay,
// montando os itens da sala ativa quando mostramos.

import type { NativeBridge } from '../bridge/native';
import { buildGabarito } from '../domain/rooms/gabarito';
import type { RoomCluster, RoomEntry } from '../domain/rooms/types';

export interface GabaritoFlowDeps {
  bridge: NativeBridge;
  /** Dados da sala ativa no momento do atalho (null se nenhuma). */
  getRoomData: () => { clusters: RoomCluster[]; entries: RoomEntry[]; myUid: string } | null;
  onError?: (error: unknown) => void;
}

export function startGabaritoFlow(deps: GabaritoFlowDeps): () => void {
  let visible = false;
  return deps.bridge.on('shortcut:toggle-gabarito', () => {
    void (async () => {
      try {
        if (visible) {
          await deps.bridge.gabaritoHide();
          visible = false;
          return;
        }
        const data = deps.getRoomData();
        const items = data ? buildGabarito(data.clusters, data.entries, data.myUid) : [];
        await deps.bridge.gabaritoShow(items);
        visible = true;
      } catch (error) {
        deps.onError?.(error);
      }
    })();
  });
}
