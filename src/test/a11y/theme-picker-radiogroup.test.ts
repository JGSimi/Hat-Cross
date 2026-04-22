import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const picker = readFileSync(
  join(here, "..", "..", "components/Settings/ThemePicker.tsx"),
  "utf-8",
);
const ptThemes = JSON.parse(
  readFileSync(
    join(here, "..", "..", "i18n/locales/pt-BR/themes.json"),
    "utf-8",
  ),
);
const enThemes = JSON.parse(
  readFileSync(
    join(here, "..", "..", "i18n/locales/en-US/themes.json"),
    "utf-8",
  ),
);

/**
 * Contract test for A4 — ThemePicker is semantically a radiogroup.
 * Exactly one theme is active at a time, every unlocked swatch is a
 * radio. aria-pressed (a toggle-button pattern) was wrong; aria-checked
 * + role="radio" is the right semantics.
 */
describe("a11y: ThemePicker radiogroup semantics (A4)", () => {
  it("outer picker is role=radiogroup with an aria-label", () => {
    expect(picker).toMatch(/role="radiogroup"/);
    expect(picker).toMatch(/aria-label=\{t\('pickerAriaLabel'/);
  });

  it("unlocked swatches are role=radio with aria-checked={active}", () => {
    expect(picker).toMatch(/role="radio"\s+aria-checked=\{active\}/);
  });

  it("no aria-pressed left on swatches (was the wrong semantic)", () => {
    expect(picker).not.toMatch(/aria-pressed=\{active\}/);
  });

  it("pickerAriaLabel exists in every locale bundle", () => {
    expect(ptThemes.pickerAriaLabel).toBe("Tema visual");
    expect(enThemes.pickerAriaLabel).toBe("Visual theme");
  });
});
