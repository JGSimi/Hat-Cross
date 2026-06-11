import { describe, expect, it } from 'vitest';
import { defaultSettings, migrate, type Settings } from './schema';

describe('defaultSettings', () => {
  it('tem version 2, idioma pt-BR e tema indigo', () => {
    expect(defaultSettings.version).toBe(2);
    expect(defaultSettings.language).toBe('pt-BR');
    expect(defaultSettings.theme).toBe('indigo');
  });

  it('tem os atalhos padrão documentados', () => {
    expect(defaultSettings.shortcuts).toEqual({
      processClipboardFlash: 'CommandOrControl+Shift+F',
      adjustFlashPosition: 'CommandOrControl+Alt+F',
      emergencyQuit: 'CommandOrControl+Shift+Q',
      showCorrection: 'CommandOrControl+Shift+D',
      toggleGabarito: 'CommandOrControl+Shift+G',
    });
  });

  it('tem flash em (24,24) com opacidade baixa (stealth) e sem monitorLabel', () => {
    expect(defaultSettings.flash.position.x).toBe(24);
    expect(defaultSettings.flash.position.y).toBe(24);
    expect(defaultSettings.flash.position.monitorLabel).toBeUndefined();
    // Quase invisível por padrão.
    expect(defaultSettings.flash.opacity).toBe(16);
    expect(defaultSettings.flash.opacity).toBeLessThan(30);
  });
});

describe('migrate', () => {
  it('retorna defaults quando o disco entrega null', () => {
    expect(migrate(null)).toEqual(defaultSettings);
  });

  it('retorna defaults quando o disco entrega undefined', () => {
    expect(migrate(undefined)).toEqual(defaultSettings);
  });

  it('retorna defaults para lixo não-objeto (string, número, boolean)', () => {
    expect(migrate('lixo')).toEqual(defaultSettings);
    expect(migrate(42)).toEqual(defaultSettings);
    expect(migrate(true)).toEqual(defaultSettings);
  });

  it('retorna defaults quando o JSON raiz é um array', () => {
    expect(migrate([defaultSettings])).toEqual(defaultSettings);
  });

  it('não devolve a mesma referência de defaultSettings (sem aliasing mutável)', () => {
    const migrated = migrate(null);
    expect(migrated).not.toBe(defaultSettings);
    expect(migrated.shortcuts).not.toBe(defaultSettings.shortcuts);
    expect(migrated.flash).not.toBe(defaultSettings.flash);
    expect(migrated.flash.position).not.toBe(defaultSettings.flash.position);
  });

  it('migra shortcuts.clipboard do v1 legado para processClipboardFlash', () => {
    const v1 = {
      version: 1,
      shortcuts: { clipboard: 'CommandOrControl+Shift+V' },
    };
    const migrated = migrate(v1);
    expect(migrated.shortcuts.processClipboardFlash).toBe(
      'CommandOrControl+Shift+V',
    );
  });

  it('processClipboardFlash explícito tem precedência sobre clipboard legado', () => {
    const raw = {
      shortcuts: {
        clipboard: 'CommandOrControl+Shift+V',
        processClipboardFlash: 'CommandOrControl+Shift+P',
      },
    };
    expect(migrate(raw).shortcuts.processClipboardFlash).toBe(
      'CommandOrControl+Shift+P',
    );
  });

  it('não vaza a chave legada clipboard no resultado migrado', () => {
    const migrated = migrate({
      shortcuts: { clipboard: 'CommandOrControl+Shift+V' },
    });
    expect('clipboard' in migrated.shortcuts).toBe(false);
  });

  it('clipboard legado com tipo errado é ignorado e cai para default', () => {
    const migrated = migrate({ shortcuts: { clipboard: 123 } });
    expect(migrated.shortcuts.processClipboardFlash).toBe(
      defaultSettings.shortcuts.processClipboardFlash,
    );
  });

  it('preenche seções faltantes inteiras com defaults', () => {
    const migrated = migrate({ language: 'en' });
    expect(migrated.language).toBe('en');
    expect(migrated.theme).toBe(defaultSettings.theme);
    expect(migrated.shortcuts).toEqual(defaultSettings.shortcuts);
    expect(migrated.flash).toEqual(defaultSettings.flash);
  });

  it('preenche campos faltantes dentro de shortcuts mantendo os presentes', () => {
    const migrated = migrate({
      shortcuts: { emergencyQuit: 'CommandOrControl+Q' },
    });
    expect(migrated.shortcuts.emergencyQuit).toBe('CommandOrControl+Q');
    expect(migrated.shortcuts.processClipboardFlash).toBe(
      defaultSettings.shortcuts.processClipboardFlash,
    );
    expect(migrated.shortcuts.adjustFlashPosition).toBe(
      defaultSettings.shortcuts.adjustFlashPosition,
    );
  });

  it('preenche campos faltantes dentro de flash mantendo os presentes', () => {
    const migrated = migrate({ flash: { opacity: 50 } });
    expect(migrated.flash.opacity).toBe(50);
    expect(migrated.flash.position).toEqual(defaultSettings.flash.position);
  });

  it('preenche coordenada faltante da position mantendo a presente', () => {
    const migrated = migrate({ flash: { position: { x: 100 } } });
    expect(migrated.flash.position.x).toBe(100);
    expect(migrated.flash.position.y).toBe(defaultSettings.flash.position.y);
  });

  it('preserva valores válidos existentes em todas as seções', () => {
    const completo: Settings = {
      version: 2,
      language: 'en',
      theme: 'emerald',
      shortcuts: {
        processClipboardFlash: 'CommandOrControl+Shift+1',
        adjustFlashPosition: 'CommandOrControl+Shift+2',
        emergencyQuit: 'CommandOrControl+Shift+3',
        showCorrection: 'CommandOrControl+Shift+4',
        toggleGabarito: 'CommandOrControl+Shift+5',
      },
      flash: {
        position: { x: 10, y: 200, monitorLabel: 'DELL U2723QE' },
        opacity: 70,
      },
    };
    expect(migrate(completo)).toEqual(completo);
  });

  it('language com valor fora do enum cai para default', () => {
    expect(migrate({ language: 'fr' }).language).toBe('pt-BR');
    expect(migrate({ language: 7 }).language).toBe('pt-BR');
  });

  it('theme com tipo errado cai para default', () => {
    expect(migrate({ theme: 99 }).theme).toBe('indigo');
    expect(migrate({ theme: null }).theme).toBe('indigo');
  });

  it('shortcut com tipo errado cai para default sem afetar os demais', () => {
    const migrated = migrate({
      shortcuts: {
        processClipboardFlash: 123,
        emergencyQuit: 'CommandOrControl+E',
      },
    });
    expect(migrated.shortcuts.processClipboardFlash).toBe(
      defaultSettings.shortcuts.processClipboardFlash,
    );
    expect(migrated.shortcuts.emergencyQuit).toBe('CommandOrControl+E');
  });

  it('opacity com tipo errado cai para default', () => {
    expect(migrate({ flash: { opacity: '94' } }).flash.opacity).toBe(16);
    expect(migrate({ flash: { opacity: NaN } }).flash.opacity).toBe(16);
    // valor numérico válido é preservado
    expect(migrate({ flash: { opacity: 70 } }).flash.opacity).toBe(70);
  });

  it('coordenadas de position com tipo errado caem para default individualmente', () => {
    const migrated = migrate({ flash: { position: { x: 'esq', y: 300 } } });
    expect(migrated.flash.position.x).toBe(24);
    expect(migrated.flash.position.y).toBe(300);
  });

  it('preserva monitorLabel quando é string', () => {
    const migrated = migrate({
      flash: { position: { x: 1, y: 2, monitorLabel: 'LG Ultrawide' } },
    });
    expect(migrated.flash.position.monitorLabel).toBe('LG Ultrawide');
  });

  it('descarta monitorLabel com tipo errado deixando-o undefined', () => {
    const migrated = migrate({
      flash: { position: { monitorLabel: 42 } },
    });
    expect(migrated.flash.position.monitorLabel).toBeUndefined();
  });

  it('seção com tipo errado (não-objeto) cai inteira para defaults', () => {
    const migrated = migrate({ shortcuts: 'tudo', flash: 9 });
    expect(migrated.shortcuts).toEqual(defaultSettings.shortcuts);
    expect(migrated.flash).toEqual(defaultSettings.flash);
  });

  it('normaliza version para 2 mesmo vindo de versão antiga ou inválida', () => {
    expect(migrate({ version: 1 }).version).toBe(2);
    expect(migrate({ version: 'velha' }).version).toBe(2);
    expect(migrate({}).version).toBe(2);
  });
});
