# Hat v2

Rebuild do Hat Flash em **Tauri v2** — assistente de IA stealth na bandeja do sistema, com atalhos globais que funcionam sem foco, overlay Flash topmost e salas colaborativas.

Documentos de planejamento: [`docs/rebuild/`](../../docs/rebuild/) (visão de produto, ADR da stack, arquitetura, plano TDD).

## Por que o rebuild

A tentativa anterior (`apps/hat-flash`, Wails v3 alpha) falhou estruturalmente: Wails v3 não suporta atalhos globais de SO por design e não tem janela não-ativante para o overlay. Detalhes e fontes no [ADR-001](../../docs/rebuild/01-adr-stack.md).

## Stack

- **Shell:** Tauri v2 + `tauri-plugin-global-shortcut` (atalhos registrados no Rust) + `clipboard-rs` + tray nativo
- **Overlay macOS:** NSWindowCollectionBehavior::FullScreenAuxiliary via objc2 (upgrade futuro: tauri-nspanel)
- **Frontend:** React 19 + TypeScript estrito + Vite + Tailwind v4 + Zustand
- **Domínio testável:** `src/domain` (TS puro, zero imports Tauri) + `crates/hat-core` (Rust puro, zero deps Tauri)

## Comandos

```bash
npm install            # dependências do frontend

npm test               # Vitest — domínio TS (roda em CI, sem shell nativo)
npm run test:coverage  # com gate de cobertura (60% lines/branches)

cd src-tauri
cargo test -p hat-core # testes do domínio Rust (roda em CI)
cargo check            # type-check do shell completo

npm run tauri dev      # app em modo dev (macOS/Windows)
npm run tauri build    # bundle de release
```

## Regras de arquitetura

1. `src/domain/**` não importa `@tauri-apps/*` — lógica pura, testável.
2. `crates/hat-core` não depende de tauri/objc2/windows-sys.
3. Stores/serviços dependem da interface `NativeBridge` (`src/bridge/native.ts`); testes usam `createMockBridge()`.
4. Adapters (commands/eventos Tauri, `bridge/tauri.ts`) são finos: lógica condicional desce para o domínio.
5. `fixtures/*.json` são compartilhadas entre as suites TS e Rust (paridade dual-OS) — alterou a fórmula, atualize fixture + os dois lados.

## Atalhos globais (defaults)

| Binding | Ação |
|---|---|
| `CommandOrControl+Shift+F` | Clipboard → IA → Flash |
| `CommandOrControl+Alt+F` | Ajustar posição do Flash |
| `CommandOrControl+Shift+Q` | Fechamento de emergência (100% nativo) |

## Backend

Reutiliza a infraestrutura existente: `hat-proxy` (Cloudflare Worker, IA + créditos), Firebase Auth/Firestore (salas em realtime), billing worker Stripe. A URL do proxy aceita override por `HAT_PROXY_URL` (testes de integração).
