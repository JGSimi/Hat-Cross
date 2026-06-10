import { useMemo } from 'react';
import { createTauriBridge } from './bridge/tauri';
import type { NativeBridge } from './bridge/native';
import type { AuthPort } from './bridge/auth';
import { FlashPage } from './pages/FlashPage';
import { MainPage } from './pages/MainPage';

export type WindowRole = 'main' | 'flash';

interface AppProps {
  windowRole: WindowRole;
  /** Injetável em testes; default = bridge Tauri real. */
  bridge?: NativeBridge;
  /** Provedor de identidade; ausente até o adaptador Firebase ser plugado. */
  authPort?: AuthPort;
}

export function App({ windowRole, bridge, authPort }: AppProps) {
  const nativeBridge = useMemo(() => bridge ?? createTauriBridge(), [bridge]);

  if (windowRole === 'flash') {
    return <FlashPage bridge={nativeBridge} />;
  }
  return <MainPage bridge={nativeBridge} authPort={authPort} />;
}
