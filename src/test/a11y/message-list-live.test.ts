import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(here, "..", "..", "components/Chat/MessageList.tsx"),
  "utf-8",
);

/**
 * Contract test for A3 — streaming chat must announce new chunks to
 * screen readers. Guards against regression of I2 from the design
 * critique (MessageList was a plain scrollable div with zero role or
 * aria-live declaration).
 */
describe("a11y: MessageList live region (A3)", () => {
  it('declares role="log"', () => {
    expect(src).toMatch(/role="log"/);
  });

  it('uses aria-live="polite" (not assertive — chat is not urgent)', () => {
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).not.toMatch(/aria-live="assertive"/);
  });

  it('announces only additions (aria-relevant)', () => {
    expect(src).toMatch(/aria-relevant="additions"/);
  });

  it('uses aria-atomic="false" so partial stream tokens are not re-read', () => {
    expect(src).toMatch(/aria-atomic="false"/);
  });

  it('mirrors streaming state via aria-busy', () => {
    expect(src).toMatch(/aria-busy=\{isStreaming\}/);
  });

  it('exposes an aria-label on the log region', () => {
    expect(src).toMatch(/aria-label="[^"]+"/);
  });
});
