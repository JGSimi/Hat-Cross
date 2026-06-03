# Hat Flash — AI Assistant

Assistente de IA cross-platform que vive na barra de menus (macOS) / system tray (Windows).

## Download

Baixe a última versão na página de [Releases](https://github.com/JGSimi/Hat-Cross/releases/latest).

| Plataforma | Arquivo | Notas |
|------------|---------|-------|
| **Windows 64-bit** | `Hat_X.Y.Z_x64-setup.exe` | |
| **macOS Apple Silicon** (M1/M2/M3/M4) | `Hat_X.Y.Z_aarch64.dmg` | Veja instruções abaixo |
| **macOS Intel** | `Hat_X.Y.Z_x64.dmg` | Veja instruções abaixo |
| **Linux Debian/Ubuntu** | `Hat_X.Y.Z_amd64.deb` | |
| **Linux AppImage** | `Hat_X.Y.Z_amd64.AppImage` | Universal |
| **Linux RPM** | `Hat-X.Y.Z-1.x86_64.rpm` | Fedora/openSUSE |

### macOS (sem certificado Apple)
O app **não é notarizado** (sem Apple Developer Account). Na primeira abertura:
1. Clique direito no `.app` -> **Abrir**
2. Clique **Abrir** no diálogo de segurança
3. Ou no terminal: `xattr -cr /Applications/Hat.app`

### Windows
Se o SmartScreen aparecer, clique **Mais informações** -> **Executar mesmo assim**.

## Features

- **Hat proxy AI**: o app envia apenas `mode` (`hat` / `hat-pro`) para o Worker `hat-proxy`; a escolha do modelo Gemini e a chave server-side ficam fora deste repo.
- **Popover flutuante**: chat rápido que fica sempre visível (não fecha ao perder foco)
- **Clipboard processing**: lê clipboard, processa com IA, devolve resposta (Cmd/Ctrl+Shift+X)
- **Flash Mode**: resposta do clipboard "piscada" discretamente na tela em vez de notificação do sistema
- **Fechamento de emergência**: atalho global (Cmd/Ctrl+Shift+Q) fecha o Hat completamente mesmo sem foco
- **Stealth Mode**: popover quase invisível, aparece ao passar o mouse
- **9 temas de cor**: Indigo, Azul, Roxo, Rosa, Vermelho, Laranja, Verde, Teal, Mono
- **Auto-update**: o app verifica e instala atualizações automaticamente
- **Markdown render**: respostas com syntax highlight
- **Histórico de conversas**: sidebar com pin, rename, busca

## Stack Principal

- **Frontend**: React 18, TypeScript, Vite, Zustand
- **Backend**: Go, Wails v3
- **Streaming**: SSE via Go -> eventos Wails -> React

O app principal agora vive em `apps/hat-flash`. O app Tauri antigo continua no
repo para referencia e manutencao, mas os scripts raiz apontam para Hat Flash.

## Desenvolvimento

```bash
# Instalar dependências
npm install
cd apps/hat-flash/frontend && npm install

# Dev mode
npm run dev

# Build
npm run build

# Testes principais
npm test
```

## Billing / Stripe

Hat Flash cobra assinaturas mensais por Stripe:

| Plano | Preco mensal | Acesso |
|-------|--------------|--------|
| Go | R$ 20 | Hat pessoal e processamento de clipboard |
| Pro | R$ 50 | Go + salas compartilhadas e modo Hat Pro |
| Ultra | R$ 99 | Pro + prioridade marcada no billing |

Antes de release com billing ativo, valide o ambiente:

```bash
npm run check:billing-build-env
npm run check:billing-release-env
npm run test:billing-worker
npm run test:billing-scripts
npm run dry-run:billing-worker
```

O Worker Stripe fica em `apps/hat-flash/billing-worker`. Ele precisa dos
segredos `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FIREBASE_PROJECT_ID`,
`STRIPE_PRICE_GO`, `STRIPE_PRICE_PRO` e `STRIPE_PRICE_ULTRA` configurados no
Cloudflare antes de billing live funcionar.

Fluxo Tauri legado:

```bash
npm run dev:tauri
npm run build:tauri
npm run test:tauri
```

## Modelo IA

Este repo não deve conter identificador de modelo Gemini. O cliente Tauri envia
somente `mode` para `https://hat-proxy.joao02simi.workers.dev/v1/chat`.

Quando o Google AI Studio avisar troca de modelo no projeto `hat-cross`, mude o
mapping no Worker externo `hat-proxy`:

| modo do app | modelo no Worker |
|-------------|------------------|
| `hat` | `gemini-3.1-flash-lite` |
| `hat-pro` | confirmar no Worker antes de alterar |

Depois rode localmente:

```bash
rg -n "gemini-3\\.1" .
npm test -- --run src/services/ai/__tests__/sanitizeBackendError.test.ts
cd src-tauri && cargo test streaming
```

## Atalhos globais

| Atalho | Ação |
|--------|------|
| Cmd/Ctrl+Shift+F | Processar Clipboard + Flash |
| Cmd/Ctrl+Alt+F | Ajustar posição do Flash |
| Cmd/Ctrl+Shift+Q | Fechamento de emergência |
