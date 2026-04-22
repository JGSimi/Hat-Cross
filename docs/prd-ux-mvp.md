# PRD — Hat-Cross UX MVP (4 semanas)

**Status:** Frozen v1.1 · **Owner:** João Simi · **Window:** D0 → D+28 · **Updated:** 2026-04-22

> **Amendment v1.1 (2026-04-22) — Stealth scope reframing.** Stealth = invisibilidade a **olhos físicos** (colega passando, entrevistador olhando de lado, coffee shop). **Não** ambiciona anti-screen-recording / anti-OBS / anti-ScreenCaptureKit. Research FP1 confirmou que Apple quebrou `setContentProtected` em macOS 15+ (Sequoia/Tahoe) — e isso é aceitável porque nunca foi o foco real. Ver `.claude/projects/.../memory/project_hat_cross_stealth_framing.md`. G1 e G10 renumerados; US-01 reescrita; R2 atualizado.

---

## 1. Overview

Este MVP **não relança o Hat-Cross**: pega o produto Tauri v2 + React + Rust já funcional (3 janelas, 70 temas, flash secreto) e **congela o contrato UX** em 3 pilares — **stealth verificado**, **paridade Win/macOS contratual**, **identidade visual de mascote**. Polimento cirúrgico em 8 features (FlashPage, DisguiseClock, paridade dual-OS, Settings em 3 seções, ThemePicker sem paywall, estados unificados, a11y WCAG AA, Vitest smoke) que provam a hipótese "Rafa usa em entrevista real, Kat reconhece paridade, Luiza publica screenshot orgânico" em 28 dias. Zero redesign, zero novas features, zero novos temas.

## 2. Problem

Hat-Cross tem **arquitetura sólida, contrato UX instável**. Auditoria do repo: `≤5 aria-*` em `src/`, **zero testes** (sem `vitest.config.ts`, sem `*.test.tsx`), **estados ad-hoc** (cada página inventa spinner/empty/error), e os 70 temas livres ficam enterrados atrás de 2 cliques. Para **Rafa** (stealth/entrevistas) isso é risco: sem medir p95 do flash nem validar que DisguiseClock passa por relógio nativo a 1.5 m de distância, o diferencial é **não verificado**. Para **Kat** (dev Windows PL), paridade é promessa sem contrato: `tauri.conf.json` e `capabilities/` divergem sem checklist nem screenshot-diff. Para **Luiza** (design engineer), mascote ausente em momentos-chave e vocabulário implícito de paywall matam o apelo "post orgânico".

O gap é **qualidade contratual**, não feature set. Se não fecha em 4 semanas, Raycast Windows ou ChatGPT Desktop ocupam o espaço "cross-platform com personalidade" antes do Hat-Cross se firmar, e a hipótese morre sem ser testada.

## 3. Goals & metrics

| # | Métrica | Target | Método | Owner | Kill |
|---|---|---|---|---|---|
| G1 | Stealth físico aprovado | ≥80% (≥8/10 Rafas) | Teste "colega a 1.5 m olha tela 3 s" em sessão moderada; Rafa autoavalia se seria notado | Rafa+QA | <50% → pivot |
| G2 | p95 flash | <800 ms | `performance.mark` n=100 dual-OS | Rafa | >1200 ms |
| G3 | Paridade 3 janelas | 100% checklist | Screenshot diff <2% + checklist 42 itens | Kat | regressão bloqueante |
| G4 | SUS | ≥72 | 15 users (5/persona) beta S4 | Luiza | <60 |
| G5 | axe-core sérias/críticas | 0 | CI gate sobre 10 core | Luiza+Rafa | >0 em RC |
| G6 | Vitest coverage | ≥60% lines+branches | `vitest --coverage` em CI | Kat | <40% |
| G7 | Retention D7 Rafas | ≥60% (≥3/5) | `app_open` local + survey | Rafa | <40% |
| G8 | Posts Luizas D+14 | ≥3 com screenshot | Busca Twitter/Bsky/IG | Luiza | 0 em D+21 |
| G9 | Paywall CTAs | 0 | `grep -E 'upgrade\|unlock\|pro\|paid' src/` | Luiza | >0 |
| G10 | Blind test DisguiseClock | 5/5 "só um relógio" | 5 users × 10 s | Rafa | ≤3/5 |
| G11 | Install-to-first-prompt | <90 s p75 | Cronômetro n=10/OS | Kat | >180 s |
| G12 | Theme switch | <100 ms | `performance.now()` em `onChange` | Luiza | >250 ms |

## 4. Users

- **Rafa (28, dev BR) — primário.** JTBD: *"Quando travo numa entrevista técnica ao vivo, quero consultar IA sem que quem me observa perceba."* Usa `⌘⇧F`/`Ctrl+Shift+F` durante live coding. Cenário-âncora: entrevistador olhando de soslaio, colega passando atrás em coffee shop. **NÃO** é anti-gravação: screen recording ignora stealth em macOS 15+ (limitação conhecida de `setContentProtected` vs ScreenCaptureKit, aceitável porque entrevistador raro revisa gravação posteriormente com olho clínico).
- **Kat (34, .NET Windows, PL) — secundária crítica.** JTBD: *"No laptop Windows do trabalho, quero a mesma ferramenta que uso no Mac em casa, sem imposto cognitivo."* Se atalho/layout divergir >2%, posicionamento underdog quebra.
- **Luiza (26, design engineer BR) — secundária estratégica.** JTBD: *"No setup que montei com carinho, quero ferramentas com personalidade visual, sem parecer preset."* Posta screenshot se mascote tiver charme, 70 temas forem livres e nenhum CTA de paywall aparecer.
- **Anti-persona — Diego (mainstream menubar user).** Quer launcher genérico Raycast/Spotlight. Hat-Cross **não é para ele**: sem search global, sem extensões, sem workflows no MVP.

## 5. User stories

1. **US-01 (Rafa · Flash).** Como Rafa, durante entrevista ao vivo, quero acionar flash via `⌘⇧F`/`Ctrl+Shift+F` para ler resposta discreta em <800 ms em canto fora do eixo central de atenção, validado por teste "observador casual a 1.5 m olha tela 3 s, depois descreve o que viu" com 10 participantes (≤20% mencionam o overlay). `setContentProtected(true)` aplicado como defense-in-depth (bloqueia QuickTime clássico + AirPlay + captura Windows), mas **não** é gate de release em macOS 15+.
2. **US-02 (Rafa · DisguiseClock).** Como Rafa, quando entrevistador olha meu popover, quero um relógio convincente no lugar do chat, validado por 5/5 em blind test 10 s.
3. **US-03 (Kat · Install Windows).** Como Kat, ao `winget install hat-cross`, quero 1º prompt em <90 s, validado por cronômetro n=10 no Win11.
4. **US-04 (Kat · Paridade atalho).** Como Kat, ao apertar `Ctrl+Shift+F` no Win, quero comportamento idêntico ao `⌘⇧F` macOS, validado por screenshot diff <2%.
5. **US-05 (Kat · Paridade janelas).** Como Kat, abrindo PopoverChat/Settings/Flash no Win, quero layout/tipografia/espaçamento idênticos ao macOS, validado por checklist 42 itens verde.
6. **US-06 (Luiza · Onboarding).** Como Luiza, ao abrir o app pela 1ª vez, quero 3 telas skippable (atalho → locale pt-BR → tema) com mascote animando, para sentir personalidade, validado por SUS ≥72.
7. **US-07 (Luiza · Temas livres).** Como Luiza, em `Settings > Appearance`, quero 70 temas sem CTA "upgrade/unlock", validado por grep = 0.
8. **US-08 (Luiza · Mascote).** Como Luiza, ao desbloquear tier lúdico, quero mascote animar (transform-only, 60 fps) em onboarding + settings header + tier unlock + empty state, validado por presença nos 4 pontos.
9. **US-09 (Luiza · Theme switch).** Como Luiza, ao clicar num thumbnail, quero UI trocar em <100 ms sem flash branco, validado por `performance.now()`.
10. **US-10 (Rafa · Settings 3 seções).** Como Rafa, ao abrir Settings, quero exatamente 3 tabs (`General`/`Appearance`/`Shortcuts`) com atalho editável na 1ª aba, validado por Nielsen ≥8/10.
11. **US-11 (todas · Estados).** Como qualquer persona, quando IA falha, quero `Loading`/`Empty`/`Toast` consistente com botão `Retry`, validado por 100% erros terem retry + grep 0 spinners ad-hoc.
12. **US-12 (Luiza+Rafa · Keyboard).** Como usuário de teclado, quero navegar critical flow com `Tab`/`Shift+Tab`/`Enter`/`Esc`, validado por axe-core 0 sérias + smoke keyboard-only.
13. **US-13 (Kat · Vitest CI).** Como Kat, antes de merge em `main`, quero CI falhar se coverage <60%, validado por PR bloqueado com 59%.
14. **US-14 (Rafa · Retention D7).** Como Rafa, após usar em entrevista real, quero voltar D+7 porque a ferramenta segue leve, validado por ≥3/5 Rafas abrindo D+7 no beta.

## 6. Requirements

### 6.1 Functional

- **F1.** `src-tauri/src/macos_overlay.rs` + `windows.rs` expõem API unificada `show_flash(prompt: String) -> Result<()>` com mesma assinatura e contrato de timing dual-OS.
- **F2.** `src/pages/FlashPage.tsx` renderiza ≤1 frame após `show_flash` (`performance.mark("flash_triggered"|"flash_rendered")`).
- **F3.** FlashPage = janela click-through + content protection (macOS `NSWindowSharingNone`, Win `WDA_EXCLUDEFROMCAPTURE`).
- **F4.** Atalho default: `⌘⇧F` / `Ctrl+Shift+F`, editável em `Settings > Shortcuts`.
- **F5.** `src/components/Popover/DisguiseClock.tsx` renderiza HH:MM:SS atualizado a cada 1 s, com aparência de widget nativo; nada sugere IA.
- **F6.** `PopoverChat.tsx` alterna para DisguiseClock quando `disguise===true` ou atalho `⌘.`/`Ctrl+.`.
- **F7.** `tauri.conf.json` + `src-tauri/capabilities/*.json` só têm permissões estritamente necessárias; audit manual `fs:allow-*` antes de cada RC.
- **F8.** 3 janelas definidas identicamente para macOS e Win em `tauri.conf.json`; deltas documentados em `docs/parity-checklist.md`.
- **F9.** `SettingsPanel.tsx` tem exatamente 3 tabs: `General`, `Appearance`, `Shortcuts`. Sem `Account`/`Credits`/`Billing`.
- **F10.** `src/components/Settings/cards/*` com mesmo padding/border-radius/pattern title+description.
- **F11.** `src/components/HorseLogo.tsx` aparece em: (a) OnboardingWizard step 1, (b) Settings header, (c) modal tier unlock, (d) EmptyState do chat vazio.
- **F12.** Animações do mascote usam `framer-motion` **apenas transform/opacity** (sem width/height/top/left), target 60 fps.
- **F13.** `ThemePicker.tsx` lista 70 temas sem badge "pro/unlock/paid"; tipo `Theme` em `src/types/index.ts` sem campo `tier`/`paid`.
- **F14.** Troca de tema chama `document.documentElement.setAttribute('data-theme', id)` + persist via Tauri store em <100 ms.
- **F15.** `EmptyState.tsx`, `ToastContainer.tsx` e novo `LoadingState.tsx` são os únicos containers desses estados; grep `<Spinner`/`animate-spin` fora destes = 0.
- **F16.** Todo erro de rede/IA em chat e settings oferece botão `Retry`.
- **F17.** 10 componentes core (FlashPage, PopoverChat, DisguiseClock, SettingsPanel, ThemePicker, HorseLogo, EmptyState, ToastContainer, LoadingState, OnboardingWizard) têm ≥1 `aria-label`/role e keyboard nav completa.
- **F18.** `axe-core` via Vitest + `@axe-core/react` sobre 10 core em CI; falha em `serious`/`critical`.
- **F19.** `vitest.config.ts` com `jsdom`, coverage v8, threshold 60% lines/branches.
- **F20.** Cada core com ≥1 `*.test.tsx` cobrindo render + interação principal.
- **F21.** `OnboardingWizard.tsx` com 3 steps skippable (atalho, locale pt-BR, tema); `Skip` sempre visível no topo-direito.
- **F22.** pt-BR canônico; en é fallback; sem outras línguas.

### 6.2 Non-functional

- **NF1.** p95 flash trigger→render <800 ms dual-OS.
- **NF2.** Cold start (double-click → PopoverChat interativo) <1500 ms macOS / <2000 ms Win.
- **NF3.** Bundle `.dmg` <15 MB, `.msi` <12 MB.
- **NF4.** Memory idle 3 janelas <180 MB RSS agregado.
- **NF5.** CPU idle com DisguiseClock <2% M-series, <3% x86-64.
- **NF6.** WCAG 2.1 AA nos 10 core (contrast ≥4.5:1 texto, ≥3:1 UI).
- **NF7.** i18n pt-BR+en em `src/locales/{ptBR,en}.ts`.
- **NF8.** API keys via `tauri-plugin-store` com encryption-at-rest OS (Keychain/DPAPI); nunca `localStorage` nem JSON plano.
- **NF9.** CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`. Sem `eval`, sem remote scripts.
- **NF10.** Shortcuts default idênticos em semântica dual-OS (Cmd≡Ctrl); divergências documentadas.
- **NF11.** Theme switch <100 ms.
- **NF12.** Install-to-first-prompt <90 s p75 dual-OS.

### 6.3 Constraints técnicas

- **C1.** Tauri v2. Plugin-fs exige `fs:allow-*` explícito em `capabilities/` antes do ship (feedback memória).
- **C2.** Tailwind v4 **CSS-first** com tokens em `@theme`; zero `tailwind.config.js` JS-based.
- **C3.** Zero Radix/shadcn no MVP — identidade própria > genérico.
- **C4.** `framer-motion` apenas transform/opacity (F12).
- **C5.** Zustand mantido; migração de store out of scope.
- **C6.** React 18+ function components + hooks apenas.
- **C7.** TS `strict: true`; `any` proibido em código novo (ESLint gate).
- **C8.** Build passando ≠ feature funcionando; todo PR anexa print/gravação runtime (feedback memória).

## 7. Out of scope

1. **Redesign do chat** — mexer em PopoverChat abre risco de regressão stealth.
2. **Extensões/plugins** — v1.2+, não valida hipótese atual.
3. **Search global em settings** — 3 seções basta; search adiciona complexidade sem métrica.
4. **Voice input** — fora do JTBD das 3 personas, alto custo.
5. **Telemetria remota** — incompatível com posicionamento privacy-first; beta usa métrica local + survey.
6. **Migração de Zustand** — refactor não move métrica do MVP.
7. **E2E Playwright** — Vitest smoke + beta manual bastam em 28 dias; E2E em v1.1.
8. **Temas além dos 70** — prioridade é 70 existentes funcionarem nos tokens novos.
9. **Mascote 3D/Lottie** — transform-only 2D cumpre identidade sem custo de CPU no flash.
10. **Clipboard manager visual** — feature adjacente, não prova stealth nem paridade.
11. **Redesign Account/Credits** — removidos do Settings; billing em v1.1.
12. **AmbientBubbles on-by-default** — off por padrão para preservar cold start e stealth.
13. **Sync cloud de conversas** — incompatível com privacy-first.
14. **i18n além de pt-BR+en** — pt-BR canônico (decisão estratégica); demais em v1.1+.
15. **Adoção de Radix/shadcn** — decisão explícita C3; identidade própria > genérico.

## 8. Timeline & milestones

- **S1 (D1–D7) — Setup.** Owner Kat+Luiza. `vitest.config.ts` + CI gate; tokens `@theme` Tailwind v4; `EmptyState`/`LoadingState`/`ToastContainer` primitives; `HorseLogo.tsx` pronto. **D7:** `npm test` passa, 0 spinners ad-hoc, axe-core rodando.
- **S2 (D8–D14) — Stealth & paridade.** Owner Rafa+Kat. DisguiseClock production + blind test 5/5; FlashPage p95 <800 ms n=100 dual-OS; **teste peripheral-vision** com 10 observadores casuais (≤20% notam flash); `setContentProtected` aplicado como defense-in-depth; checklist 42 itens verde; winget+dmg <90 s. **D14:** G1/G2/G3/G10/G11 com evidência.
- **S3 (D15–D21) — Settings & identidade.** Owner Luiza. SettingsPanel 3 tabs; ThemePicker sem paywall; mascote nos 4 pontos (F11); theme switch <100 ms. **D21:** grep paywall=0, Nielsen ≥8/10, SUS piloto n=3 ≥70.
- **S4 (D22–D28) — A11y & verificação.** Owner Luiza+Rafa+Kat. WCAG AA nos 10 core; axe-core 0 sérias; Vitest ≥60%; beta 15 users (5/persona), SUS ≥72, retention D7 Rafas ≥60%, ≥3 posts Luizas agendados. **RC em D+28.**

## 9. Risks & mitigations

| # | Risco | Prob/Impacto | Mitigação |
|---|---|---|---|
| R1 | Raycast Win ship paridade antes de D+28 | M/Alto | Acelerar S2; landing "stealth-first" que Raycast não cobre. |
| R2 | Observador físico nota o flash por má posição/tamanho/cor | M/Crítico | DisguiseClock OS-native (SF Pro/Segoe UI Variable) + FlashPositionCanvas com preview multi-monitor + peripheral-vision test 10 observadores. Screen-recording NÃO está no escopo — já documentado como limitação em macOS 15+ (ver `docs/research/stealth-content-protection.md`). |
| R3 | Mascote consome CPU/GPU no flash e mata p95 | M/Alto | F12 proíbe não-transform; benchmark S2; se flash+mascote >800 ms, congelar mascote no flash via `prefers-reduced-motion` forçado. |
| R4 | 70 temas quebram com tokens `@theme` novos | A/Médio | Smoke test CI render por tema + screenshot diff 10% amostra; 2 dias de budget S3 pra regression. |
| R5 | Kat acha regressão crítica em capability Tauri | M/Crítico | Checklist revisado D10/D17/D24; pareamento Kat+João; `fs:allow-*` audit antes de cada RC. |
| R6 | SUS <60 porque 3 tabs confundem | B/Alto | Piloto SUS D+21 n=3; se <65, ajustar copy/iconografia em S4. |
| R7 | Blind test DisguiseClock falha (≤4/5) | M/Crítico | 2 ciclos: D10 n=3 interno, D17 n=5 externo; budget pra redesenhar fonte/color/layout em S3. |

## 10. Acceptance checklist (release D+28)

- [ ] G1–G12 todos verdes conforme §3
- [ ] Bundle `.dmg` <15 MB, `.msi` <12 MB
- [ ] `fs:allow-*` audit manual em `capabilities/` sem surpresas
- [ ] Build passando + **evidência runtime** (gravação/print) anexada em cada PR
- [ ] 3 Rafas, 5 Kats, 5 Luizas assinam "recomendo pra um amigo da persona" no survey final

---

**Frozen. Qualquer mudança de escopo após D0 exige entrada em `docs/prd-ux-mvp-changelog.md` e não é retroativa nas métricas de kill.**
