import { describe, expect, it } from 'vitest';
import fixture from '../../../fixtures/accelerator-cases.json';
import { displayLabel, fromKeyboardEvent, isValid, normalize } from './accelerator';

interface NormalizeCase {
  input: string;
  expected: string | null;
}

interface ValidateCase {
  input: string;
  valid: boolean;
  reason?: string;
}

interface DisplayLabelCase {
  input: string;
  darwin: string;
  win32: string;
}

interface KeyboardEventCase {
  event: {
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  };
  platform: 'darwin' | 'win32';
  expected: string | null;
  reason?: string;
}

interface Fixture {
  normalize: NormalizeCase[];
  validate: ValidateCase[];
  displayLabel: DisplayLabelCase[];
  fromKeyboardEvent: KeyboardEventCase[];
}

const cases = fixture as unknown as Fixture;

describe('normalize — casos da fixture compartilhada', () => {
  for (const c of cases.normalize) {
    it(`normaliza '${c.input}' para '${String(c.expected)}'`, () => {
      expect(normalize(c.input)).toBe(c.expected);
    });
  }
});

describe('normalize — aliases e canonicalização extra', () => {
  it('converte meta, command e control para CommandOrControl', () => {
    expect(normalize('meta+f')).toBe('CommandOrControl+F');
    expect(normalize('command+f')).toBe('CommandOrControl+F');
    expect(normalize('control+f')).toBe('CommandOrControl+F');
  });

  it('converte win e windows para Super', () => {
    expect(normalize('win+f')).toBe('Super+F');
    expect(normalize('windows+f')).toBe('Super+F');
  });

  it('converte option e opt para Alt', () => {
    expect(normalize('option+shift+x')).toBe('Alt+Shift+X');
    expect(normalize('opt+x')).toBe('Alt+X');
  });

  it('ordena modificadores como CommandOrControl, Super, Alt, Shift', () => {
    expect(normalize('shift+alt+super+ctrl+f')).toBe(
      'CommandOrControl+Super+Alt+Shift+F'
    );
  });

  it('deduplica aliases que mapeiam para o mesmo modificador', () => {
    expect(normalize('Ctrl+Cmd+F')).toBe('CommandOrControl+F');
  });

  it('aceita teclas de função com modificador', () => {
    expect(normalize('Alt+F5')).toBe('Alt+F5');
    expect(normalize('ctrl+f12')).toBe('CommandOrControl+F12');
  });

  it('tolera espaços em volta dos segmentos', () => {
    expect(normalize(' Ctrl + Shift + F ')).toBe('CommandOrControl+Shift+F');
  });
});

describe('normalize — entradas inválidas retornam null', () => {
  it('retorna null sem tecla final', () => {
    expect(normalize('CommandOrControl+Shift')).toBeNull();
  });

  it('retorna null com duas teclas finais', () => {
    expect(normalize('Ctrl+F+G')).toBeNull();
  });

  it('retorna null quando só há Shift como modificador', () => {
    expect(normalize('Shift+F')).toBeNull();
  });

  it('retorna null para tecla sem nenhum modificador', () => {
    expect(normalize('F')).toBeNull();
  });

  it('retorna null para string vazia', () => {
    expect(normalize('')).toBeNull();
  });

  it('retorna null para segmento vazio (Ctrl++)', () => {
    expect(normalize('Ctrl++')).toBeNull();
  });
});

describe('isValid — casos da fixture compartilhada', () => {
  for (const c of cases.validate) {
    const motivo = c.reason !== undefined ? ` (${c.reason})` : '';
    it(`considera '${c.input}' ${c.valid ? 'válido' : 'inválido'}${motivo}`, () => {
      expect(isValid(c.input)).toBe(c.valid);
    });
  }
});

describe('isValid — casos extras', () => {
  it('aceita binding com alias não-canônico', () => {
    expect(isValid('cmd+shift+p')).toBe(true);
  });

  it('rejeita binding só com modificadores', () => {
    expect(isValid('Ctrl+Alt+Shift')).toBe(false);
  });
});

describe('displayLabel — casos da fixture compartilhada', () => {
  for (const c of cases.displayLabel) {
    it(`exibe '${c.input}' como '${c.darwin}' no darwin`, () => {
      expect(displayLabel(c.input, 'darwin')).toBe(c.darwin);
    });

    it(`exibe '${c.input}' como '${c.win32}' no win32`, () => {
      expect(displayLabel(c.input, 'win32')).toBe(c.win32);
    });
  }
});

describe('displayLabel — casos extras', () => {
  it('normaliza binding não-canônico antes de exibir', () => {
    expect(displayLabel('cmd+shift+f', 'darwin')).toBe('⌘⇧F');
    expect(displayLabel('ctrl+shift+f', 'win32')).toBe('Ctrl+Shift+F');
  });

  it('exibe Super como Win no win32', () => {
    expect(displayLabel('Super+Shift+F', 'win32')).toBe('Win+Shift+F');
  });

  it('retorna string vazia para binding inválido', () => {
    expect(displayLabel('Shift+F', 'darwin')).toBe('');
    expect(displayLabel('', 'win32')).toBe('');
  });
});

describe('fromKeyboardEvent — casos da fixture compartilhada', () => {
  for (const c of cases.fromKeyboardEvent) {
    const motivo = c.reason !== undefined ? ` (${c.reason})` : '';
    it(`mapeia code='${c.event.code}' em ${c.platform} para ${String(c.expected)}${motivo}`, () => {
      expect(fromKeyboardEvent(c.event, c.platform)).toBe(c.expected);
    });
  }
});

describe('fromKeyboardEvent — casos extras', () => {
  it('retorna null quando o code é o próprio modificador (keydown de Shift)', () => {
    expect(
      fromKeyboardEvent(
        { code: 'ShiftLeft', ctrlKey: false, metaKey: true, altKey: false, shiftKey: true },
        'darwin'
      )
    ).toBeNull();
  });

  it('no win32, metaKey vira Super', () => {
    expect(
      fromKeyboardEvent(
        { code: 'KeyF', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false },
        'win32'
      )
    ).toBe('Super+F');
  });

  it('no darwin, ctrlKey sozinho não forma binding (Control puro não é cross-platform)', () => {
    expect(
      fromKeyboardEvent(
        { code: 'KeyF', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
        'darwin'
      )
    ).toBeNull();
  });

  it('mapeia teclas de função pelo code', () => {
    expect(
      fromKeyboardEvent(
        { code: 'F5', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
        'win32'
      )
    ).toBe('CommandOrControl+F5');
  });

  it('não debita modificador duplicado: ctrl e meta no darwin geram um único CommandOrControl', () => {
    expect(
      fromKeyboardEvent(
        { code: 'KeyF', ctrlKey: true, metaKey: true, altKey: false, shiftKey: true },
        'darwin'
      )
    ).toBe('CommandOrControl+Shift+F');
  });
});
