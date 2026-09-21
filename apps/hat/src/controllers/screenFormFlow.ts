import type { NativeBridge } from '../bridge/native';
import type { StreamRequest } from '../bridge/types';

type Point = { x: number; y: number };
type Option = { id: string; text: string; target: Point };
type Question = {
  id: string;
  type: 'multiple_choice' | 'checkbox' | 'text';
  prompt: string;
  options?: Option[];
  inputTarget?: Point;
};
type ParsedScreen = { questions: Question[] };

const PARSER_PROMPT = [
  'Analise a captura de tela e extraia SOMENTE os campos de um formulário/questionário visível.',
  'Não resolva as questões nesta etapa. Retorne JSON puro, sem markdown.',
  'Coordenadas devem ser normalizadas de 0 a 1000 em relação à imagem inteira.',
  'Formato: {"questions":[{"id":"q1","type":"multiple_choice|checkbox|text","prompt":"...",',
  '"options":[{"id":"A","text":"...","target":{"x":0,"y":0}}],"inputTarget":{"x":0,"y":0}}]}.',
  'target deve apontar para o centro clicável do radio/checkbox/campo. Omita campos que não se aplicam.',
].join(' ');

function cleanJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? raw).trim();
}

function parseScreen(raw: string): ParsedScreen {
  const parsed = JSON.parse(cleanJson(raw)) as ParsedScreen;
  if (!Array.isArray(parsed.questions)) throw new Error('Parser não retornou questions.');
  return parsed;
}

function request(base: Omit<StreamRequest, 'messages' | 'images' | 'systemPrompt' | 'maxTokens' | 'temperature'>, text: string, images: string[] = []): StreamRequest {
  return {
    ...base,
    messages: [{ role: 'user', textContent: text, images: [] }],
    images,
    systemPrompt: 'Siga exatamente o formato solicitado pelo usuário. Não use markdown.',
    temperature: 0.1,
    maxTokens: images.length ? 4096 : 1024,
  };
}

function mcPrompt(q: Question): string {
  const opts = (q.options ?? []).map((o) => `${o.id}) ${o.text}`).join('\n');
  return `${q.prompt}\n\n${opts}\n\nResponda somente com a alternativa correta.`;
}

function firstOptionId(raw: string, options: Option[]): string | null {
  const normalized = raw.trim().toUpperCase();
  return options.find((o) => normalized.startsWith(o.id.toUpperCase()))?.id ?? null;
}

function pointToScreen(p: Point, width: number, height: number): Point {
  return { x: (p.x / 1000) * width, y: (p.y / 1000) * height };
}

export interface ScreenFormFlowDeps {
  bridge: NativeBridge;
  getIdToken: () => Promise<string>;
  newStreamId: () => number;
  newIdempotencyKey: () => string;
  onError?: (error: unknown) => void;
}

export function startScreenFormFlow(deps: ScreenFormFlowDeps): () => void {
  return deps.bridge.on('beta:screen-solve', () => {
    void (async () => {
      try {
        const [capture, idToken] = await Promise.all([deps.bridge.captureScreen(), deps.getIdToken()]);
        await deps.bridge.flashShowText('Analisando tela…');
        const base = {
          streamId: deps.newStreamId(),
          mode: 'hat' as const,
          clientVariant: 'beta-jev' as const,
          idToken,
          idempotencyKey: deps.newIdempotencyKey(),
        };
        const raw = await deps.bridge.completeStream(request(base, PARSER_PROMPT, [capture.base64Png]));
        const parsed = parseScreen(raw);
        if (!parsed.questions.length) {
          await deps.bridge.flashShowText('Nenhuma questão detectada.');
          return;
        }

        await deps.bridge.flashShowText(`${parsed.questions.length} questões detectadas…`);
        let filled = 0;
        for (const q of parsed.questions) {
          if (q.type === 'multiple_choice' && q.options?.length) {
            const answer = await deps.bridge.completeStream(request(
              { ...base, streamId: deps.newStreamId(), idempotencyKey: deps.newIdempotencyKey() },
              mcPrompt(q),
            ));
            const id = firstOptionId(answer, q.options);
            const option = id ? q.options.find((o) => o.id === id) : undefined;
            if (!option) continue;
            const p = pointToScreen(option.target, capture.logicalWidth, capture.logicalHeight);
            await deps.bridge.clickScreen(p.x, p.y);
            filled += 1;
            await new Promise((resolve) => setTimeout(resolve, 90));
            continue;
          }

          if (q.type === 'text' && q.inputTarget) {
            const answer = await deps.bridge.completeStream(request(
              { ...base, streamId: deps.newStreamId(), idempotencyKey: deps.newIdempotencyKey() },
              `${q.prompt}\n\nResponda de forma direta e concisa, apenas com a resposta.`,
            ));
            if (!answer.trim()) continue;
            const p = pointToScreen(q.inputTarget, capture.logicalWidth, capture.logicalHeight);
            await deps.bridge.pasteScreenText(p.x, p.y, answer.trim());
            filled += 1;
            await new Promise((resolve) => setTimeout(resolve, 90));
          }
        }
        await deps.bridge.flashShowText(`${filled}/${parsed.questions.length} preenchidas`);
      } catch (error) {
        deps.onError?.(error);
        await deps.bridge.flashShowText(
          error instanceof Error ? `Screen Solve: ${error.message}` : 'Screen Solve falhou.',
        ).catch(() => {});
      }
    })();
  });
}
