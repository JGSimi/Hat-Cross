# Plan: Hat Beta com Jev System One

**Required Skill**: executing-plans

## Goal

Publicar uma variante beta isolada do Hat que usa Jev para decisões rápidas e
Gemini 3.8 Flash para gerar a resposta verbal, com download separado no site.

## Architecture Overview

O app beta identifica cada requisição com `clientVariant: beta-jev`. O
`hat-proxy` chama Jev apenas para essa variante, usa respostas objetivas de alta
confiança diretamente como decisão e, nos demais casos, injeta a decisão de
rota/estilo no prompt do Gemini 3.8 Flash. Falha, timeout ou resposta inválida do
Jev sempre degrada para Gemini, sem interromper o usuário.

A versão estável continua usando o contrato atual. A beta ganha identidade e
workflow de prerelease próprios, sem publicar `latest.json` nem alterar o canal
de atualização estável. O site consulta a release estável e a beta
separadamente e mostra dois botões.

## Tech Stack

- Cloudflare Worker + TypeScript + Vitest
- Jev System One HTTP API
- Gemini native API/SSE
- Tauri v2 + React + Rust
- GitHub Actions + GitHub Releases
- Vite website

## Tasks

1. Criar cliente Jev tipado e testes para múltipla escolha, roteamento,
   confiança, timeout e fallback.
2. Integrar o orquestrador beta ao `hat-proxy`, selecionar
   `gemini-3.8-flash` e preservar cobrança/streaming existentes.
3. Propagar `clientVariant` somente no build beta e cobrir TS/Rust com testes.
4. Criar configuração e workflow `hat-beta-v*` como prerelease isolada.
5. Adicionar descoberta e botão de download beta separado no site.
6. Rodar testes, builds, typecheck e validação dos workflows.
7. Publicar backend, prerelease beta e site; verificar URLs e artefatos reais.

## Success Criteria

- Stable não chama Jev.
- Beta usa Jev quando a chave está configurada e cai para Gemini em falhas.
- Questão objetiva com confiança suficiente condiciona a resposta final ao
  resultado do Jev.
- Gemini da beta usa `gemini-3.8-flash` com baixo esforço de raciocínio.
- Beta não interfere no updater/release estável.
- Site oferece downloads estável e beta em ações distintas.
- Nenhuma chave é incluída em app, site ou Git.
