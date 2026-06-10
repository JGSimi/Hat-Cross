# Hat v2 — Status do Rebuild

**Atualizado:** 2026-06-10

## Pronto e verificado (CI-green)

| Camada | Estado | Evidência |
|---|---|---|
| Documentos de planejamento | ✅ | `00`–`03` neste diretório |
| Scaffold `apps/hat` (Tauri v2 + React 19 + Vite + Vitest) | ✅ | `npm run build` OK (~187 kB JS) |
| Workspace Rust + crate `hat-core` puro | ✅ | `cargo check` limpo |
| Domínio Rust: SSE, accelerator, flash, error | ✅ | 22 testes (`cargo test -p hat-core`) |
| Domínio TS: clipboard pipeline, flash timing, accelerator, stream assembler, settings | ✅ | parte dos 198 testes Vitest |
| Salas: tipos, merge, consenso, roomStore, client (join idempotente) | ✅ | idem |
| Orquestrador `clipboardFlow` (atalho→clipboard→stream) | ✅ | 10 testes com MockBridge |
| Auth: `TokenManager` (refresh proativo + dedupe concorrente) e `AuthPort` | ✅ | 6 testes com relógio falso; ligado ao `MainPage` |
| `settingsStore` (migração + tema no DOM + rebind validado com rollback se o nativo rejeitar) | ✅ | 5 testes com portas falsas |
| **UI das salas** — rail vertical, RoomList, RoomJoinModal (custo 800 + saldo + consentimento de privacidade), sala ativa (feed de entries + painel de consenso + ticker de notificações), demo local sem rede | ✅ | 12 testes de componente + verificação visual no preview |
| **Auth Firebase real** — `oauth.rs` (loopback one-shot + PKCE, 5 testes), `pkce.ts` (vetor RFC 7636), `services/auth/firebase.ts` implementando `AuthPort` (`signInWithCredential` + `getIdTokenResult` → TokenManager), barra de sessão entrar/sair na MainPage; credenciais em `apps/hat/.env.local` (gitignored) | ✅ código | login real pendente de teste manual (abre browser do usuário) |
| FlashPage (render + stream + auto-hide) | ✅ | 5 testes de componente |
| Shell nativo: atalhos Rust-side, flash pré-aquecido topmost/click-through, clipboard texto+imagem, tray sem Dock, emergency quit nativo | ✅ compila | `cargo check` |
| Cobertura domínio | ✅ 97,8% | gate 60% folgado |
| CI (`hat-v2-ci.yml`): TS+typecheck, Rust+clippy, matrix macOS/Windows, gate de arquitetura | ✅ | `.github/workflows/` |

**Paridade dual-OS** garantida por fixtures compartilhadas TS↔Rust (`fixtures/accelerator-cases.json`, `fixtures/flash-timing-cases.json`) — o mesmo caso roda nas duas suítes.

### Prova nativa ao vivo (macOS, 2026-06-10)

`cargo tauri dev` rodando, com **TextEdit em foco** (app Hat em background, janela principal oculta):

- ✅ **Atalho global sem foco** — `Cmd+Shift+F` disparou `ProcessClipboardFlash` com o TextEdit à frente (log `[hat-debug] atalho disparou`). Este era o problema nº1 do Wails.
- ✅ **Leitura de clipboard** — `clipboard lido: vazio=false`.
- ✅ **Janela flash visível e topmost** — `is_visible=true`, URL `…/index.html#/flash`, confirmada visualmente pelo usuário no canto superior esquerdo; card escuro "Processando…" com aparência stealth correta.

Nota de captura: o binário de dev (`cargo run`) não tem `.app`/bundle id que o filtro de screenshot do macOS reconheça, então a janela é invisível em capturas automatizadas mas perfeitamente visível ao usuário. Para QA com captura, usar build empacotado (`cargo tauri build` → `com.hatcross.hat`).

### Prova de auth + fluxo completo (macOS, 2026-06-10)

- ✅ **Login Google real** — OAuth loopback (`oauth_run_loopback_flow`) abre o browser, retorna o code, `signInWithCredential` no Firebase; sessão persiste (IndexedDB).
- ✅ **Flash de ponta a ponta** — `Cmd+Shift+F` → clipboard → hat-proxy → stream de volta no card. O pipeline inteiro funciona; o erro observado (`429 RESOURCE_EXHAUSTED` / "prepayment credits depleted") é **billing do Gemini no Google AI Studio** (créditos da chave que o hat-proxy usa), não bug do app. Recarregar em ai.studio destrava respostas reais.
- 🔧 Ajustes pós-teste: flash agora traduz `error:*` do proxy para mensagem limpa em pt-BR (em vez do JSON cru); tela de Salas distingue "conecte sua conta" (deslogado) de "backend em breve" (logado).
- ⏳ **Salas reais** ainda dependem do backend (rotas `/v1/rooms` no Worker + Firestore, M5) — a UI completa é navegável via demonstração local.

## Próximas fases (precisam de credenciais / hardware real)

1. ~~Adaptador Firebase concreto~~ — ✅ feito (ver tabela). **Falta validar manualmente:** clicar "entrar com google →" no app, completar o consentimento no browser, e então provar o flash de ponta a ponta (Cmd+Shift+F com clipboard → resposta real do hat-proxy no card).
2. **Prova manual nativa (M4 do plano TDD)** — checklist de release por SO: atalho sem foco, topmost sobre fullscreen, clipboard imagem real, emergency quit com renderer travado, medir p95 < 800 ms. Exige rodar `cargo tauri dev` em macOS e Windows reais.
3. ~~UI das salas~~ — ✅ feita (ver tabela acima). Falta ligar ao backend real: `RoomsPanel` recebe `client`/`credits`/`myUid` por props — quando a auth existir, `MainPage` injeta o `RoomsClient` real e os listeners Firestore alimentam o store.
4. **Worker de salas (M5)** — rota `POST /v1/rooms/:id/join` com transação atômica + testes no emulador Firestore; rules de membership.
5. **Updater + assinatura** — `tauri-plugin-updater` com artefatos assinados; notarização macOS / Azure Trusted Signing.
6. **Upgrade do overlay macOS** — avaliar troca do bridge `objc2` por `tauri-nspanel` (painel não-ativante de verdade); fallback atual documentado no ADR-001.

## Comandos

```bash
cd apps/hat
npm test                                    # 198 testes
npm run test:coverage                       # gate 60%
cd src-tauri && cargo test -p hat-core      # 22 testes
cargo tauri dev                             # rodar o app (precisa npm i feito)
```
