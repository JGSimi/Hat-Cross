import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { readAuthConfig } from './services/auth/config';
import { createFirebaseAuthPort } from './services/auth/firebase';
import type { AuthPort } from './bridge/auth';
import './styles/app.css';

// Papel da janela vem da URL (#/flash) — a janela flash é criada pelo Rust
// com essa hash. Decidir aqui (e não via API Tauri) mantém o React testável.
const hash = window.location.hash;
const windowRole = hash === '#/flash' ? 'flash' : hash === '#/gabarito' ? 'gabarito' : 'main';
document.body.dataset.window = windowRole === 'main' ? 'main' : 'flash';

// Auth só na janela main (a flash é display puro). Sem credenciais no
// ambiente, o app roda em modo sem-conta.
let authPort: AuthPort | undefined;
if (windowRole === 'main') {
  const config = readAuthConfig();
  if (config) {
    authPort = createFirebaseAuthPort(config);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App windowRole={windowRole} authPort={authPort} />
  </React.StrictMode>,
);
