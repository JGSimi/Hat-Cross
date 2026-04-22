import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import HorseLogo from "../HorseLogo";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>(
    "framer-motion",
  );
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe("HorseLogo (DS5)", () => {
  it("renders as decorative by default (aria-hidden)", () => {
    const { container } = render(<HorseLogo />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renders with role=img + aria-label when ariaLabel is provided", () => {
    const { container } = render(<HorseLogo ariaLabel="Hat" />);
    expect(container.firstChild).toHaveAttribute("role", "img");
    expect(container.firstChild).toHaveAttribute("aria-label", "Hat");
  });

  it("passes axe when rendered decoratively", async () => {
    const { container } = render(<HorseLogo />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("passes axe with ariaLabel", async () => {
    const { container } = render(<HorseLogo ariaLabel="Hat" size={48} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each([
    ["idle"] as const,
    ["thinking"] as const,
    ["celebrating"] as const,
    ["stealth"] as const,
  ])("renders state=%s without crashing", (state) => {
    const { container } = render(<HorseLogo state={state} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("maps legacy animated=true to state=thinking", () => {
    const { container } = render(<HorseLogo animated />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("linear-gradient");
  });

  it("applies stealth styles (opacity 0.4 + saturate 0)", () => {
    const { container } = render(<HorseLogo state="stealth" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("opacity: 0.4");
    expect(el.getAttribute("style")).toContain("saturate(0)");
  });

  it("idle keeps the solid accent color (no gradient)", () => {
    const { container } = render(<HorseLogo state="idle" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("style")).not.toContain("linear-gradient");
  });
});
