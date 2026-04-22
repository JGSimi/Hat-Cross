import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..", "..");

function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf-8");
}

/**
 * Contract test for A2: every icon-only button in the three components
 * touched by the a11y sweep must declare an aria-label. Catches the
 * regression "someone removed aria-label and fell back to title= only".
 */
describe("a11y: icon-only buttons declare aria-label (A2)", () => {
  describe("Sidebar — 4 header / footer buttons", () => {
    const src = readSrc("components/MainWindow/Sidebar.tsx");

    it.each([
      ["sidebar.openClipboard"],
      ["sidebar.newChat"],
      ["sidebar.hideSidebar"],
      ["sidebar.storageInfo"],
    ])("has aria-label for %s", (key) => {
      expect(src).toMatch(
        new RegExp(`aria-label=\\{t\\(['"]${key.replace(/\./g, "\\.")}['"]\\)\\}`),
      );
    });

    it("storage toggle announces aria-expanded", () => {
      expect(src).toMatch(/aria-expanded=\{showStorageInfo\}/);
    });
  });

  describe("MessageBubble — copy button", () => {
    const src = readSrc("components/Chat/MessageBubble.tsx");

    it("copy button has dynamic aria-label announcing the copied state", () => {
      expect(src).toMatch(
        /aria-label=\{copied\s*\?\s*['"]Copiado['"]\s*:\s*['"]Copiar mensagem['"]\}/,
      );
    });

    it("copy button exposes aria-live for screen readers", () => {
      expect(src).toMatch(/aria-live=['"]polite['"]/);
    });
  });

  describe("WindowControls — traffic-light + minimal controls", () => {
    const src = readSrc("components/Shared/WindowControls.tsx");

    it.each([
      ["Fechar janela", 2],
      ["Minimizar janela", 2],
      ["Maximizar janela", 2],
    ])("has %i aria-label=\"%s\"", (label, expected) => {
      const needle = `aria-label="${label}"`;
      const count = src.split(needle).length - 1;
      expect(count).toBe(expected);
    });

    it("no button in WindowControls is left without aria-label", () => {
      // Button count (one per window control) must match aria-label count.
      const buttonOpens = (src.match(/<button\b/g) ?? []).length;
      const labels = (src.match(/aria-label=/g) ?? []).length;
      expect(labels).toBeGreaterThanOrEqual(buttonOpens);
    });
  });
});
