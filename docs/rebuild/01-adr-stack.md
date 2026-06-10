# ADR-001 — Stack do Rebuild: Tauri v2

**Status:** Aceito · **Data:** 2026-06-09 · **Decisores:** João Simi (com pesquisa multi-agente, fontes abaixo)

## Contexto

A tentativa "Hat Flash" (Go + Wails v3 + React) falhou em dois requisitos inegociáveis:

1. **Atalhos globais só funcionam com o app em foco.**
2. **O overlay Flash não aparece de forma confiável / não fica topmost.**

Seis commits consecutivos de "fix" (`af36e10`…`dc75001`) não resolveram. A pesquisa upstream explica por quê:

- **Wails v3 não tem atalhos globais de SO por design.** A API `KeyBinding` do v3 despacha a partir do handler de tecla da **janela focada** (`WM_KEYDOWN` no WndProc / key-window events). Não existe `RegisterHotKey`/`RegisterEventHotKey` em lugar nenhum do código do framework; o maintainer recusou implementar ([wails#3112](https://github.com/wailsapp/wails/issues/3112)), e o pedido segue aberto ([wails#5421](https://github.com/wailsapp/wails/issues/5421), mai/2026). O código Carbon/Win32 customizado do app dispara, mas o `InvokeAsync` que faz a ponte para o event loop do Wails não processa de forma confiável com o app em background.
- **NSPanel não-ativante (necessário para overlay que não rouba foco) está num PR parado desde set/2024** ([wails#3760](https://github.com/wailsapp/wails/pull/3760)).
- **Wails v3 continua alpha** (alpha.98 em jun/2026, app usa alpha.94), com breaking changes frequentes (10+ na alpha.79; quebra do sistema de coordenadas macOS na alpha.91).

Conclusão: era luta contra a arquitetura do framework, não bugs corrigíveis.

## Decisão

**Tauri v2 (stable) + Rust**, com os seguintes componentes:

| Preocupação | Escolha | Por quê |
|---|---|---|
| Atalhos globais | `tauri-plugin-global-shortcut` ≥ 2.3.2, registrado **no lado Rust** | Usa `RegisterHotKey` (Win) / Carbon `RegisterEventHotKey` (macOS) — dispara 100% sem foco, sem janela, **sem prompt de Acessibilidade/Input Monitoring**. Conflito de registro vira erro capturável (≥ 2.2.1). Re-registro dinâmico suporta keybindings editáveis. |
| Overlay Flash (macOS) | `tauri-nspanel` (ahkohd, branch v2.1, **pinado por commit**) | `NSPanel` não-ativante (`nonactivatingPanel`), `level(statusBar)`, `collectionBehavior(canJoinAllSpaces \| fullScreenAuxiliary \| ignoresCycle)`. Produção: Cap, Screenpipe, EcoPaste, Overlayed. Fallback documentado: bridge `objc2-app-kit` de ~72 linhas já existente em `src-tauri/src/macos_overlay.rs` (legado). |
| Overlay Flash (Windows) | APIs core do Tauri | `alwaysOnTop` (WS_EX_TOPMOST) + `set_focusable(false)` em runtime (WS_EX_NOACTIVATE) + `setIgnoreCursorEvents(true)` + `setContentProtected(true)` (WDA_EXCLUDEFROMCAPTURE). |
| Clipboard | `clipboard-rs` (ChurchTao, v0.3.x) atrás de um trait `ClipboardPort` | Imagens voltam **PNG-encoded** (payload pequeno no IPC). O plugin oficial devolve RGBA cru — leituras de clipboard UHD levam segundos ([tauri#12007](https://github.com/tauri-apps/tauri/issues/12007)). Trait isola a dependência (troca por `arboard` é mudança de um arquivo). |
| Tray / autostart / update | Tray nativo do Tauri (`TrayIconBuilder`), `tauri-plugin-autostart`, `tauri-plugin-updater` | macOS: `ActivationPolicy::Accessory` (sem Dock — e pré-requisito para overlay em Spaces fullscreen). Ícone via builder, não via conf ([tauri#11931](https://github.com/tauri-apps/tauri/issues/11931)); menu raiz `Menu` plano ([tauri#11363](https://github.com/tauri-apps/tauri/issues/11363)). |
| Frontend | React 19 + TypeScript estrito + Vite + Tailwind v4 (`@theme` CSS-first) + Zustand | Reuso direto do design system (24 tokens), stores e páginas do app legado. |
| Testes | `cargo test` em crate `hat-core` (zero deps Tauri) + Vitest/jsdom em `src/domain` (zero imports `@tauri-apps/*`) | Ambos rodam headless em CI. O `streaming.rs` legado já prova o padrão. |
| Salas | Firestore `onSnapshot` no renderer + hat-proxy para escritas com crédito | Transporte WebChannel sobre HTTPS (não WebSocket) funciona em WKWebView/WebView2; long-polling auto-detect é default desde SDK 9.22. Créditos e membership no MESMO banco ⇒ join de 800 créditos é UMA transação Firestore serializável no Worker — sem two-phase-commit distribuído. |

## Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|---|---|
| **Continuar no Wails v3** | Atalhos globais não suportados por design; NSPanel travado em PR aberto; alpha com churn de API. Os problemas são estruturais. |
| **Wails v3 + `golang.design/x/hotkey`** | Resolve só metade (hotkeys); overlay não-ativante e churn de alpha continuam. Remendar duas lacunas estruturais < framework com ambas resolvidas. |
| **Electron** | Viável, mas sem vantagem decisiva: o gap de stealth no macOS 15+ é idêntico ([electron#31787](https://github.com/electron/electron/issues/31787) ≙ [tauri#14200](https://github.com/tauri-apps/tauri/issues/14200)); `tauri-nspanel` iguala/supera o fullscreen-overlay (painel de verdade não ativa o app). Custos: ~10× bundle (80–200 MB vs < 15 MB exigido pelo NF3), ~5–8× RAM idle em app residente, zero reuso do Rust testado (streaming, overlay, tray). |
| **Nativo duplo (Swift + C#)** | Fidelidade máxima, custo 2× em tudo, joga fora todo o design system React e o Rust testado. Desproporcional para o tamanho do time. |
| **Plugin oficial `clipboard-manager` como única camada** | Sem leitura de imagem eficiente (RGBA cru), sem monitoramento ([plugins-workspace#2582](https://github.com/tauri-apps/plugins-workspace/issues/2582)). |
| **Supabase Realtime (salas)** | Backend inteiro novo (Postgres+RLS) e separa membership (Postgres) de créditos (Firestore) ⇒ recria o problema de transação distribuída que o Firestore-only evita. |
| **Durable Objects como data plane das salas** | Reconstruir de graça o que o Firestore dá (offline cache, resume de listener, replay, rules). Reservado como bolt-on futuro para presence de alta frequência. |

## Consequências

**Positivas**
- Os dois requisitos que mataram a tentativa anterior são first-class e comprovados em produção por apps similares.
- Reuso massivo: `streaming.rs` (parser SSE UTF-8-safe com testes), `macos_overlay.rs`, `tray.rs`, `oauth.rs`, stores React, FlashPage, tipos de salas, vitest setup. O rebuild é um **hardening pass** sobre arquitetura conhecida.
- Bundle e RAM dentro dos NFs herdados.

**Negativas / riscos aceitos**
- `tauri-nspanel` e `clipboard-rs` são crates comunitários → pinados por versão/commit, isolados atrás de traits, com fallback DIY documentado.
- Dois engines de webview (WKWebView/WebView2) → CSS do flash conservador (fundo sólido `#090908` + alpha no card, lição do legado), screenshot tests por SO.
- macOS 15+/26: captura de tela moderna ignora `setContentProtected` → **não anunciar** invisibilidade a gravação no macOS; stealth é físico (decisão já tomada no PRD v1.1).
- Hotkeys não chegam a apps elevados (UIPI) / fullscreen exclusivo no Windows → limitação de SO compartilhada com Electron; documentar. **Não** usar low-level hooks (`SetWindowsHookEx`/rdev): flags de antivírus e anti-cheat não compensam.

## Matriz de risco (resumo)

| Risco | Mitigação |
|---|---|
| p95 < 800 ms estourar | Janela flash **pré-criada e hidden no boot**; caminho do hotkey 100% nativo (callback Rust → lê clipboard → mostra painel → emite evento) antes de qualquer I/O de rede; spans de tracing + teste de integração com budget. |
| Conflito de atalho / layout não-US | Erro capturável no register; manter binding antigo no fallback; captura de keybinding por `event.code` ([tauri#7156](https://github.com/tauri-apps/tauri/issues/7156)); `isRegistered()` após cada registro. |
| Pasteboard Privacy macOS (15.4+) | Leitura só em gesto do usuário; `detectPatterns`/`accessBehavior` antes de ler; onboarding aponta "Paste from Other Apps → Always Allow". |
| Double-charge nos 800 créditos | Transação única no Worker + doc ID determinístico + header `Idempotency-Key`; testes com emulador Firestore (retry, concorrência, saldo insuficiente). |
| Token Firebase expira no meio | Wrapper `getIdToken(forceRefresh)` com refresh proativo; 401 → fluxo de re-auth, nunca stream morto (gap conhecido do legado). |

## Fontes principais

- Wails: [#3112](https://github.com/wailsapp/wails/issues/3112), [#5421](https://github.com/wailsapp/wails/issues/5421), [PR #3760](https://github.com/wailsapp/wails/pull/3760)
- Tauri: [plugin global-shortcut](https://v2.tauri.app/plugin/global-shortcut/), [tauri-nspanel](https://github.com/ahkohd/tauri-nspanel), [#14200](https://github.com/tauri-apps/tauri/issues/14200), [#12007](https://github.com/tauri-apps/tauri/issues/12007), [#11566](https://github.com/tauri-apps/tauri/issues/11566), [#11931](https://github.com/tauri-apps/tauri/issues/11931), [#11363](https://github.com/tauri-apps/tauri/issues/11363), [#7156](https://github.com/tauri-apps/tauri/issues/7156)
- Electron (comparativo): [#31787](https://github.com/electron/electron/issues/31787)
- Firestore: [long-polling auto-detect PR #7236](https://github.com/firebase/firebase-js-sdk/pull/7236), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [rules-conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- Clipboard: [clipboard-rs](https://github.com/ChurchTao/clipboard-rs)
- Relatório completo da pesquisa: saída do workflow `hatflash-rebuild-discovery` (sessão 2026-06-09).
