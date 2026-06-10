# Hat v2 — Arquitetura

**Status:** Ativo · **Data:** 2026-06-09 · Decisão de stack em [01-adr-stack.md](01-adr-stack.md)

## 1. Localização e layout do código

Novo app em **`apps/hat/`** (o legado Tauri na raiz e a tentativa Wails em `apps/hat-flash/` ficam como referência até o v2 atingir paridade):

```
apps/hat/
├── package.json              # React 19, Vite, Vitest, Tailwind v4, Zustand
├── vite.config.ts
├── vitest.config.ts          # jsdom, coverage v8, threshold 60%
├── index.html
├── src/
│   ├── main.tsx              # bootstrap + roteamento por janela (main | flash)
│   ├── domain/               # ⭐ PURO — zero imports @tauri-apps/*. Testável em CI.
│   │   ├── flash/            # timing (holdMs), máquina de estados do flash
│   │   ├── shortcuts/        # accelerator: parse, normalização, paridade Cmd≡Ctrl
│   │   ├── clipboard/        # pipeline: máquina de estados idle→reading→…→done
│   │   ├── stream/           # montagem de chunks, blocos <thoughts>, mapa de erros
│   │   ├── rooms/            # reducers de consenso/divergência, merge de entries
│   │   └── settings/         # schema, defaults, migração de versões
│   ├── stores/               # Zustand; dependem de NativeBridge, nunca de Tauri
│   ├── bridge/
│   │   ├── native.ts         # interface NativeBridge (invoke/listen tipados)
│   │   ├── tauri.ts          # implementação real
│   │   └── mock.ts           # implementação para testes
│   ├── pages/                # MainPage (chat/salas/settings), FlashPage
│   └── styles/               # tokens @theme (Tailwind v4 CSS-first)
└── src-tauri/
    ├── Cargo.toml            # [workspace] members = [".", "crates/hat-core"]
    ├── tauri.conf.json       # janelas main + flash, bundle, updater
    ├── capabilities/         # permissões mínimas por janela
    ├── crates/hat-core/      # ⭐ PURO — zero deps Tauri/objc/windows. cargo test em CI.
    │   └── src/
    │       ├── sse.rs        # parser SSE UTF-8-safe (porte de streaming.rs + testes)
    │       ├── accelerator.rs# normalização de atalhos lado Rust
    │       ├── flash.rs      # cálculo de hold/posição (fonte única da fórmula)
    │       └── error.rs      # mapa de erros hat-proxy (401/402/429/5xx → códigos)
    └── src/
        ├── main.rs / lib.rs  # setup, ActivationPolicy::Accessory, janelas
        ├── shortcuts.rs      # registro Rust-side; emergency quit 100% nativo
        ├── flash_window.rs   # show/hide/posicionamento; nspanel no macOS
        ├── clipboard.rs      # trait ClipboardPort + impl clipboard-rs + retry Win
        ├── stream.rs         # task de streaming p/ hat-proxy (usa hat-core::sse)
        └── tray.rs           # TrayIconBuilder, menu, i18n de labels
```

## 2. Topologia de janelas (processo único)

| Janela | Criação | Propriedades |
|---|---|---|
| **main** | no boot, oculta | janela normal; abre pelo tray; chat + salas + settings |
| **flash** | **no boot, oculta, pré-aquecida** | transparente, frameless, `skipTaskbar`. macOS: convertida em NSPanel (`nonactivatingPanel`, level `statusBar`, `canJoinAllSpaces + fullScreenAuxiliary + ignoresCycle`). Windows: `alwaysOnTop` + `set_focusable(false)` **em runtime** (config inicial não confiável, tauri#11566) + `setIgnoreCursorEvents(true)`. `setContentProtected(true)` no builder **e** reaplicado a cada `show()` (reaplicação idempotente paranoica). |
| **popover** (V1.1) | lazy | mesmo tratamento de painel do flash |

App-level: `ActivationPolicy::Accessory` no macOS (sem Dock; pré-requisito para overlay em Spaces fullscreen). Tray via `TrayIconBuilder` com menu raiz plano.

## 3. O caminho quente do flash (orçamento p95 < 800 ms)

**Tudo nativo até o primeiro paint.** Nenhuma criação de janela, nenhum boot de webview, nenhum round-trip por JS:

```
hotkey (callback Rust)
  → ler clipboard via ClipboardPort            (~1–60 ms; retry 3×60 ms no Win)
  → posicionar + mostrar painel pré-criado      (~10 ms)
  → emit "flash:show" { state: "processing" }   (webview já viva renderiza < 150 ms)
  → spawn task de stream para hat-proxy
       → emit "stream:chunk" / "stream:done"    (resposta preenche o card já visível)
```

A resposta da IA **streama no card já visível** — o orçamento de 800 ms é para o primeiro paint do estado "processando", não para a resposta completa. Instrumentar com spans (`hotkey→show`, `show→first-paint`, `request→first-chunk`).

O **fechamento de emergência** nunca toca a webview: handler Rust esconde todas as janelas e chama `app.exit()` — funciona com renderer travado.

## 4. IPC (contratos tipados)

**Rust → JS (eventos):** `flash:show {payload}`, `stream:chunk {streamId, delta}`, `stream:done {streamId}`, `stream:error {code}`, `clipboard:failed {reason}`, `shortcut:registration-failed {binding, code}`, `settings:changed`.

**JS → Rust (commands):** `flash_hide`, `flash_enter_adjust_mode`, `flash_save_position {x,y,monitor}`, `set_shortcuts {bindings}`, `start_stream {req}`, `cancel_stream {streamId}`, `read_clipboard`.

Payloads pequenos e tipados; imagens cruzam o IPC como base64 PNG. No React, detecção de papel da janela (padrão `isMainWindow` do legado) garante listener único por preocupação.

## 5. Camadas para TDD (regra de dependência)

```
┌────────────────────────────────────────────────────┐
│ Adapters (não testados em unidade; finos por regra)│
│  Rust: commands/eventos Tauri, nspanel, tray       │
│  TS:   bridge/tauri.ts                             │
├────────────────────────────────────────────────────┤
│ Domínio (100% testável em CI, sem shell nativo)    │
│  Rust: hat-core (sse, accelerator, flash, error)   │
│  TS:   src/domain/* (puro) + stores (com mock)     │
└────────────────────────────────────────────────────┘
```

Regras:
- `src/domain/**` não importa `@tauri-apps/*` (lint gate).
- `hat-core` não depende de tauri/objc2/windows-sys (gate no Cargo.toml).
- Stores Zustand recebem `NativeBridge` por injeção; testes usam `bridge/mock.ts`.
- Adapter fino: se um adapter tem lógica condicional, a lógica desce para o domínio.

## 6. Streaming (porte do legado, com correções)

- `drain_lines` UTF-8-safe (não quebra multi-byte entre chunks TCP) — portar com testes.
- Registry de cancelamento por stream (`Arc<AtomicBool>` por `streamId`) — **adicionar guard de `Drop`** para corrigir o leak-on-panic do legado.
- Contrato hat-proxy: `POST /v1/chat`, Bearer token Firebase, `Idempotency-Key`, body `{mode, messages, systemPrompt, temperature, maxTokens, roomId?, roomShare?, sourceMessageId?}`, resposta SSE formato OpenAI.
- URL do proxy com override por env/config (gap do legado; necessário para testes de integração).
- Parsing de blocos `<thoughts>` como máquina de estados tolerante a chunk malformado (o legado crashava).

## 7. Salas

- **Data plane:** Firestore `onSnapshot` no renderer (WebChannel/HTTPS — funciona em WKWebView e WebView2). Tipos e listeners portados do legado (`src/services/rooms/`).
- **Auth:** OAuth Google em navegador externo com loopback (porte de `oauth.rs`) → `signInWithCustomToken`. Wrapper `getIdToken()` com refresh proativo (gap do legado).
- **Join atômico de 800 créditos (hat-proxy):** UMA transação Firestore via REST: lê `users/{uid}.credits` + `rooms/{id}/members/{uid}`; se member existe → sucesso sem débito (idempotência por construção); senão decrementa, cria member, incrementa `memberCount`. `Idempotency-Key` como segunda guarda na camada HTTP.
- **Rules:** entries/clusters/notifications legíveis apenas se `exists(.../members/$(request.auth.uid))`; escritas de cliente negadas — tudo via hat-proxy.
- **Consenso:** clustering server-side no Worker (pipeline do plano de salas); o cliente só renderiza clusters/divergências (reducers puros em `domain/rooms`).
- **Presence:** heartbeat `lastSeenAt` 30–60 s + threshold client-side (suficiente na escala de sala).

## 8. Build & release

- Vite com vendor chunks manuais (padrão do legado).
- `tauri-plugin-updater` com artefatos assinados; GitHub Actions matrix (macOS universal, Windows x64).
- CI: `npm test` (Vitest, coverage ≥ 60%) + `cargo test -p hat-core` + `cargo clippy` em todo push; build nativo por matrix em tags.
