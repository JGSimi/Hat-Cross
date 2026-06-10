# Pivot — Salas + Flash (sem chat, assinatura única)

**Status:** Ativo · **Data:** 2026-06-10 · Decisões travadas com o owner.

## A ideia central (nova)

O Hat não é mais um assistente de chat. São **dois pilares**:

1. **Salas** — grupos fazendo a mesma prova/questionário. Cada membro, ao travar numa questão, copia o enunciado e aciona o **Flash**: a IA responde discretamente, e essa resposta vira a **entry** do usuário na sala.
2. **IA-juiz da sala** — compara as perguntas/respostas dos membros (agrupadas por questão), apura a **maioria**, **resolve a questão por conta própria** (lê o enunciado + alternativas, decide a correta com confiança) e **notifica via Flash quem errou**: "a resposta para tal questão na verdade é (B)".

> Esse núcleo **já existe** no `hat-proxy`: `recordRoomEntryAndUpdateConsensus` (clusters + consenso) + `judgeRoomDivergence` (Gemini decide a correta) + `buildDivergenceNotifications`. O pivot **não reconstrói a IA** — ele reestrutura cobrança/acesso e a entrega da notificação.

## Decisões (travadas)

| # | Decisão | Escolha |
|---|---|---|
| D1 | Acesso sem assinatura | **Trial grátis** (app-level, sem cartão, 7 dias) com tudo liberado; ao expirar, bloqueia até assinar. |
| D2 | Cobrança | **Plano único: R$ 50/mês, ilimitado.** Sem créditos, sem custo por sala/pergunta. |
| D3 | Entrega da correção | **Badge + Flash sob demanda** — um indicador discreto acumula correções; atalho dedicado mostra a próxima no Flash. (Não faz pop automático.) |
| D4 | Salas | **Grátis** (sem custo de entrada/criação) — gate é só ter trial ativo ou assinatura. |
| D5 | go/pro/ultra + créditos | **Remover** (pré-lançamento, sem migração). |

## Mudanças por repositório

### hat-proxy (Cloudflare Worker)

- **pricing.ts** — `ROOM_JOIN_COST = 0`; remover/ignorar `BRL_TO_CREDITS`, multiplicadores de token e mínimos de crédito como *gate* (podem ficar para telemetria de custo interno, nunca para bloquear).
- **subscriptions.ts** — colapsar `go|pro|ultra` em um único plano `unlimited`. `billingEntitlements`: `entitled = assinatura ativa/trialing OU dentro do trial app-level`. Tudo (AI, salas, hat-pro) liberado quando entitled.
- **firestore.ts** — `ensureUserInitialized` grava `trialStartedAt`/`trialEndsAt` (now+7d) na criação; `createRoom`/`joinRoom` deixam de debitar créditos (só registram membership). `debitCredits` vira no-op opcional (ou só loga custo).
- **index.ts** — remover checagens `credits < X`; gate único `entitled(userDoc)` em `/v1/chat`, `/v1/rooms`, `join`. Manter o caminho de entry+judge intacto.
- **billing.ts** — um único `STRIPE_PRICE_MONTHLY` (R$50); checkout com plano único. (Owner cria o price no Stripe e seta o secret.)
- **firestore.rules** — `notifications`: ler só as do próprio uid (`resource.data.uid == request.auth.uid`) — correção é pessoal.

### hat app (Tauri)

- Remover qualquer resquício de chat (nav CHAT some; foco em SALAS + assinatura).
- **RoomsClient real** ligado (backend existe): `createRoom`/`joinRoom` sem custo; listeners Firestore (`onSnapshot`) alimentam `roomStore` (rooms, entries, clusters, notifications).
- **Correções via Flash sob demanda**: badge com contagem de correções não-lidas; atalho dedicado (ex.: `Cmd/Ctrl+Shift+D`) mostra a próxima correção não-lida no Flash e a marca como lida.
- **Assinatura**: banner de status (dias de trial restantes / assinar) + gate ao expirar (CTA assinar via checkout do Worker).

### hat-admin (Next.js)

- Ajustar gestão para o plano único (sem tiers); telemetria de assinantes/trials.

## Sequência

1. ✅ Plano (este doc).
2. **hat-proxy** — gating (plano único + trial + salas grátis) + tests. Foundation, testável isolado.
3. **hat app** — RoomsClient + correções no flash + paywall + verificação.
4. **hat-admin** — toque leve.

## Regras de negócio da IA da sala (como ela se comporta)

Pipeline por entry (no `hat-proxy`, `recordRoomEntryAndUpdateConsensus` + `judgeRoomDivergence`):

1. **Agrupamento (cluster).** Normaliza a pergunta (sem acentos/pontuação) e agrupa por similaridade de tokens (Jaccard ≥ **0.62**). Mesma questão (mesmo com texto um pouco diferente) cai no mesmo cluster.
2. **Extração da resposta.** De cada `aiAnswer` extrai a alternativa: letra explícita ("alternativa B"), letra isolada, casamento por conteúdo da alternativa (similaridade ≥ 0.72), número, ou texto curto/aberto. Multipla escolha compara **conteúdo**, nunca só a letra.
3. **Maioria.** Conta as respostas equivalentes (numérico arredonda; texto normaliza). A maioria é o consenso provisório.
4. **IA-juiz (só quando há divergência).** Se ≥2 entries e existe divergência, chama o Gemini (temp 0, JSON) passando pergunta + alternativas + respostas: ele **decide a alternativa correta** com `confidence`. Essa resposta **substitui** a maioria como gabarito (a IA pode contrariar a maioria — é o ponto). Falha do juiz → cai de volta na maioria, sem notificar.
5. **Notificação.** Só para quem **divergiu do gabarito confirmado pela IA** (`judgeConfirmed`). Mensagem aponta a alternativa correta — **nunca diz "errado"** (questões abertas não têm gabarito objetivo; o tom é "a resposta é (B)"). Uma notificação por (cluster, entry), idempotente.
6. **Entrega.** A notificação é um doc Firestore lido só pelo próprio uid (rules). O app acumula num **badge** e mostra no **Flash sob demanda** (`Cmd/Ctrl+Shift+D`), FIFO.

Limiares e decisões ficam no `hat-proxy` (`src/rooms.ts`): cluster 0.62, opção 0.72, confiança default 0.6. Textos longos: a pergunta é normalizada e tem `questionPreview` (≤112 chars) para UI; a resposta da IA é guardada inteira em `aiAnswer`.

## Flash discreto + textos longos (app)

- **Quase invisível:** opacidade default **16/100** (piso 0.12 para legibilidade), fundo `rgba(9,9,8,0.35)` — o contraste vem do texto com `text-shadow`, não de um bloco opaco. Só quem sabe a posição percebe. Configurável (`flash.opacity`, 0–100; lido pelo Rust no `show`).
- **Textos longos:** card com `maxWidth: min(92vw,460px)`, `maxHeight: 92vh`, `overflow:hidden`, `overflowWrap:anywhere`; fonte reduz para 12px quando o texto passa de 280 chars. `holdMs` proporcional ao tamanho (até 6.5s).
- **Erros do proxy** viram mensagem limpa em pt-BR (sem JSON cru).

## Instalação e atualização (sem licença de dev)

- **Updater:** `tauri-plugin-updater` com chave **minisign** (própria; reusa a do legado) + `latest.json` no GitHub Releases. Verifica no boot, baixa e instala em background (aplica no próximo start). **Independe de certificado Apple/MS.**
- **1ª instalação:** app não-assinado → aviso de Gatekeeper (macOS: botão direito → Abrir) / SmartScreen (Windows: Executar mesmo assim). Único atrito; documentado no README e na releaseBody.
- **Release:** workflow `Hat (app)` (`.github/workflows/hat-app-release.yml`) por tag `hat-app-v*` builda macOS arm64/intel + Windows, gera artefatos do updater e publica. Legados (`version-bump.yml`, `hat-flash-release.yml`) **desativados** (só `workflow_dispatch`) para não sequestrar o `releases/latest`.

## Status

- ✅ **hat-proxy** — `ROOM_JOIN_COST=0` (salas grátis); plano único `unlimited` com entitlement = assinatura ativa **OU** trial (`trialEndsAt`, 7 dias gravado no 1º login); gate único `entitlementGate` em `/v1/chat`, `/v1/rooms`, `join` (sem checagem de crédito/tier); billing aponta para `STRIPE_PRICE_MONTHLY`; rules: notificações só do próprio uid. **65 testes verdes, typecheck limpo.** Sistema de créditos fica dormente (não bloqueia mais).
- ✅ **hat app** — RoomsClient real (criar/entrar grátis) + listeners Firestore (`subscribeMyRooms`/`subscribeRoom`) → store; clipboard compartilha com a sala ativa; **correções via Flash sob demanda** (`Cmd/Ctrl+Shift+D` + badge); **paywall** (trial/assinar via checkout); Flash discreto + textos longos; sem chat. **245 testes TS verdes**, `cargo check` limpo.
- ✅ **Updater** (`apps/hat/src-tauri/src/updates.rs`) + **release CI** (`hat-app-release.yml`) + legados desativados + README reescrito.
- ⏳ **hat-admin** — toque leve depois (gestão do plano único).

## Ações do owner (config, fora do código)

- **Stripe:** criar o price recorrente **R$50/mês** e setar `wrangler secret put STRIPE_PRICE_MONTHLY` (ou em `[vars]`). Sem ele, o checkout falha com "STRIPE_PRICE_MONTHLY".
- **Deploy do Worker:** `npm run deploy` no `hat-proxy` para publicar as mudanças.
- **Gemini:** recarregar créditos no AI Studio para a IA-juiz responder de verdade (independe deste pivot).
- Trial assumido em **7 dias** (`TRIAL_DAYS` em `subscriptions.ts`).
