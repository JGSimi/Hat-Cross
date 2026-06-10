# Hat v2 — Visão de Produto (Rebuild)

**Status:** Ativo · **Owner:** João Simi · **Data:** 2026-06-09
**Contexto:** Rebuild completo da tentativa "Hat Flash" (Wails v3), que falhou por limitações arquiteturais do framework (ver [01-adr-stack.md](01-adr-stack.md)).

---

## 1. O que é o Hat

Assistente de IA **stealth** que vive na barra de menus (macOS) / bandeja do sistema (Windows). O usuário copia qualquer coisa (texto ou imagem), aperta um atalho global, e a resposta da IA "pisca" discretamente na tela — sem janela ganhando foco, sem notificação do sistema, sem aparecer no Dock/taskbar.

## 2. Pilares (em ordem de prioridade)

### P1 — Atalhos globais que SEMPRE funcionam
O contrato inegociável: `Cmd/Ctrl+Shift+F` dispara o processamento do clipboard **com o app totalmente em segundo plano**, sem janela visível, sem foco. Falhou na tentativa Wails — é o motivo nº 1 do rebuild.

| Atalho padrão | Ação |
|---|---|
| `Cmd/Ctrl+Shift+F` | Ler clipboard → IA → mostrar no Flash |
| `Cmd/Ctrl+Alt+F` | Modo de ajuste de posição do Flash |
| `Cmd/Ctrl+Shift+Q` | Fechamento de emergência (100% nativo, funciona mesmo com webview travada) |

Atalhos são editáveis pelo usuário (re-registro dinâmico), com paridade semântica Cmd≡Ctrl entre macOS e Windows.

### P2 — Flash: overlay discreto e instantâneo
Janela frameless, transparente, click-through, **sempre topmost** (inclusive sobre apps fullscreen no macOS), que mostra a resposta da IA e some sozinha.

- **p95 trigger→primeiro paint < 800 ms** (meta interna: < 150 ms para o estado "processando"; a resposta da IA streama no card já visível).
- Posição configurável pelo usuário (modo de ajuste via atalho), persistida.
- Hold time proporcional ao tamanho do texto: `max(1800, min(6500, len*34))` ms (fórmula herdada e validada).
- Stealth **físico** (olhos a 1,5 m), não anti-gravação: `setContentProtected(true)` aplicado como defense-in-depth (funciona no Windows via `WDA_EXCLUDEFROMCAPTURE`; no macOS 15+/26 o ScreenCaptureKit ignora — limitação da Apple, documentada, idêntica em qualquer framework).

### P3 — Processamento de clipboard
- Texto primeiro (rápido); fallback para imagem (PNG) se não houver texto.
- Retry de leitura no Windows (3×60 ms) para vencer a corrida de ownership logo após Ctrl+C.
- Envio ao `hat-proxy` (Cloudflare Worker) com token Firebase + `Idempotency-Key`; resposta via SSE streaming.
- Leitura de clipboard **somente em gesto do usuário** (atalho) — nunca polling em background (compatível com Pasteboard Privacy do macOS 15.4+).

### P4 — Salas (rooms) com consenso de IA
Salas colaborativas de questionário (modelo completo em [../plan-salas-questionario.md](../plan-salas-questionario.md)):

- Entrada custa **800 créditos**, debitados server-side em transação atômica e idempotente (doc ID determinístico `rooms/{id}/members/{uid}` = chave de idempotência).
- Perguntas enviadas à IA com `roomShare=true` viram entries compartilhadas na sala.
- Backend agrupa perguntas semelhantes em clusters, extrai resposta estruturada, calcula consenso e notifica divergências ("sua resposta diverge do grupo", nunca "errado").
- Realtime via Firestore `onSnapshot`; escritas com custo de crédito passam exclusivamente pelo hat-proxy.
- V1 compartilha só texto de pergunta + resposta final. Sem imagens, sem clipboard bruto, sem histórico.

### P5 — App de bandeja de verdade
- Tray/menubar com menu; **sem ícone no Dock** (macOS `ActivationPolicy::Accessory`) / `skipTaskbar` (Windows).
- Autostart no login, auto-update assinado via GitHub Releases.
- Janela principal (chat, salas, configurações) abre a partir do tray.

## 3. Personas (herdadas do PRD congelado)

- **Rafa (primário)** — dev BR em entrevistas ao vivo. Stealth físico + latência do flash são o produto.
- **Kat (secundária crítica)** — dev Windows; paridade Win/macOS é contratual: mesmo atalho, mesmo layout, mesmo comportamento.
- **Luiza (secundária estratégica)** — design engineer; identidade visual (mascote, temas livres sem paywall) gera divulgação orgânica.

## 4. Backend existente (reutilizado, não reescrito)

| Serviço | Papel |
|---|---|
| `hat-proxy` (CF Worker) | Proxy de IA (envia só `mode: hat\|hat-pro`), créditos, futuras rotas de salas |
| Firebase Auth | Login Google via navegador externo (loopback OAuth) + `signInWithCustomToken` |
| Firestore | Dados de salas em realtime, saldo de créditos |
| Billing Worker (Stripe) | Assinaturas Go/Pro/Ultra (já existe em `apps/hat-flash/billing-worker`) |

## 5. Requisitos não-funcionais herdados

- **NF1:** p95 flash trigger→render < 800 ms (dual-OS).
- **NF2:** cold start < 1500 ms macOS / < 2000 ms Windows.
- **NF3:** bundle < 15 MB (.dmg) / < 12 MB (instalador Windows).
- **NF4:** RAM idle < 180 MB agregado.
- **NF8:** segredos nunca em `localStorage`/JSON plano.
- **NF10:** semântica de atalhos idêntica dual-OS.
- **i18n:** pt-BR canônico, en fallback.

## 6. Fora de escopo do rebuild V1

1. Anti-screen-recording no macOS 15+ (impossível por decisão da Apple — documentado).
2. Popover de chat stealth com DisguiseClock (V1.1 — o shell já prevê a janela).
3. Telemetria remota (privacy-first; métricas locais).
4. Linux (arquitetura não impede; validação fica para depois).
5. 70 temas completos (V1 entrega o sistema de tokens + tema padrão; presets migram em lote depois).
6. Compartilhamento de imagens nas salas.

## 7. Critérios de aceite do rebuild

- [ ] Atalho global dispara com app sem foco, sem janela visível, recém-bootado — nos dois SOs.
- [ ] Flash aparece topmost sobre app fullscreen (macOS Spaces) e sobre janelas maximizadas (Windows), sem roubar foco.
- [ ] Clipboard texto + imagem processados de ponta a ponta (atalho → flash com resposta).
- [ ] Fechamento de emergência funciona com a webview congelada (handler 100% Rust).
- [ ] Join de sala debita 800 créditos exatamente uma vez sob retry/concorrência (testes com emulador Firestore).
- [ ] `npm test` + `cargo test -p hat-core` verdes em CI sem shell nativo.
- [ ] Cobertura ≥ 60% lines/branches no domínio TS (gate herdado do PRD, G6).
