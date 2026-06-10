# Hat — Salas + Flash

Assistente de IA **stealth** para provas/questionários em grupo, na barra de
menus (macOS) / system tray (Windows). Você copia uma questão, aciona o **Flash**
(a IA responde discretamente), e numa **sala** a IA compara as respostas de
todos, descobre a alternativa correta e avisa — pelo próprio Flash — quem errou.

> **Pivot 2026-06:** o app é **apps/hat** (Tauri v2). Não há mais chat: só
> **Salas + Flash**. Os apps antigos (`/src-tauri` "Hat" e `apps/hat-flash`
> "Hat Flash" em Wails) estão **descontinuados** e não são mais publicados —
> ver [docs/rebuild/](docs/rebuild/).

## Como funciona

1. **Entre numa sala** (grátis) — ou crie uma e compartilhe o código.
2. **Copie uma questão** e aperte `Cmd/Ctrl+Shift+F`: o Flash mostra a resposta
   da IA, discreto, num canto. Essa resposta vira sua entry na sala.
3. **A IA da sala** agrupa perguntas iguais, apura a maioria, **resolve a
   questão por conta própria** e conclui a alternativa correta.
4. **Correções no Flash**: quando você diverge do gabarito apurado, um badge
   acumula a correção; aperte `Cmd/Ctrl+Shift+D` para vê-la no Flash
   ("Resposta certa: (B) …").

## Download e instalação

Baixe a última versão em [Releases](https://github.com/JGSimi/Hat-Cross/releases/latest):

| Plataforma | Arquivo |
|---|---|
| **macOS Apple Silicon** (M1+) | `Hat_X.Y.Z_aarch64.dmg` |
| **macOS Intel** | `Hat_X.Y.Z_x64.dmg` |
| **Windows 64-bit** | `Hat_X.Y.Z_x64-setup.exe` |

O app **não é assinado** (sem licença Apple/Microsoft). É seguro; o SO só não
reconhece o certificado pago. Na **primeira** abertura:

- **macOS:** arraste o `.app` para Aplicativos → clique com o **botão direito →
  Abrir** → confirme. (Ou Ajustes do Sistema → Privacidade e Segurança → "Abrir
  mesmo assim". Em último caso: `xattr -cr /Applications/Hat.app`.)
- **Windows:** ao ver o SmartScreen, **Mais informações → Executar mesmo assim**.

### Atualizações — automáticas

Depois de instalado, o Hat se **atualiza sozinho**: a cada início ele verifica
o GitHub Releases e baixa/instala a nova versão em segundo plano (aplicada no
próximo start). A verificação usa uma assinatura **minisign** própria do app —
**não depende de licença de dev**. O atrito do certificado existe só na 1ª
instalação manual.

## Atalhos globais

| Atalho | Ação |
|---|---|
| `Cmd/Ctrl+Shift+F` | Processar clipboard + Flash (e compartilhar com a sala ativa) |
| `Cmd/Ctrl+Shift+D` | Mostrar a próxima correção da sala no Flash |
| `Cmd/Ctrl+Alt+F` | Ajustar a posição do Flash |
| `Cmd/Ctrl+Shift+Q` | Fechamento de emergência (100% nativo) |

## Assinatura

Plano único: **R$ 50/mês, ilimitado** (salas e Flash sem limites). Novos
usuários têm **7 dias de teste grátis** (sem cartão); ao expirar, o app pede
assinatura. Cobrança via Stripe, gerida pelo Worker `hat-proxy`.

## Stack

- **App** (`apps/hat`): Tauri v2 + Rust · React 19 + TypeScript + Vite +
  Tailwind v4 + Zustand. Domínio puro testável (`src/domain`, crate `hat-core`).
- **Backend** (`hat-proxy`, repo separado): Cloudflare Worker — proxy Gemini,
  salas (consenso + IA-juiz), Firebase Auth, billing Stripe.

## Desenvolvimento

```bash
cd apps/hat
npm install
npm test                              # 245+ testes (domínio TS)
cd src-tauri && cargo test -p hat-core # domínio Rust
cargo tauri dev                        # rodar o app
```

Documentos de planejamento e decisões do rebuild/pivot: [docs/rebuild/](docs/rebuild/).

## Release

Crie uma tag `hat-app-vX.Y.Z` (ou rode o workflow **Hat (app)** manualmente).
O CI builda macOS (arm64/intel) + Windows, **não-assinado**, gera os artefatos
do updater (minisign) e publica `.dmg`/`.exe` + `latest.json` na release.
Requer os secrets `TAURI_SIGNING_PRIVATE_KEY` (+ senha, se houver) e os
`VITE_FIREBASE_*` / `VITE_GOOGLE_OAUTH_*`.

## Modelo IA

Este repo não contém identificador de modelo Gemini — o app envia só `mode`
(`hat`/`hat-pro`) para o `hat-proxy`. O mapeamento de modelo e a chave ficam no
Worker externo.
