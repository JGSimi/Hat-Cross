# Hat v2 — Plano TDD e Milestones

**Status:** Ativo · **Data:** 2026-06-09 · Arquitetura em [02-arquitetura.md](02-arquitetura.md)

## 1. Estratégia de teste

Pirâmide adaptada a app desktop com shell nativo:

| Camada | Ferramenta | Roda em CI? | O que cobre |
|---|---|---|---|
| Domínio TS (`src/domain`, stores) | Vitest + jsdom + RTL | ✅ sempre | máquinas de estado, reducers, normalização, schema |
| Domínio Rust (`hat-core`) | `cargo test` | ✅ sempre | parser SSE, accelerator, fórmulas do flash, mapa de erros |
| Adapters | — (finos por regra) | — | sem lógica; revisão de código |
| Integração nativa | checklist manual + smoke build por SO | matrix em tag | atalho sem foco, topmost, clipboard real |
| Worker (salas/billing) | Vitest + emulador Firestore | ✅ quando rota existir | transação 800 créditos: retry, concorrência, saldo |

Regra de ouro herdada (C8 do PRD): **build passando ≠ feature funcionando** — toda entrega nativa anexa evidência de runtime (gravação/print).

## 2. Ciclo

Red → Green → Refactor estrito no domínio. Testes nomeiam comportamento (`"não debita duas vezes em join repetido"`), não implementação. Sem mock pesado: stores usam `bridge/mock.ts` (fake honesto), nunca mock de Zustand.

## 3. Ordem de implementação (cada item = testes primeiro)

### M0 — Scaffold (sem TDD; infraestrutura)
- `apps/hat` com Vite/Vitest/Tailwind/TS estrito; `src-tauri` workspace com `hat-core`.
- `npm test` e `cargo test -p hat-core` verdes (suites vazias de sanidade).
- Janelas main+flash declaradas, tray mínimo, capabilities mínimas.

### M1 — Núcleo de domínio TS
1. `domain/shortcuts/accelerator` — parse/format, paridade Cmd≡Ctrl (`CommandOrControl`), validação de binding, captura por `event.code`, colisões.
2. `domain/flash/timing` — `holdMs = clamp(1800, len*34, 6500)`; fade in/out; clamp de posição em bounds de monitor.
3. `domain/clipboard/pipeline` — máquina de estados `idle → reading → flashing(processing) → streaming → done | error`; texto-primeiro-depois-imagem; eventos de retry no Windows.
4. `domain/stream/assembler` — montagem de chunks SSE já parseados, extração tolerante de `<thoughts>`, mapa de erros (401→reauth, 402→insufficientCredits, 429→rateLimit, 5xx→backend).
5. `domain/settings/schema` — defaults, migração da chave legada `clipboard` → `processClipboardFlash`, round-trip serialize.

### M2 — Núcleo de domínio Rust (`hat-core`)
1. `sse` — porte de `drain_lines` com os testes legados + novos: multi-byte UTF-8 quebrado entre chunks, CRLF, `data:` malformado, `[DONE]`.
2. `accelerator` — normalização dual-OS espelhando o módulo TS (mesmos casos de teste, fixture compartilhada em JSON).
3. `flash` — mesma fórmula de hold do TS (fixture compartilhada garante paridade).
4. `error` — status HTTP → código de erro estável.

### M3 — Salas (domínio + store)
1. `domain/rooms/merge` — upsert de entries sem duplicar (por id), ordenação, cluster attach.
2. `domain/rooms/consensus` — render de consenso/divergência por `answerType` (multiple_choice maioria ponderada; numeric mediana; short_text por cluster; open_text só divergência, nunca "errado").
3. `stores/roomStore` — `setActiveRoom`, `upsertRoom`, `upsertEntry`, `markNotificationRead`; integração com `NativeBridge` mock.
4. `services/rooms/client` — `createRoom`, `joinRoom` (com `Idempotency-Key`), `leaveRoom`; contrato HTTP testado contra fetch fake.

### M4 — Shell nativo (adapters + smoke manual)
1. `shortcuts.rs` — registro no setup, re-registro dinâmico (`unregister(old)→register(new)→rollback em Err`), emergency quit 100% Rust.
2. `flash_window.rs` — nspanel no macOS; reaplicação idempotente de flags no Windows; comando `flash_enter_adjust_mode`.
3. `clipboard.rs` — `ClipboardPort` + retry; imagem → base64 PNG.
4. `stream.rs` — task com cancelamento por registry + `Drop` guard; URL configurável.
5. **Checklist de prova manual por SO** (gate de release): atalho sem foco ✓, topmost sobre fullscreen ✓, clipboard imagem real ✓, emergency quit com renderer travado ✓, p95 < 800 ms medido ✓.

### M5 — Worker de salas (backend)
1. Rota `POST /v1/rooms/:id/join` — transação única; testes com emulador: saldo < 800, join duplicado, retries concorrentes, `Idempotency-Key` repetido.
2. Rules Firestore — testes com `@firebase/rules-unit-testing`: não-membro não lê entries.
3. Pipeline de consenso no Worker (clustering + extração estruturada).

## 4. Gates de CI

- Vitest coverage ≥ 60% lines+branches (gate G6 herdado).
- `cargo test -p hat-core` + `cargo clippy -- -D warnings`.
- Lint gate: import de `@tauri-apps/*` proibido em `src/domain/**`.
- Grep gate de paywall na UI (`upgrade|unlock|paid`) = 0 (G9 herdado).

## 5. Paridade dual-OS como contrato de teste

- Fixtures compartilhadas TS↔Rust (JSON em `fixtures/`) para accelerator e flash timing — o mesmo caso roda nas duas suites.
- Casos de teste sempre em pares (`darwin`/`win32`) nos módulos com branch por plataforma.
- Screenshot tests do FlashPage por SO no matrix de release (WKWebView vs WebView2).
