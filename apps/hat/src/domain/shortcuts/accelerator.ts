/**
 * Normalização pura de atalhos de teclado (accelerators).
 *
 * Forma canônica: modificadores na ordem CommandOrControl, Super, Alt, Shift,
 * seguidos de exatamente uma tecla final ('CommandOrControl+Alt+Shift+F').
 * Espelhado em crates/hat-core/src/accelerator.rs via
 * fixtures/accelerator-cases.json — mantenha os dois lados em sincronia.
 */

export type Platform = 'darwin' | 'win32';

type CanonicalModifier = 'CommandOrControl' | 'Super' | 'Alt' | 'Shift';

const MODIFIER_ORDER: readonly CanonicalModifier[] = [
  'CommandOrControl',
  'Super',
  'Alt',
  'Shift',
];

const MODIFIER_ALIASES: Readonly<Record<string, CanonicalModifier>> = {
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  cmd: 'CommandOrControl',
  command: 'CommandOrControl',
  ctrl: 'CommandOrControl',
  control: 'CommandOrControl',
  meta: 'CommandOrControl',
  super: 'Super',
  win: 'Super',
  windows: 'Super',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
};

const DARWIN_SYMBOLS: Readonly<Record<CanonicalModifier, string>> = {
  CommandOrControl: '⌘', // ⌘
  Super: '⌘', // ⌘ (Super é a tecla Command no macOS)
  Alt: '⌥', // ⌥
  Shift: '⇧', // ⇧
};

const WIN32_LABELS: Readonly<Record<CanonicalModifier, string>> = {
  CommandOrControl: 'Ctrl',
  Super: 'Win',
  Alt: 'Alt',
  Shift: 'Shift',
};

/** Codes de keydown que são os próprios modificadores — nunca tecla final. */
const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

const KEY_CODE_RE = /^key([a-z])$/i;
const DIGIT_CODE_RE = /^digit([0-9])$/i;
const FUNCTION_KEY_RE = /^f([1-9]|1[0-9]|2[0-4])$/i;
const SINGLE_ALNUM_RE = /^[a-z0-9]$/i;

/** Normaliza um token de tecla final ('KeyF' → 'F', 'Digit1' → '1', 'f' → 'F'). */
function normalizeKeyToken(token: string): string | null {
  const keyMatch = KEY_CODE_RE.exec(token);
  if (keyMatch?.[1] !== undefined) {
    return keyMatch[1].toUpperCase();
  }
  const digitMatch = DIGIT_CODE_RE.exec(token);
  if (digitMatch?.[1] !== undefined) {
    return digitMatch[1];
  }
  const fnMatch = FUNCTION_KEY_RE.exec(token);
  if (fnMatch?.[1] !== undefined) {
    return `F${fnMatch[1]}`;
  }
  if (SINGLE_ALNUM_RE.test(token)) {
    return token.toUpperCase();
  }
  // Teclas nomeadas (Space, Escape, ...): capitaliza a primeira letra.
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * Normaliza um binding para a forma canônica, ou null se inválido
 * (sem tecla final, mais de uma tecla, segmento vazio ou nenhum
 * modificador não-Shift).
 */
export function normalize(binding: string): string | null {
  const parts = binding.split('+').map((part) => part.trim());
  if (parts.some((part) => part === '')) {
    return null;
  }

  const modifiers = new Set<CanonicalModifier>();
  let key: string | null = null;

  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier !== undefined) {
      modifiers.add(modifier);
      continue;
    }
    if (key !== null) {
      return null; // duas teclas finais
    }
    key = normalizeKeyToken(part);
    if (key === null) {
      return null;
    }
  }

  if (key === null) {
    return null; // sem tecla final
  }

  const hasNonShiftModifier = MODIFIER_ORDER.some(
    (modifier) => modifier !== 'Shift' && modifiers.has(modifier)
  );
  if (!hasNonShiftModifier) {
    return null;
  }

  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return [...ordered, key].join('+');
}

/** True se o binding normaliza para uma forma canônica válida. */
export function isValid(binding: string): boolean {
  return normalize(binding) !== null;
}

/**
 * Rótulo de exibição por plataforma: símbolos colados no darwin ('⌘⇧F'),
 * nomes separados por '+' no win32 ('Ctrl+Shift+F').
 * Retorna string vazia para binding inválido.
 */
export function displayLabel(binding: string, platform: Platform): string {
  const canonical = normalize(binding);
  if (canonical === null) {
    return '';
  }

  const parts = canonical.split('+');
  const key = parts.pop() ?? '';
  const modifiers = parts as CanonicalModifier[];

  if (platform === 'darwin') {
    return modifiers.map((modifier) => DARWIN_SYMBOLS[modifier]).join('') + key;
  }
  return [...modifiers.map((modifier) => WIN32_LABELS[modifier]), key].join('+');
}

export interface AcceleratorKeyboardEvent {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Constrói um binding canônico a partir de um KeyboardEvent (usa event.code
 * para paridade de layout físico). No darwin, metaKey vira CommandOrControl
 * e ctrlKey é ignorado (Control puro do macOS não tem representação
 * cross-platform); no win32, ctrlKey vira CommandOrControl e metaKey vira
 * Super. Retorna null se não formar binding válido.
 */
export function fromKeyboardEvent(
  event: AcceleratorKeyboardEvent,
  platform: Platform
): string | null {
  if (MODIFIER_CODES.has(event.code)) {
    return null; // keydown do próprio modificador, sem tecla final
  }

  const modifiers: CanonicalModifier[] = [];
  if (platform === 'darwin') {
    if (event.metaKey) {
      modifiers.push('CommandOrControl');
    }
  } else {
    if (event.ctrlKey) {
      modifiers.push('CommandOrControl');
    }
    if (event.metaKey) {
      modifiers.push('Super');
    }
  }
  if (event.altKey) {
    modifiers.push('Alt');
  }
  if (event.shiftKey) {
    modifiers.push('Shift');
  }

  const key = normalizeKeyToken(event.code);
  if (key === null) {
    return null;
  }

  return normalize([...modifiers, key].join('+'));
}
