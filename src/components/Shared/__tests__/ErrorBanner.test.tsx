import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptErrors from "../../../i18n/locales/pt-BR/errors.json";
import ErrorBanner from "../ErrorBanner";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    defaultNS: "errors",
    resources: {
      "pt-BR": { errors: ptErrors },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>(
    "framer-motion",
  );
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe("ErrorBanner (EE2)", () => {
  it("renders pt-BR copy for a known kind", () => {
    render(
      <Wrapper>
        <ErrorBanner kind="provider-429" />
      </Wrapper>,
    );
    expect(screen.getByText("Limite do provedor estourou")).toBeInTheDocument();
    expect(
      screen.getByText(/Você mandou rápido demais/),
    ).toBeInTheDocument();
  });

  it("shows retry as primary for retryable kinds", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <Wrapper>
        <ErrorBanner kind="provider-5xx" onRetry={onRetry} />
      </Wrapper>,
    );
    await user.click(screen.getByRole("button", { name: "Reenviar agora" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides retry for non-retryable kinds", () => {
    render(
      <Wrapper>
        <ErrorBanner kind="provider-401" onRetry={vi.fn()} />
      </Wrapper>,
    );
    // provider-401 is non-retryable → no retry button rendered from onRetry
    expect(
      screen.queryByRole("button", { name: "Editar chave" }),
    ).not.toBeInTheDocument();
  });

  it("renders settings deep-link for provider-401", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <Wrapper>
        <ErrorBanner kind="provider-401" onOpenSettings={onOpenSettings} />
      </Wrapper>,
    );
    await user.click(screen.getByRole("button", { name: "Editar chave" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("renders secondary dismiss when onDismiss is provided", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Wrapper>
        <ErrorBanner
          kind="network-offline"
          onRetry={vi.fn()}
          onDismiss={onDismiss}
        />
      </Wrapper>,
    );
    await user.click(screen.getByRole("button", { name: "Cancelar fila" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("falls back to unknown copy when kind has no mapping", () => {
    render(
      <Wrapper>
        {/* @ts-expect-error testing runtime fallback */}
        <ErrorBanner kind="does-not-exist" />
      </Wrapper>,
    );
    expect(screen.getByText("Erro inesperado")).toBeInTheDocument();
  });

  it("passes axe (provider-429 with retry + dismiss)", async () => {
    const { container } = render(
      <Wrapper>
        <ErrorBanner
          kind="provider-429"
          onRetry={() => {}}
          onDismiss={() => {}}
        />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("passes axe (provider-401 with settings deep-link)", async () => {
    const { container } = render(
      <Wrapper>
        <ErrorBanner kind="provider-401" onOpenSettings={() => {}} />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
