# Hat-Cross Design System

> Fonte de verdade para tokens, componentes e padrões da UI. Tauri v2 + React 19 + Tailwind v4 CSS-first. Zero shadcn/Radix.

---

## 0. Context & principles

**Por quê.** Luiza (design) pede consistência; João (eng) pede escala — 70 temas em `THEME_PRESETS` (`src/types/index.ts`) redefinem ~60 vars duplicadas entre `@theme{}` e `:root{}` em `src/index.css` (2.972 linhas, **I16**); Kat (dual-OS) pede paridade — CSS-only é a única via sustentável. Este doc é o contrato que `tailwindcss-advanced-design-systems` executa em S1.T4.

**5 princípios.**
1. **Stealth-first.** Se revela o Hat em screen-share, errou. Disguise é default; reveal é intenção explícita.
2. **Identidade visual presente.** `HorseLogo` é personagem (empty, unlock, stream, reveal) — não ornamento (**decisão estratégica #4**).
3. **Tailwind v4 CSS-first.** `@theme{}` é fonte única — tokens viram utilities automáticas. Zero lib UI runtime.
4. **Accessible by default.** AA 4.5:1 texto / 3:1 UI, `:focus-visible` sempre, `useReducedMotion()` honrado.
5. **Glass+dark default, claros first-class.** `ice`, `porcelain`, `paper` passam pelo mesmo pipeline que `noir`, `matrix`.

---

## 1. Tokens

Primitivas em `tokens.css`, temas em `src/styles/themes/{name}.css` (alvo pós-**I16**). Cada tema redefine só o semântico.

### 1.1 Color tokens (24 semânticos)

| Token | `dark-default` | `ice` (claro) | Uso | Consumidores |
|---|---|---|---|---|
| `--surface-base` | `#0C0C0E` | `#F4F6FA` | fundo da janela | `MainLayout`, `PopoverChat`, `FlashPage` |
| `--surface-primary` | `#1C1C1E` | `#FFFFFF` | cards, painéis | `ConversationItem`, `SettingsPanel` |
| `--surface-secondary` | `rgba(255,255,255,.055)` | `rgba(12,14,20,.04)` | input bg, hover sec | `InputArea`, `ClipboardCard` |
| `--surface-elevated` | `rgba(255,255,255,.08)` | `#FFFFFF`+shadow | modais, popovers | `ThemeUnlockCelebration`, `RechargeModal` |
| `--surface-overlay` | `rgba(0,0,0,.55)` | `rgba(12,14,20,.35)` | scrim de modal | `OnboardingWizard` |
| `--surface-row-hover` ⚠ novo | `rgba(255,255,255,.06)` | `rgba(12,14,20,.05)` | hover de linha (**I5**) | `ConversationItem`, `ClipboardCard` |
| `--text-primary` | `#EEEEF0` | `#0F1115` | corpo, títulos | todas |
| `--text-secondary` | `#C7C7CC` | `#3D4250` | metadata, hints | `MessageBubble` timestamp |
| `--text-muted` | `#9E9EA5` | `#6B7080` | placeholders | `InputArea` |
| `--text-accent` | `#818CF8` | `#4F46E5` | links | markdown, `Toast` action |
| `--text-on-accent` | `#FFFFFF` | `#FFFFFF` | texto em accent bg | user bubble, CTA |
| `--text-inverted` | `#0C0C0E` | `#FFFFFF` | contraste oposto | tier badges |
| `--border-subtle` | `rgba(255,255,255,.07)` | `rgba(12,14,20,.06)` | divisores | todos cards |
| `--border-default` | `rgba(255,255,255,.10)` | `rgba(12,14,20,.10)` | inputs, botões sec | `InputArea` |
| `--border-interactive` | `rgba(255,255,255,.18)` | `rgba(12,14,20,.14)` | hover de card | `ThemePicker` swatch |
| `--border-focus` | `rgba(99,102,241,.5)` | `rgba(79,70,229,.55)` | `:focus-visible` global (**I15**) | tudo |
| `--accent-default` | `#6366F1` | `#4F46E5` | CTA, user bubble | `MessageBubble`, `ModePicker` |
| `--accent-hover` | `#818CF8` | `#6366F1` | hover de CTA | primários |
| `--accent-pressed` | `#4F46E5` | `#4338CA` | active | primários |
| `--accent-muted` | `rgba(99,102,241,.15)` | `rgba(79,70,229,.10)` | bg suave | user bubble border |
| `--state-success` | `#34C78C` | `#0F9D58` | unlock, copy ok | `Toast success` |
| `--state-warn` | `#F2B140` | `#D97706` | cooldown, rate-limit | `Toast warn` |
| `--state-error` | `#EF6363` | `#DC2626` | falha, retry | `Toast error`, `State error` |
| `--state-info` | `#60A5FA` | `#2563EB` | dicas | `Toast info`, `OnboardingWizard` |

**Por quê semântico.** Hoje `MessageBubble.tsx:66` deriva borda com `color-mix(in srgb, var(--color-accent) 20%, transparent)` — quebra em temas claros porque 20% sobre fundo claro ≠ 20% sobre escuro. Token explícito (`--accent-muted`) deixa o tema decidir — princípio #3.

### 1.2 Radius

`xs` 4 (chips) · `sm` 8 (`Toast`, copy) · `md` 12 (`Card`, `ConversationItem`, `DisguiseClock`, `InputArea`) · `lg` 16 (`MessageBubble`, swatches) · `xl` 20 (modais) · `full` 9999 (pills, avatares). Hard-code (`borderRadius:12`) banido — **L1**.

### 1.3 Spacing (4px-based)

`xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `2xl` 32 · `3xl` 48. xs/sm = gap interno. md = padding default. lg = padding de janela. xl+ = seções.

### 1.4 Typography

**Families.** `--font-body` = `'General Sans', system-ui` (pt-BR, 13.5) · `--font-mono` = `'JetBrains Mono'` (tier names, code, fallback do `DisguiseClock`) · `--font-display` = General Sans w200, `letter-spacing:-2px` (saldo, relógio).

**Sizes.** `xs` 11 · `sm` 12 · `base` 13.5 · `lg` 15 · `xl` 18 · `2xl` 22 (`EmptyState` greeting) · `display` 34 (saldo, `DisguiseClock`).

**Weights.** 300/400/500/600/700. Peso 200 só em `--font-display`.

### 1.5 Motion

`--duration-fast` 120ms (hover/focus/copy) · `base` 200ms (dropdown, tema swap) · `slow` 400ms (modal, reveal sustained) · `reveal` 600ms (tier unlock, first paint). `--ease-out` = `cubic-bezier(.16,1,.3,1)`; `--ease-spring` = framer `{stiffness:260, damping:24}` (entrada de `MessageBubble`, `Toast`, pill).

**Reduced motion.** `useReducedMotion()` colapsa para `duration:0`. Feito em `ModeSelector.tsx:17`; falta em `MessageBubble`, `DisguiseClock`, `ThemeUnlockCelebration`.

### 1.6 Elevation/blur

`--shadow-0/1/2/3` (nenhuma, card default, hover/popover, modal). Blur `sm` 8 · `md` 16 · `lg` 24. Fallback obrigatório se `data-perf="performance"` — substituir por surface sólido.

---

## 2. Component documentation

### 2.1 HorseLogo (`src/components/Shared/HorseLogo.tsx`)

**Overview.** Mascote e âncora de identidade (**princípio #2**, **decisão #4**). Substitui ícone genérico do Lucide onde marca precisa aparecer.

**Anatomy.** SVG (`src/assets/horse-logo.svg`) aplicado como `mask-image` sobre `<div>` — permite pintar com qualquer token sem reabrir SVG. Partes: `ear`, `mane`, `eye`, `body`. Props: `size`, `animated`, `color`, `className`.

**Variants.** `idle` (estático, accent) · `thinking` (`animated=true`, gradient shift 4s — usado em `EmptyState:37` e planejado para `ThinkingBlock`) · `celebrating` (jump+sparkles, para `ThemeUnlockCelebration` e `Toast credit`) · `stealth` (opacity .4, reveal do `DisguiseClock`).

**Usage.** `EmptyState`, `ToastContainer` `credit`, `ThinkingBlock`, `DisguiseClock` reveal, `ThemeUnlockCelebration`.

**Do.** Envolver em `AnimatePresence layoutId="horse"` em transições entre janelas. Respeitar `useReducedMotion` (`animated=false` se reduzido). Usar prop `color` em tiers onde accent quebra contraste.

**Don't.** Animação contínua fora de states discretos (drena bateria em menu bar). Aparecer em janela stealth visível (só em reveal). Desenhar SVG inline no JSX — sempre via mask.

**A11y.** Decorativo: `aria-hidden="true"`, `role="presentation"`. Conteúdo: `role="img"` + `aria-label="Mascote do Hat comemorando"`.

---

### 2.2 State (novo primitivo)

**Overview.** Consolida `EmptyState`, `ClipboardEmptyState` e spinners ad-hoc. Princípio defense-in-depth: mensagem vazia sem estrutura é bug latente. Arquivo-alvo: `src/components/Shared/State.tsx` (tarefa **#16**).

**Anatomy.** `icon` ou `<HorseLogo>` · `title` (sempre) · `body` (sempre) · `action` opcional · `secondary` opcional.

**Variants.** `empty` (`HorseLogo` animated, tom convidativo) · `loading` (spinner/skeleton + body explicando o quê) · `error` (`AlertTriangle`, `--state-error`, action retry obrigatória, body explica por quê) · `locked` (`Lock`, preview de tema bloqueado mostrando custo + ETA "faltam ~N mensagens").

**Usage.** `Sidebar` sem conversas, `ChatWindow` inicial, `ClipboardHistory` vazio, `ThemePicker` swatch bloqueado, `MessageList` falha de stream.

**Do.** `title + body` sempre. Variants consomem `--state-*` direto. Action só quando há recuperação real.

**Don't.** Aninhar `State` dentro de `State`. Usar `error` para falha crítica de rede (isso é `ErrorBanner` sticky). Spinner sem título.

**A11y.** `loading`/`empty`: `role="status"` + `aria-live="polite"`. `error`: `role="alert"` + `aria-live="assertive"`. `locked`: `role="region"` + `aria-disabled="true"`.

---

### 2.3 ToastContainer + Toast (`src/components/Shared/ToastContainer.tsx`)

**Overview.** Feedback ephemeral pós-ação, bottom-right stack, max 3 simultâneos.

**Variants.** `info` (4s) · `success` (3s) · `warn` (6s, shake entrada) · `error` (**sem auto-dismiss**, shake forte) · `credit` ⚠ novo (celebra unlock — `HorseLogo` celebrating à esquerda, glow pulsante `--accent-default`, 5s, link "Ver tema").

**Anatomy.** Icon 16px Lucide (ou `HorseLogo` em `credit`) · title bold · body opcional 2 linhas · action opcional · close (obrigatório em `error`). `--radius-sm`, `--shadow-3`, `backdrop-blur-lg`.

**Usage.** Copy confirmação, falha de API com retry, online/offline, tier unlock (`credit`), cooldown de troca de tema (`warn`).

**Do.** Hierarquia: `error` mais alto, shake. `credit` com glow pulsante. Queue: 4º toast derruba mais antigo.

**Don't.** Mais de 3 simultâneos. Toast para ação destrutiva (use modal). Toast sem ícone.

**A11y.** `role="status"` + `aria-live="polite"` para info/success/credit. `role="alert"` + `aria-live="assertive"` para warn/error. Container `aria-atomic="true"`. Close `aria-label="Descartar"`.

---

### 2.4 ThemePicker (`src/components/Settings/ThemePicker.tsx`)

**Overview.** Grid de 70 temas com swatches + lock state, progressão por créditos (`free`/`spark`/`glow`/`ember`...). Grid em vez de lista porque densidade visual > scroll infinito — princípio #1 (stealth = rápido).

**Anatomy.** `role="radiogroup"` externo · `grid-cols-[repeat(auto-fill,minmax(84px,1fr))]` · swatch = preview de `bgPrimary+bgSecondary+primary` · tier badge superior-direito · lock overlay quando `tier > unlocked` · tooltip com custo + ETA.

**Variants.** `default` (unlocked, hover eleva com `--border-interactive`) · `locked` (`Lock` overlay, cursor help, tooltip com custo) · `active` (`Check`, borda `--accent-default` 2px, `--shadow-2`).

**Usage.** Settings → "Aparência & Temas" (pós-**decisão #5**, de 7 cards para 3 seções).

**Do.** View Transitions <100ms + cooldown 1200ms (`COOLDOWN_MS` em `ThemePicker.tsx:27`). Teaser 3 próximos bloqueados (`TEASER_LOCKED_COUNT`). Tooltip com ETA calculada.

**Don't.** Bloquear IA por tier (**decisão #1**). Mostrar paywall — tiers são progressão lúdica. Permitir troca durante cooldown.

**A11y.** `role="radiogroup" aria-label="Tema visual"`. Cada swatch `role="radio" aria-checked aria-disabled={isLocked}`. Arrow keys navegam. Tooltip via `aria-describedby`.

---

### 2.5 MessageBubble (`src/components/Chat/MessageBubble.tsx`)

**Overview.** Container de mensagem no chat. Dívida pesada atual: inline styles, borda esquerda com `color-mix` hardcoded, copy button com `opacity: 0.35` (**I3**).

**Variants.** `user` (direita, bg `--accent-muted`, `--radius-lg` com `borderBottomRightRadius: --radius-xs`) · `assistant` (esquerda, sem bg, borda esquerda 2px `--accent-muted`, padding-left 14) · `streaming` (assistant + cursor piscante, `aria-live="polite"`) · `error` (assistant + borda `--state-error`, action retry).

**Anatomy.** Avatar opcional · content (`ReactMarkdown` + `remarkGfm` + `rehypeHighlight`) · metadata (timestamp, copy, regenerate) · `ThinkingBlock` acima quando `message.thinking`.

**Usage.** `MessageList` (main) e `PopoverChat` (flash).

**Do.** Action buttons **sempre visíveis** — resolve **I3** (não esconder via opacity 0.35→1 no hover). `aria-live` streaming. Skeleton 3 linhas pré-primeiro chunk. `memo` custom já implementado (linhas 110-115).

**Don't.** Animar chunk-a-chunk (perf). `opacity` para esconder ação. Duplicar copy (extrair `useCopyToClipboard`). Bordas com `color-mix` hardcoded — usar `--accent-muted`.

**A11y.** Container `role="article"`. Stream `aria-live="polite"` + `aria-busy`. Copy `aria-label={copied ? 'Copiado' : 'Copiar mensagem'}` dinâmico.

---

### 2.6 DisguiseClock (`src/components/Popover/DisguiseClock.tsx`)

**Overview.** Disfarce como relógio nativo — coração do **princípio #1**. Bug atual: `cursor:pointer` + `onClick={onReveal}` no container todo (linhas 53, 64) quebra disfarce (relógio nativo não tem cursor pointer). Corrigir: zona 40×40 central + hover 400ms + atalho global.

**Variants.** `nativeMacOS` (SF Pro 13px, weekday curto, 12/24h via `Intl.DateTimeFormat().resolvedOptions().hour12`) · `nativeWindows` (Segoe UI Variable 14px, data dd/mm/yyyy) · `minimal` (fallback mono).

**Anatomy.** Hora (`--text-display` weight 200) · data (`--text-sm`, `--text-secondary`) · posição `top-right` (centro chamativo quebra disfarce) · zona reveal 40×40 central **invisível** (só handler, sem affordance).

**Reveal.** Hover sustentado 400ms OU double-click OU atalho global (`Cmd+Shift+H`). Nunca click simples no container todo.

**Usage.** `PopoverChat` quando `isDisguised`.

**Do.** Detectar OS via `usePlatform()` (`src/hooks/usePlatform.ts`). Reveal <100ms. Esc global volta para disfarce (reverter tão rápido quanto revelar).

**Don't.** Accent no texto (relógio nativo usa cor do sistema). `cursor:pointer` no container (**C2** heurística). Animar entrada quando já visível.

**A11y.** `role="button"` + `aria-label="Relógio — clique duplo para revelar Hat"` (lido por SR, invisível para quem olha a tela).

---

### 2.7 ModePicker (extraído de ModeSelector + AccountHeader)

**Overview.** Seletor Hat vs Hat Pro. Hoje duplicado em `ModeSelector.tsx` (chat) e `AccountHeader.tsx` (settings) — heurística **M4**. Consolidar em `src/components/Shared/ModePicker.tsx`.

**Variants.** `grid` (2 col, tiles com icon+label+description+pill, default no chat) · `inline` (pills full-width sem description, default em settings).

**Anatomy.** `options` array (`id`, `icon`, `label`, `description`, `tint`) · pill ativo com `layoutId="mode-selector-pill"` (**mesmo** layoutId em ambas variants → morphing físico entre janelas) · `MODE_TINT` (`ModeSelector.tsx:9-13`): `hat` amber `#FBBF24`, `hat-pro` indigo `#818CF8`.

**Usage.** `ChatWindow` header, `SettingsPanel` seções pós-**decisão #5**.

**Do.** Reusar `layoutId` (morphing contínuo). `MODE_TINT` dá identidade sem depender só de label. Arrow keys navegam.

**Don't.** Dois pickers com funções iguais e UIs divergentes (**M4**). Trocar modo sem feedback (toast ou pulse).

**A11y.** `role="radiogroup" aria-label="Modelo de IA"`. Tiles `role="radio" aria-checked`. ArrowLeft/Right navegam, Space/Enter selecionam.

---

## 3. Composition patterns

**FlashResponse** (`src/pages/FlashPage.tsx`): `State loading` no TTFB → `MessageBubble streaming` minimal (sem avatar/timestamp — flash é denso) → `HorseLogo thinking` oculto com `aria-live` em progresso → `Toast error` se falhar (não `State error` — flash é ephemeral, erro vira toast).

**TierUnlockModal** (`src/components/Settings/ThemeUnlockCelebration.tsx`): `Modal` (`--shadow-3`, `--radius-xl`) → `HorseLogo celebrating` → preview swatches antes/depois → follow-up `Toast credit` persiste 5s pós-fechar → antes do unlock, `ThemePicker` swatch mostrava `State locked`.

---

## 4. Theme authoring (71º tema)

1. Criar `src/styles/themes/{name}.css` via `@theme{}` com 24 semânticos. Nunca editar `:root{}` (legado, **I16**).
2. Validar contraste: `--text-primary` sobre base/primary ≥ 4.5:1; `--text-secondary` sobre primary ≥ 4.5:1; `--border-focus` ≥ 3:1 em qualquer surface. Ferramenta: `culori` (build-only).
3. Adicionar entry em `THEME_PRESETS` com `tier`, `unlockAt`, `category`. `exclusive:true` só para eventos.
4. Validar 3 janelas: main (`MainLayout`), popover revealed, flash (atenção: altura pequena — checar `--text-display`).
5. Screenshot checklist: empty, 3 mensagens (user+assistant+streaming), ThemePicker aberto, Toast success+error simultâneos.
6. Skill `tailwindcss-advanced-design-systems` executa a estrutura final.

---

## 5. Do's & Don'ts globais

**Do.** (1) Tokens via utility Tailwind (`bg-surface-primary`). (2) `useReducedMotion()` em todo `motion.*`. (3) `:focus-visible` global (**I15**). (4) Memoizar listas com comparator custom. (5) `--ease-spring` via framer para entradas. (6) pt-BR via `ux-writing`. (7) `HorseLogo` animated só em states discretos. (8) `role`+`aria-label` em clicável não-nativo. (9) Tier badges com `--accent-muted` bg + `--text-accent` fg. (10) Testar novo componente em `noir` + `ice` + `matrix`.

**Don't.** (1) `color-mix()` para derivar cor — criar token. (2) `cursor:pointer` no container inteiro de componente stealth. (3) `outline:none` inline. (4) Esconder ação com `opacity:.35` (**I3**). (5) Hard-code radius (`borderRadius:12`). (6) Hex em JSX. (7) Animar chunk por chunk em streaming. (8) `backdrop-filter` sem fallback de performance. (9) `role="dialog"` sem `aria-labelledby`. (10) String hard-coded (**L3**).

---

## 6. Backlog de consolidação

- **I16** (alta) — deduplicar `:root{}` e `@theme{}` em `src/index.css`. 2.972 → ~1.500 linhas.
- **I3** (alta) — remover `opacity:0.35` de `MessageBubble` copy (`MessageBubble.tsx:82`); action sempre visível.
- **I15** (média) — `:focus-visible` global em `index.css`, remover overrides.
- **I5** (média) — introduzir `--surface-row-hover`, aplicar em `ConversationItem`, `ClipboardCard`, swatch.
- **L1** (baixa) — tokenizar radius em `ThemePicker`, `DisguiseClock`, `Toast`.
- **L2** (baixa) — tokenizar type scale (hoje `fontSize:13.5` inline).
- **L3** (baixa) — i18n de strings hard-coded ("Copiado", weekdays do `DisguiseClock`).

**Meta.** `src/styles/` ganha `tokens.css` + `typography.css` + `motion.css` + `themes/*.css` (70 arquivos).

---

## 7. Próximos passos

Handoff para `tailwindcss-advanced-design-systems` (tarefa **#14**, S1.T4):
- Quebrar `src/index.css` em `tokens.css` + `typography.css` + `motion.css`.
- Gerar `src/styles/themes/{name}.css` — um por tema, só semântico.
- Build resolve em compile-time — zero runtime.
- Storybook fica para v1.1+. Validação por screenshot manual nas 3 janelas.
- Pós-implementação: re-rodar `design-critique` + `ux-heuristic-review` para validar **I3/I5/I15/I16** e **M4/C2**.

---

_2026-04-22 · João Simi · Próxima revisão pós-execução de **#14** e **#15**._
