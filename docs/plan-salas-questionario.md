# Plan: Salas de Questionario com Consenso IA

**Required Skill**: executing-plans

## Goal
Criar salas colaborativas para questionarios onde cada entrada custa 800 creditos, perguntas/respostas da IA sao compartilhadas, respostas semelhantes sao comparadas e divergencias notificam usuarios.

## Regra Principal
Entrada na sala custa **800 creditos por usuario por sala**. O debito precisa ser feito no backend, com transacao atomica e idempotencia. O app React nunca pode ser a fonte de verdade do gasto.

## Arquitetura
O app atual e React + Tauri. Chat passa por `stream_chat_hat`, que manda token Firebase para o Worker Hat. O Worker ja e dono de auth, creditos e chamada IA. Logo, salas precisam nascer como feature backend-first no Worker/Firebase, com UI no app apenas lendo/escrevendo estado autorizado.

V1 deve usar Firestore realtime para sala, membros, mensagens, clusters e notificacoes. O chat local continua existindo; sala e um contexto remoto separado.

## Decisao de Produto V1
- 800 creditos = taxa de entrada na sala.
- Cada pergunta enviada para IA continua gastando creditos normais do modo `hat` ou `hat-pro`.
- V1 compartilha apenas texto da pergunta enviada e resposta final da IA.
- V1 nao compartilha imagens, clipboard bruto, screen capture, pensamento da IA, nem historico inteiro.
- Popover/stealth fica fora da V1 para evitar vazamento acidental.

## Data Model Firestore

```ts
type RoomStatus = 'open' | 'locked' | 'ended';
type RoomRole = 'owner' | 'member';
type AnswerType = 'multiple_choice' | 'numeric' | 'short_text' | 'open_text' | 'unknown';

interface RoomDoc {
  title: string;
  ownerUid: string;
  status: RoomStatus;
  joinCost: 800;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  memberCount: number;
}

interface RoomMemberDoc {
  uid: string;
  role: RoomRole;
  displayName: string | null;
  photoURL: string | null;
  paidAt: number;
  lastSeenAt: number;
  creditsCharged: 800;
}

interface RoomEntryDoc {
  id: string;
  uid: string;
  questionText: string;
  aiAnswer: string;
  extractedAnswer: string | number | null;
  answerType: AnswerType;
  confidence: number;
  mode: 'hat' | 'hat-pro';
  createdAt: number;
  sourceMessageId: string;
  clusterId?: string;
}

interface RoomClusterDoc {
  id: string;
  canonicalQuestion: string;
  answerType: AnswerType;
  consensusAnswer: string | number | null;
  consensusConfidence: number;
  entryIds: string[];
  divergentEntryIds: string[];
  updatedAt: number;
}

interface RoomNotificationDoc {
  uid: string;
  entryId: string;
  clusterId: string;
  kind: 'divergence' | 'consensus_changed';
  severity: 'info' | 'warning';
  message: string;
  createdAt: number;
  readAt?: number;
}
```

## Backend API

Worker Hat, ou backend equivalente:

- `POST /v1/rooms`
  - cria sala.
  - opcional: dono entra gratis ou paga 800. Decidir antes do build.

- `POST /v1/rooms/:roomId/join`
  - valida Firebase token.
  - se ja existe `members/{uid}`, retorna ok sem novo debito.
  - se nao existe, transacao: `credits >= 800`, decrementa 800, incrementa `creditsSpent`, cria `members/{uid}`, cria transaction log.
  - recebe `Idempotency-Key`.

- `POST /v1/rooms/:roomId/leave`
  - marca presenca offline. Nao reembolsa.

- `POST /v1/chat`
  - adiciona campos opcionais: `roomId`, `roomShare`, `sourceMessageId`.
  - se `roomShare=true`, valida membership antes de chamar IA.
  - ao finalizar stream, grava `RoomEntryDoc`.
  - aciona comparacao/cluster.

- `POST /v1/rooms/:roomId/entries/:entryId/recompare`
  - admin/debug. Recalcula cluster.

## Consenso IA

Nao usar media simples para tudo.

- Pergunta objetiva/multipla escolha: extrair alternativa final e fazer maioria ponderada por confianca.
- Numerica: media/mediana so se unidades forem iguais.
- Texto curto: agrupar por similaridade semantica e escolher consenso.
- Texto aberto: nao dizer "errado"; notificar "resposta diverge do grupo".

Pipeline:

1. Normalizar pergunta.
2. Gerar assinatura simples: lower, sem pontuacao, sem espacos duplicados.
3. Gerar embedding ou classificacao semantica no backend.
4. Achar cluster semelhante dentro da sala.
5. Extrair resposta final da IA em formato estruturado.
6. Comparar com entradas do cluster.
7. Atualizar `RoomClusterDoc`.
8. Criar notificacao para usuarios divergentes.

Prompt interno do comparador deve retornar JSON:

```json
{
  "questionSimilarity": 0.91,
  "answerType": "multiple_choice",
  "canonicalQuestion": "...",
  "extractedAnswer": "B",
  "confidence": 0.86,
  "isDivergent": false,
  "reason": "..."
}
```

## App Files

Criar:
- `src/types/rooms.ts`
- `src/stores/roomStore.ts`
- `src/services/rooms/client.ts`
- `src/services/rooms/listeners.ts`
- `src/pages/RoomsPage.tsx`
- `src/components/Rooms/RoomList.tsx`
- `src/components/Rooms/RoomHeader.tsx`
- `src/components/Rooms/RoomJoinModal.tsx`
- `src/components/Rooms/RoomNotifications.tsx`
- `src/components/Rooms/RoomChatWindow.tsx`
- `src/components/Rooms/RoomConsensusPanel.tsx`
- `src/components/Rooms/__tests__/RoomJoinModal.test.tsx`
- `src/components/Rooms/__tests__/RoomConsensusPanel.test.tsx`
- `src/stores/__tests__/roomStore.test.ts`
- `src/i18n/locales/pt-BR/rooms.json`
- `src/i18n/locales/en-US/rooms.json`
- `src/i18n/locales/es-ES/rooms.json`

Modificar:
- `src/types/index.ts`
- `src/hooks/useChat.ts`
- `src/services/ai/dispatch.ts`
- `src/services/ai/index.ts`
- `src-tauri/src/streaming.rs`
- `src/components/MainWindow/MainLayout.tsx`
- `src/components/MainWindow/Sidebar.tsx`
- `src/components/Chat/InputArea.tsx`
- `src/components/Chat/MessageList.tsx`
- `src/i18n/index.ts`

## Task 1: Contrato Backend e Seguranca

**Files**:
- Create backend routes in Worker repo: `src/routes/rooms.ts`
- Modify backend chat route: `src/routes/chat.ts`
- Test backend: `src/routes/rooms.test.ts`

**Steps**:
1. Criar contrato `RoomDoc`, `RoomMemberDoc`, `RoomEntryDoc`.
2. Criar `joinRoom(uid, roomId, idempotencyKey)`.
3. Testar saldo menor que 800.
4. Testar join duplicado sem debito duplo.
5. Testar usuario fora da sala bloqueado em `/v1/chat`.

Expected:

```bash
npm test -- rooms
# PASS rooms.test.ts
```

## Task 2: Tipos e Store no App

**Files**:
- Create: `src/types/rooms.ts`
- Create: `src/stores/roomStore.ts`
- Test: `src/stores/__tests__/roomStore.test.ts`

**Steps**:
1. Criar tipos de sala.
2. Store guarda `activeRoomId`, `rooms`, `members`, `entries`, `notifications`.
3. Acoes: `setActiveRoom`, `upsertRoom`, `upsertEntry`, `markNotificationRead`.
4. Testar merge sem duplicar entry.

Expected:

```bash
npm test -- roomStore
# PASS src/stores/__tests__/roomStore.test.ts
```

## Task 3: Servico de Salas

**Files**:
- Create: `src/services/rooms/client.ts`
- Create: `src/services/rooms/listeners.ts`
- Test: `src/services/rooms/__tests__/client.test.ts`

**Steps**:
1. `createRoom(title)`.
2. `joinRoom(roomId)`.
3. `leaveRoom(roomId)`.
4. `listenRoom(roomId)`.
5. `listenRoomEntries(roomId)`.
6. Usar `getIdToken()` e `Idempotency-Key`.

Expected:

```bash
npm test -- rooms/client
# PASS src/services/rooms/__tests__/client.test.ts
```

## Task 4: UI Salas no Shell

**Files**:
- Create: `src/pages/RoomsPage.tsx`
- Create: `src/components/Rooms/RoomList.tsx`
- Create: `src/components/Rooms/RoomJoinModal.tsx`
- Modify: `src/components/MainWindow/MainLayout.tsx`
- Modify: `src/components/MainWindow/Sidebar.tsx`

**Steps**:
1. `SidebarView` vira `'chats' | 'clipboard' | 'rooms'`.
2. Sidebar ganha botao Salas.
3. `RoomsPage` lista salas e cria/entra por codigo.
4. Join modal mostra custo 800 e saldo atual.
5. Botao join desabilita se `credits < 800`.

Expected:

```bash
npm test -- RoomJoinModal
# PASS src/components/Rooms/__tests__/RoomJoinModal.test.tsx
```

## Task 5: Chat Compartilhado por Sala

**Files**:
- Create: `src/components/Rooms/RoomChatWindow.tsx`
- Modify: `src/hooks/useChat.ts`
- Modify: `src/services/ai/dispatch.ts`
- Modify: `src/services/ai/index.ts`
- Modify: `src-tauri/src/streaming.rs`

**Steps**:
1. `sendMessage` aceita contexto opcional `{ roomId, roomShare }`.
2. `dispatchStream` envia `roomId` para `startHatStream`.
3. Rust inclui `roomId` e `roomShare` no body do Worker.
4. UI sala reutiliza `InputArea`, mas draft key vira `roomId`.
5. Ao terminar IA, sala recebe entry via Firestore listener.

Expected:

```bash
npm test -- useChat
npm test -- sanitizeBackendError
cargo test --manifest-path src-tauri/Cargo.toml
```

## Task 6: Painel Consenso e Notificacoes

**Files**:
- Create: `src/components/Rooms/RoomConsensusPanel.tsx`
- Create: `src/components/Rooms/RoomNotifications.tsx`
- Modify: `src/i18n/index.ts`
- Create: `src/i18n/locales/pt-BR/rooms.json`
- Create: `src/i18n/locales/en-US/rooms.json`
- Create: `src/i18n/locales/es-ES/rooms.json`

**Steps**:
1. Mostrar clusters por pergunta.
2. Mostrar consenso e divergencias.
3. Notificacao inline: "Sua resposta divergiu do consenso da sala".
4. Botao "ver comparacao".
5. Marcar como lida.

Expected:

```bash
npm test -- RoomConsensusPanel
npm test -- i18n
```

## Task 7: Browser Proof

**Use @browser-use.**

Checks:

1. Abrir app dev.
2. Login fake/mock ou conta dev.
3. Entrar em sala com saldo >= 800.
4. Ver saldo cair 800 uma vez.
5. Reentrar na mesma sala e provar que nao debita de novo.
6. Enviar pergunta de usuario A.
7. Enviar pergunta semelhante de usuario B.
8. Ver entry aparecer para ambos.
9. Ver painel consenso.
10. Forcar divergencia e ver notificacao.

Viewport:
- `1327x964`
- `1120x900`
- `390x844`

## Rollout

1. Feature flag backend: `roomsEnabled=false`.
2. Deploy backend com endpoints sem UI publica.
3. Habilitar UI local.
4. Testar com sala dev e usuarios dev.
5. Ativar `roomsEnabled=true` so para allowlist.
6. Depois liberar geral.

## Riscos

- Worker/backend da sala nao esta neste repo; sem ele app nao consegue debitar 800 com seguranca.
- `useChatStore` e singleton; nao misturar sala com chat normal.
- Firestore rules precisam bloquear leitura de sala para quem nao pagou.
- Perguntas abertas nao tem "errado" objetivo; UI precisa falar divergencia, nao acusar.
- Compartilhar pergunta pode vazar dado sensivel; V1 deve pedir confirmacao clara antes de entrar na sala.

## Ordem Recomendada

1. Backend join com debito 800.
2. Firestore rules/membership.
3. App `roomStore` + tela Salas.
4. Chat com `roomId`.
5. Registro de pergunta/resposta.
6. Comparador/consenso.
7. Notificacoes.
8. Browser proof real.
