# Hat — AI Assistant

Assistente de IA cross-platform que vive na barra de menus (macOS) / system tray (Windows).

## Download

Acesse a [Releases](https://github.com/JGSimi/Hat-Cross/releases) para baixar o instalador da sua plataforma.

### macOS
O app **não é notarizado** (sem Apple Developer Account). Na primeira abertura:
1. Clique direito no `.app` -> **Abrir**
2. Clique **Abrir** no diálogo de segurança
3. Ou no terminal: `xattr -cr /Applications/Hat.app`

### Windows
Se o SmartScreen aparecer, clique **Mais informações** -> **Executar mesmo assim**.

## Features

- **Multi-provider AI**: Google Gemini, OpenAI, Anthropic Claude, Inception Mercury, OpenRouter, Custom, Ollama local
- **Popover flutuante**: chat rápido que fica sempre visível (não fecha ao perder foco)
- **Quick Input**: atalho global (Cmd/Ctrl+Shift+Space) abre input tipo Spotlight
- **Análise de tela**: captura tela e envia para IA com análise proativa (Cmd/Ctrl+Shift+Z)
- **Clipboard processing**: lê clipboard, processa com IA, devolve resposta (Cmd/Ctrl+Shift+X)
- **Stealth Mode**: popover quase invisível, aparece ao passar o mouse
- **9 temas de cor**: Indigo, Azul, Roxo, Rosa, Vermelho, Laranja, Verde, Teal, Mono
- **Auto-update**: o app verifica e instala atualizações automaticamente
- **Markdown render**: respostas com syntax highlight
- **Histórico de conversas**: sidebar com pin, rename, busca

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend**: Rust, Tauri v2
- **Streaming**: SSE via Rust -> eventos Tauri -> React

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Dev mode
npm run tauri dev

# Build
npm run tauri build
```

## Atalhos globais

| Atalho | Ação |
|--------|------|
| Cmd/Ctrl+Shift+Space | Quick Input |
| Cmd/Ctrl+Shift+Z | Análise de Tela |
| Cmd/Ctrl+Shift+X | Processar Clipboard |
