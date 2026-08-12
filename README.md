# Hat — Flash

Assistente de IA rápido e simples, sem a necessidade de sair da tela que você está.
A IA responde discretamente no canto da tela

## Download e instalação

Baixe a última versão em [Releases](https://github.com/JGSimi/Hat-Cross/releases/latest):

| Plataforma | Arquivo |
|---|---|
| **macOS Apple Silicon** (M1+) | `Hat_X.Y.Z_aarch64.dmg` |
| **macOS Intel** | `Hat_X.Y.Z_x64.dmg` |
| **Windows 64-bit** | `Hat_X.Y.Z_x64-setup.exe` |

O app **não é assinado/notarizado** (sem licença Apple/Microsoft). É seguro; o
SO só não reconhece o certificado pago.

- **macOS (Apple Silicon e Intel):** abra o `.dmg`, arraste o **Hat** para
  Aplicativos e rode **uma vez** no Terminal:

  ```bash
  xattr -cr /Applications/Hat.app
  ```

  Depois abra normal (duplo-clique). Esse passo é necessário porque o macOS põe
  o app em "quarentena" ao baixar e, sem notarização, mostra **"Hat está
  danificado"** — o `xattr -cr` remove a quarentena (não é vírus; é só o
  certificado pago que falta). O "botão direito → Abrir" **não** resolve o
  "danificado" no Apple Silicon; use o comando acima.
- **Windows:** rode o instalador; no SmartScreen, **Mais informações →
  Executar mesmo assim**.

### Atualizações — automáticas

Depois de instalado, o Hat se **atualiza sozinho**: a cada início ele verifica
o GitHub Releases e baixa/instala a nova versão em segundo plano (aplicada no
próximo start). A verificação usa uma assinatura **minisign** própria do app —
**não depende de licença de dev**. O atrito do certificado existe só na 1ª
instalação manual.

## Assinatura

Plano único: **R$ 30/mês, ilimitado**. Cobrança via Stripe.
