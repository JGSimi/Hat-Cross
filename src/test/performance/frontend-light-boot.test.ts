import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');

function source(path: string): string {
  return readFileSync(join(root, path), 'utf-8');
}

describe('frontend light boot contracts', () => {
  it('starts new installs in noir without remote font blockers', () => {
    expect(source('index.html')).toMatch(/<html[^>]+data-theme="noir"/);
    expect(source('src/types/index.ts')).toMatch(/theme:\s*'noir'/);
    expect(source('index.html')).not.toMatch(/fonts\.googleapis|fontshare|fonts\.gstatic/);
  });

  it('keeps the noir theme quiet and legible', () => {
    const css = source('src/index.css');
    expect(css).toMatch(/\[data-theme="noir"\][\s\S]*--text-muted:\s*#8A8A8A/);
    expect(css).toMatch(/\[data-theme="noir"\][\s\S]*--bg-gradient-base:\s*none/);
    expect(css).toMatch(/html\[data-theme="noir"\] \.bg-atmosphere::before/);
    expect(css).toMatch(/html\[data-theme="noir"\][\s\S]*backdrop-filter:\s*none/);
  });

  it('keeps theme transitions under 400ms', () => {
    const transition = source('src/utils/themeTransition.ts');
    const picker = source('src/components/Settings/ThemePicker.tsx');
    const css = source('src/index.css');

    expect(Number(transition.match(/FALLBACK_DURATION_MS\s*=\s*(\d+)/)?.[1])).toBeLessThanOrEqual(400);
    expect(Number(picker.match(/COOLDOWN_MS\s*=\s*(\d+)/)?.[1])).toBeLessThanOrEqual(400);
    expect(css).not.toMatch(/1100ms|1200ms|1400ms/);
  });

  it('keeps heavy modules behind lazy imports', () => {
    const app = source('src/App.tsx');
    const layout = source('src/components/MainWindow/MainLayout.tsx');
    const markdownConsumers = [
      'src/components/Chat/MessageList.tsx',
      'src/components/Chat/MessageBubble.tsx',
      'src/components/Chat/ThinkingBlock.tsx',
      'src/components/Clipboard/ClipboardCard.tsx',
    ].map(source).join('\n');

    expect(app).not.toMatch(/from ['"].\/services\/rooms\/listeners['"]/);
    expect(layout).toMatch(/lazy\(\(\) => import\('\.\.\/Clipboard\/ClipboardHistory'\)\)/);
    expect(layout).toMatch(/lazy\(\(\) => import\('\.\.\/\.\.\/pages\/RoomsPage'\)\)/);
    expect(source('src/components/Settings/cards/AppearanceCard.tsx')).toMatch(
      /lazy\(\(\) => import\('\.\.\/ThemePicker'\)\)/,
    );
    expect(markdownConsumers).not.toMatch(/from ['"]react-markdown['"]/);
  });

  it('splits vendor chunks by runtime cost', () => {
    const config = source('vite.config.ts');
    expect(config).toMatch(/vendor-react/);
    expect(config).toMatch(/vendor-tauri/);
    expect(config).toMatch(/vendor-firebase/);
    expect(config).toMatch(/vendor-markdown/);
    expect(config).toMatch(/vendor-motion/);
  });
});
