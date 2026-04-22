import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const indexCssPath = join(here, "..", "..", "index.css");
const css = readFileSync(indexCssPath, "utf-8");

describe("a11y: global :focus-visible contract (A1)", () => {
  it("defines a global :focus-visible rule", () => {
    expect(css).toMatch(/:focus-visible\s*\{/);
  });

  it("applies box-shadow with --focus-ring token", () => {
    expect(css).toMatch(
      /:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/s,
    );
  });

  it("keeps a transparent outline for Windows High Contrast Mode", () => {
    expect(css).toMatch(
      /:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+transparent/s,
    );
  });

  it("declares --focus-ring token in at least one theme", () => {
    expect(css).toMatch(/--focus-ring\s*:/);
  });
});

describe("a11y: no inline outline:'none' in Tab-reachable inputs (A1)", () => {
  const files = [
    "../../components/MainWindow/ConversationItem.tsx",
    "../../components/Clipboard/ClipboardToolbar.tsx",
  ];

  for (const rel of files) {
    const abs = join(here, rel);
    const src = readFileSync(abs, "utf-8");
    it(`${rel} has no outline: 'none'`, () => {
      expect(src).not.toMatch(/outline:\s*['"]none['"]/);
    });
  }
});
