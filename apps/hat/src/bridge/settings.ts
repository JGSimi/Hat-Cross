// Porta de persistência de configurações. O adaptador real usa
// @tauri-apps/plugin-store; testes usam um fake em memória.

import type { Settings } from '../domain/settings/schema';

export interface SettingsPort {
  /** JSON cru do disco (qualquer formato; migrado pelo domínio). */
  load(): Promise<unknown>;
  save(settings: Settings): Promise<void>;
}
