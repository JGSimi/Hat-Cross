// Instância Firebase compartilhada entre auth e Firestore. initializeApp duas
// vezes com o mesmo config lança erro — então centralizamos aqui (getApps()).

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  type Firestore,
} from 'firebase/firestore';
import type { AuthConfig } from '../auth/config';

let cachedDb: Firestore | null = null;

export function getFirebaseApp(config: AuthConfig['firebase']): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export function getDb(config: AuthConfig['firebase']): Firestore {
  if (cachedDb) return cachedDb;
  const app = getFirebaseApp(config);
  // Cache local persistente: onSnapshot resume offline e sobrevive a reinícios
  // do webview (WKWebView/WebView2). WebChannel/long-polling auto-detect.
  cachedDb = initializeFirestore(app, {
    localCache: persistentLocalCache(),
    experimentalAutoDetectLongPolling: true,
  });
  return cachedDb;
}
