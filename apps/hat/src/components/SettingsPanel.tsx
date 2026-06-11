import { useEffect, useState } from 'react';
import type { NativeBridge } from '../bridge/native';
import type { FlashAppearance, ShortcutBindings, UpdateCheck } from '../bridge/types';
import type { Platform } from '../domain/shortcuts/accelerator';
import { KeyCapture } from './KeyCapture';

interface SettingsPanelProps {
  bridge: NativeBridge;
}

function detectPlatform(): Platform {
  if (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent)) {
    return 'darwin';
  }
  return 'win32';
}

const SHORTCUT_LABELS: { key: keyof ShortcutBindings; label: string }[] = [
  { key: 'processClipboardFlash', label: 'Processar clipboard + Flash' },
  { key: 'showCorrection', label: 'Mostrar correção da sala' },
  { key: 'toggleGabarito', label: 'Mostrar/esconder gabarito' },
  { key: 'adjustFlashPosition', label: 'Ajustar posição do Flash' },
  { key: 'emergencyQuit', label: 'Fechamento de emergência' },
];

/**
 * Aba de Ajustes: aparência do Flash (opacidade, fundo on/off, cores),
 * atalhos (captura por teclas), versão do app e atualização.
 */
export function SettingsPanel({ bridge }: SettingsPanelProps) {
  const platform = detectPlatform();
  const [appearance, setAppearance] = useState<FlashAppearance | null>(null);
  const [bindings, setBindings] = useState<ShortcutBindings | null>(null);
  const [version, setVersion] = useState('—');
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([
      bridge.getFlashAppearance(),
      bridge.getShortcuts(),
      bridge.getAppVersion(),
    ]).then(([a, s, v]) => {
      if (!alive) return;
      if (a.status === 'fulfilled') setAppearance(a.value);
      if (s.status === 'fulfilled') setBindings(s.value);
      if (v.status === 'fulfilled') setVersion(v.value);
    });
    const offFail = bridge.on('shortcut:registration-failed', ({ binding, code }) => {
      setShortcutError(
        code === 'conflict'
          ? `O atalho ${binding} já está em uso por outro app. Escolha outro.`
          : `Não consegui registrar ${binding}.`,
      );
    });
    return () => {
      alive = false;
      offFail();
    };
  }, [bridge]);

  function patchAppearance(patch: Partial<FlashAppearance>) {
    setAppearance((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      void bridge.setFlashAppearance(next);
      return next;
    });
  }

  function patchShortcut(key: keyof ShortcutBindings, value: string) {
    setBindings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      setShortcutError(null);
      void bridge.setShortcuts(next).catch(() => {
        setShortcutError('Não consegui aplicar o atalho. Tente outra combinação.');
      });
      return next;
    });
  }

  async function checkUpdate() {
    setChecking(true);
    setUpdateMsg(null);
    try {
      const r: UpdateCheck = await bridge.checkForUpdate();
      setUpdateMsg(
        r.status === 'updated'
          ? `Atualização ${r.version ?? ''} baixada — reinicie o Hat para aplicar.`
          : r.status === 'uptodate'
            ? 'Você já está na versão mais recente.'
            : `Não consegui verificar agora${r.message ? ` (${r.message})` : ''}.`,
      );
    } catch {
      setUpdateMsg('Não consegui verificar agora.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto" aria-label="Ajustes">
      <h1 className="font-display m-0 text-[34px] leading-none font-extralight tracking-[-0.02em] text-text-primary">
        Ajustes
      </h1>

      {/* ── Aparência do Flash ── */}
      <h2 className="mt-7 mb-1 font-mono text-[10px] tracking-[0.2em] text-text-muted uppercase">
        Aparência do Flash
      </h2>
      {appearance && (
        <div className="flex flex-col gap-4 border-0 border-t border-solid border-t-hairline pt-4">
          <label className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-text-secondary">
              Opacidade <span className="text-text-muted">(mais baixo = mais furtivo)</span>
            </span>
            <span className="flex items-center gap-3">
              <input
                type="range"
                min={4}
                max={100}
                value={appearance.opacity}
                onChange={(e) => patchAppearance({ opacity: Number(e.target.value) })}
                className="w-44 accent-(--color-accent-default)"
                aria-label="Opacidade do Flash"
              />
              <span className="w-9 text-right font-mono text-[12px] tabular-nums text-text-primary">
                {appearance.opacity}
              </span>
            </span>
          </label>

          <label className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-text-secondary">Mostrar fundo do card</span>
            <input
              type="checkbox"
              checked={appearance.background}
              onChange={(e) => patchAppearance({ background: e.target.checked })}
              className="accent-(--color-accent-default)"
              aria-label="Mostrar fundo"
            />
          </label>

          <label className="flex items-center justify-between gap-4" style={{ opacity: appearance.background ? 1 : 0.4 }}>
            <span className="text-[13px] text-text-secondary">Cor do fundo</span>
            <input
              type="color"
              value={appearance.bgColor}
              disabled={!appearance.background}
              onChange={(e) => patchAppearance({ bgColor: e.target.value })}
              className="h-7 w-12 cursor-pointer rounded-sm border border-solid border-hairline-strong bg-transparent"
              aria-label="Cor do fundo"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-text-secondary">Cor do texto</span>
            <input
              type="color"
              value={appearance.textColor}
              onChange={(e) => patchAppearance({ textColor: e.target.value })}
              className="h-7 w-12 cursor-pointer rounded-sm border border-solid border-hairline-strong bg-transparent"
              aria-label="Cor do texto"
            />
          </label>

          {/* Preview ao vivo */}
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.15em] text-text-muted uppercase">preview</span>
            <div className="relative flex-1 rounded-sm border border-dashed border-hairline-strong p-3" style={{ minHeight: 44 }}>
              <span
                data-testid="flash-preview"
                style={{
                  display: 'inline-block',
                  opacity: Math.max(0.12, appearance.opacity / 100),
                  background: appearance.background ? appearance.bgColor : 'transparent',
                  color: appearance.textColor,
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 13,
                  textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                }}
              >
                Resposta certa: (B)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Atalhos ── */}
      <h2 className="mt-8 mb-1 font-mono text-[10px] tracking-[0.2em] text-text-muted uppercase">
        Atalhos globais
      </h2>
      {bindings && (
        <div className="border-0 border-t border-solid border-t-hairline pt-1">
          {SHORTCUT_LABELS.map(({ key, label }) => (
            <KeyCapture
              key={key}
              label={label}
              binding={bindings[key]}
              platform={platform}
              onChange={(b) => patchShortcut(key, b)}
            />
          ))}
          <p className="mt-1 mb-0 text-[11px] text-text-muted">
            Clique e pressione a combinação. Esc cancela.
          </p>
          {shortcutError && (
            <p role="alert" className="mt-1 mb-0 text-[12px]" style={{ color: 'var(--color-divergence)' }}>
              {shortcutError}
            </p>
          )}
        </div>
      )}

      {/* ── App / atualização ── */}
      <h2 className="mt-8 mb-1 font-mono text-[10px] tracking-[0.2em] text-text-muted uppercase">
        Aplicativo
      </h2>
      <div className="flex items-center justify-between gap-4 border-0 border-t border-solid border-t-hairline pt-4 pb-8">
        <span className="text-[13px] text-text-secondary">
          Versão <span className="ml-2 font-mono text-text-primary" data-testid="app-version">{version}</span>
        </span>
        <span className="flex items-center gap-3">
          {updateMsg && <span className="text-[11px] text-text-muted">{updateMsg}</span>}
          <button
            type="button"
            data-testid="check-update"
            onClick={() => void checkUpdate()}
            disabled={checking}
            className="hat-btn hat-btn-ghost"
          >
            {checking ? 'Verificando…' : 'Verificar atualização'}
          </button>
        </span>
      </div>
    </section>
  );
}
