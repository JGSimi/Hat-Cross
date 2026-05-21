import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(here, "..", "..", "components/Clipboard/ClipboardHistory.tsx"),
  "utf-8",
);
const ptClipboard = JSON.parse(
  readFileSync(
    join(here, "..", "..", "i18n/locales/pt-BR/clipboard.json"),
    "utf-8",
  ),
);
const enClipboard = JSON.parse(
  readFileSync(
    join(here, "..", "..", "i18n/locales/en-US/clipboard.json"),
    "utf-8",
  ),
);

/**
 * Contract test for MC7 (clipboard slice) — no toast in
 * ClipboardHistory ever ships a hardcoded pt-BR string. Forces future
 * edits through i18n so en-US / es-ES stay in sync.
 */
describe("i18n: ClipboardHistory has no hard-coded toast strings (MC7)", () => {
  it("every showToast call uses t('toasts.*') not a string literal", () => {
    // Grep for showToast with a quoted first arg (literal string) —
    // should not match after the MC7 migration.
    expect(src).not.toMatch(/showToast\(\s*['"`][^'"`]+['"`]/);
  });

  it("imports useTranslation", () => {
    expect(src).toMatch(/from ['"]react-i18next['"]/);
  });

  it("scopes useTranslation to the clipboard namespace", () => {
    expect(src).toMatch(/useTranslation\(\s*['"]clipboard['"]\s*\)/);
  });

  const expectedKeys = [
    "responseCopied",
    "nothingToCopy",
    "originalCopied",
    "originalAndResponseCopied",
    "pinned",
    "unpinned",
    "removed",
    "historyCleared",
  ];

  it("pt-BR clipboard bundle declares every toast key", () => {
    for (const key of expectedKeys) {
      expect(ptClipboard.toasts?.[key]).toBeTruthy();
    }
  });

  it("en-US clipboard bundle mirrors the same toast keys", () => {
    for (const key of expectedKeys) {
      expect(enClipboard.toasts?.[key]).toBeTruthy();
    }
  });
});
