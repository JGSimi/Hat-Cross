import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18n from "i18next";
import ptChat from "../../../i18n/locales/pt-BR/chat.json";
import ShortcutsOverlay from "../ShortcutsOverlay";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    defaultNS: "chat",
    resources: { "pt-BR": { chat: ptChat } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>(
    "framer-motion",
  );
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

vi.mock("../../../hooks/usePlatform", () => ({
  usePlatform: () => "macos",
}));

vi.mock("../../../stores/settingsStore", () => ({
  useSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({
      settings: {
        shortcuts: {
          clipboard: "CommandOrControl+Shift+X",
          floatingChat: "CommandOrControl+Shift+C",
          adjustFlashPosition: "CommandOrControl+Shift+F",
          emergencyQuit: "CommandOrControl+Shift+Q",
        },
      },
    }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe("ShortcutsOverlay", () => {
  it("renders nothing when closed", () => {
    render(
      <Wrapper>
        <ShortcutsOverlay open={false} onClose={() => {}} />
      </Wrapper>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with title when open", () => {
    render(
      <Wrapper>
        <ShortcutsOverlay open={true} onClose={() => {}} />
      </Wrapper>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Atalhos")).toBeInTheDocument();
  });

  it("renders the four expected sections", () => {
    render(
      <Wrapper>
        <ShortcutsOverlay open={true} onClose={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Clipboard")).toBeInTheDocument();
    expect(screen.getByText("Popover")).toBeInTheDocument();
  });

  it("renders shortcut labels from i18n", () => {
    render(
      <Wrapper>
        <ShortcutsOverlay open={true} onClose={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("Abrir chat flutuante")).toBeInTheDocument();
    expect(screen.getByText("Processar clipboard")).toBeInTheDocument();
    expect(screen.getByText("Buscar na conversa")).toBeInTheDocument();
    expect(screen.getByText("Revelar chat do popover")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Wrapper>
        <ShortcutsOverlay open={true} onClose={onClose} />
      </Wrapper>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Wrapper>
        <ShortcutsOverlay open={true} onClose={onClose} />
      </Wrapper>,
    );
    const backdrop = screen.getByRole("dialog").parentElement!;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close when clicking inside the dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Wrapper>
        <ShortcutsOverlay open={true} onClose={onClose} />
      </Wrapper>,
    );
    await user.click(screen.getByText("Atalhos"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Wrapper>
        <ShortcutsOverlay open={true} onClose={onClose} />
      </Wrapper>,
    );
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("passes axe", async () => {
    const { container } = render(
      <Wrapper>
        <ShortcutsOverlay open={true} onClose={() => {}} />
      </Wrapper>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
