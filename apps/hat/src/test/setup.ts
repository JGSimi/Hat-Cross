import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sem globals:true no vitest, o auto-cleanup do RTL não roda — desmonta
// cada componente entre testes para não acumular nós no DOM compartilhado.
afterEach(() => {
  cleanup();
});
