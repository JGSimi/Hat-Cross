import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

describe("test harness", () => {
  it("runs vitest", () => {
    expect(true).toBe(true);
  });

  it("renders a component with testing-library", () => {
    render(<button type="button">Testar</button>);
    expect(screen.getByRole("button", { name: "Testar" })).toBeInTheDocument();
  });

  it("runs axe on accessible markup", async () => {
    const { container } = render(
      <button type="button" aria-label="Salvar mudanças">
        Salvar
      </button>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
