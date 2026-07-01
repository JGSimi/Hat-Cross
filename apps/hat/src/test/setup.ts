import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';

// Animações do framer-motion instantâneas em teste: sem isto o AnimatePresence
// atrasa mount/unmount das telas e as asserts síncronas falham.
MotionGlobalConfig.skipAnimations = true;

// Sem globals:true no vitest, o auto-cleanup do RTL não roda — desmonta
// cada componente entre testes para não acumular nós no DOM compartilhado.
afterEach(() => {
  cleanup();
});
