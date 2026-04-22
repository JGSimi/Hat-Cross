import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import State from "../State";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>(
    "framer-motion",
  );
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe("State primitive (DS6)", () => {
  it("renders empty with role=status aria-live=polite", () => {
    render(<State variant="empty" title="Nada por aqui ainda" />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Nada por aqui ainda")).toBeInTheDocument();
  });

  it("renders loading with aria-busy", () => {
    render(<State variant="loading" title="Carregando saldo..." />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
  });

  it("renders error with role=alert aria-live=assertive", () => {
    render(
      <State
        variant="error"
        title="Sem conexão com o Hat"
        body="Você está offline."
      />,
    );
    const region = screen.getByRole("alert");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(
      screen.getByText("Você está offline."),
    ).toBeInTheDocument();
  });

  it("renders locked with role=region", () => {
    render(<State variant="locked" title="Tema Arcade" />);
    const region = screen.getByRole("region", { name: "Tier bloqueado" });
    expect(region).toBeInTheDocument();
  });

  it("invokes primary and secondary actions", async () => {
    const user = userEvent.setup();
    const primary = vi.fn();
    const secondary = vi.fn();
    render(
      <State
        variant="error"
        title="Chave da API inválida"
        body="O provedor não reconhece essa key."
        action={{ label: "Editar chave", onClick: primary }}
        secondary={{ label: "Remover provedor", onClick: secondary }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Editar chave" }));
    await user.click(screen.getByRole("button", { name: "Remover provedor" }));
    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).toHaveBeenCalledTimes(1);
  });

  it("supports inline layout", () => {
    const { container } = render(
      <State
        variant="loading"
        title="Preparando resposta..."
        inline
      />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("row");
  });

  it("passes axe (empty)", async () => {
    const { container } = render(
      <State
        variant="empty"
        title="Sem conversas salvas"
        body="Quando você conversar, as threads aparecem aqui."
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("passes axe (error with actions)", async () => {
    const { container } = render(
      <State
        variant="error"
        title="Provedor fora do ar"
        body="Não é você. O modelo está instável."
        action={{ label: "Reenviar agora", onClick: () => {} }}
        secondary={{ label: "Trocar modelo", onClick: () => {} }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("passes axe (locked)", async () => {
    const { container } = render(
      <State
        variant="locked"
        title="Tema Arcade"
        body="Desbloqueia em 500 créditos."
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("allows overriding the icon", () => {
    render(
      <State
        variant="empty"
        title="X"
        icon={<span data-testid="custom-icon">★</span>}
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
