import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sidebarSrc = readFileSync(
  join(here, '..', '..', 'components/MainWindow/Sidebar.tsx'),
  'utf-8',
);
const accountSrc = readFileSync(
  join(here, '..', '..', 'components/Settings/AccountHeader.tsx'),
  'utf-8',
);

/**
 * Regression contract for EE9 — loading surfaces must use Skeleton
 * instead of paint-flickering with empty state or "—" placeholders.
 */
describe('EE9: loading skeletons', () => {
  describe('Sidebar conversation list', () => {
    it('reads the hydrated flag from conversationStore', () => {
      expect(sidebarSrc).toMatch(
        /const hydrated = useConversationStore\(\(s\) => s\.loaded\)/,
      );
    });

    it('renders Skeleton rows while hydrated is false', () => {
      expect(sidebarSrc).toMatch(/!hydrated \?/);
      expect(sidebarSrc).toMatch(/<Skeleton/);
    });

    it('announces aria-busy on the scroll container during hydration', () => {
      expect(sidebarSrc).toMatch(/aria-busy=\{!hydrated\}/);
    });
  });

  describe('AccountHeader balance', () => {
    it('replaces the "—" placeholder with a Skeleton during creditsLoading', () => {
      expect(accountSrc).toMatch(/creditsLoading \?[\s\S]*?<Skeleton/);
      // The raw "—" placeholder must not ship anymore.
      expect(accountSrc).not.toMatch(/opacity: 0\.35 \}\}>—<\/span>/);
    });

    it('passes a labelled aria via Skeleton.ariaLabel', () => {
      expect(accountSrc).toMatch(/ariaLabel=\{t\('balanceLoading'/);
    });
  });
});
