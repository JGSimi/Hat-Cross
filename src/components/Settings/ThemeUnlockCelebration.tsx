import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { THEME_PRESETS, type AppTheme, type ThemePreset } from '../../types';
import { useCreditsStore } from '../../stores/creditsStore';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';

// Celebração quando o usuário desbloqueia novo(s) tema(s).
// Funciona globalmente — é montado no App.tsx e detecta o diff do
// Set unlockedThemes do creditsStore.
//
// Persistimos os temas já "vistos" em localStorage por uid, de forma
// que: (a) primeira sincronização NÃO dispara celebração em massa para
// usuários antigos; (b) um refresh no mesmo dia não re-celebra.

const SEEN_KEY_PREFIX = 'hat.unlockSeen.';
const CELEBRATION_TTL_MS = 30_000; // auto-close se o usuário não interagir

function loadSeen(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY_PREFIX + uid);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveSeen(uid: string, seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY_PREFIX + uid, JSON.stringify([...seen]));
  } catch {
    // storage cheio / private mode — sem persistência mas sem crash
  }
}

export default function ThemeUnlockCelebration() {
  const user = useAuthStore((s) => s.user);
  const unlocked = useCreditsStore((s) => s.unlockedThemes);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setShowSettings = useSettingsStore((s) => s.setShowSettingsPanel);
  const [queue, setQueue] = useState<ThemePreset[]>([]);
  const seenRef = useRef<Set<string> | null>(null);
  const { t, i18n } = useTranslation('themes');

  // Boot: quando o user entra ou o primeiro snapshot chega, estabelece
  // a baseline. Nada é celebrado nesse momento — só depois.
  useEffect(() => {
    if (!user) {
      seenRef.current = null;
      setQueue([]);
      return;
    }
    if (seenRef.current === null) {
      const persisted = loadSeen(user.uid);
      // Se o usuário já tinha seen salvo, use como baseline. Caso
      // contrário, marque todo o estado inicial como já visto (não
      // celebra tudo de uma vez em primeira corrida).
      const baseline = persisted.size > 0 ? persisted : new Set<string>(unlocked);
      seenRef.current = baseline;
      saveSeen(user.uid, baseline);
    }
  }, [user, unlocked]);

  // Detecta novos unlocks comparando snapshot atual vs seen.
  useEffect(() => {
    if (!user || !seenRef.current) return;
    const seen = seenRef.current;
    const fresh: ThemePreset[] = [];
    for (const name of unlocked) {
      if (!seen.has(name)) {
        const preset = THEME_PRESETS.find((t) => t.name === name);
        if (preset) fresh.push(preset);
      }
    }
    if (fresh.length === 0) return;

    // Ordem: exclusivo por último (climax), depois por unlockAt crescente.
    fresh.sort((a, b) => {
      if (a.exclusive && !b.exclusive) return 1;
      if (!a.exclusive && b.exclusive) return -1;
      return a.unlockAt - b.unlockAt;
    });

    setQueue((q) => [...q, ...fresh]);
    for (const preset of fresh) seen.add(preset.name);
    saveSeen(user.uid, seen);
  }, [unlocked, user]);

  const current = queue[0] ?? null;

  // Auto-dismiss após CELEBRATION_TTL_MS se o usuário não interagir.
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, CELEBRATION_TTL_MS);
    return () => window.clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const applyNow = (name: AppTheme) => {
    document.documentElement.setAttribute('data-theme', name);
    setTheme(name);
    setQueue((q) => q.slice(1));
  };
  const viewInPicker = () => {
    setQueue((q) => q.slice(1));
    setShowSettings(true);
  };
  const dismiss = () => setQueue((q) => q.slice(1));

  // Confetti determinístico por tema — mesma paleta do tema,
  // posicionado pra sair das bordas do preview.
  const confettiColors = current.exclusive
    ? ['#B892FF', '#A9FFCB', '#AA4586', '#F4C77B', '#DDD6FE']
    : [current.primary, current.hover, current.textSecondary, current.primary, current.hover];

  return (
    <AnimatePresence>
      <motion.div
        key={current.name}
        className={`unlock-celebration ${current.exclusive ? 'is-exclusive' : ''}`}
        role="dialog"
        aria-label={`Tema desbloqueado: ${current.label}`}
        initial={{ y: 40, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -20, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        style={{
          ['--swatch-bg' as string]: current.bgPrimary,
          ['--swatch-bg-2' as string]: current.bgSecondary,
          ['--swatch-primary' as string]: current.primary,
          ['--swatch-primary-hover' as string]: current.hover,
          ['--swatch-text' as string]: current.textPrimary,
          ['--swatch-text-2' as string]: current.textSecondary,
          ['--swatch-muted' as string]: current.textMuted,
        }}
      >
        <button
          type="button"
          className="unlock-celebration__close"
          onClick={dismiss}
          aria-label="Fechar"
        >
          <X size={12} />
        </button>

        {/* Glow halo atrás do preview — pega a cor primária do tema */}
        <div className="unlock-celebration__halo" aria-hidden />

        {/* Confetti — 10 partículas disparam das bordas do preview */}
        <div className="unlock-celebration__confetti" aria-hidden>
          {confettiColors.flatMap((c, i) => [
            <motion.i
              key={`c-${i}-a`}
              style={{ background: c, boxShadow: `0 0 6px ${c}` }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: Math.cos((i / 10) * Math.PI * 2) * 90,
                y: Math.sin((i / 10) * Math.PI * 2) * 60 - 20,
                opacity: [0, 1, 0],
                scale: [0, 1, 0.4],
              }}
              transition={{ duration: 1.2, delay: 0.15 + i * 0.04, ease: 'easeOut' }}
            />,
            <motion.i
              key={`c-${i}-b`}
              style={{ background: c, boxShadow: `0 0 6px ${c}` }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: Math.cos(((i + 5) / 10) * Math.PI * 2) * 70,
                y: Math.sin(((i + 5) / 10) * Math.PI * 2) * 50 + 10,
                opacity: [0, 1, 0],
                scale: [0, 0.8, 0.3],
              }}
              transition={{ duration: 1.1, delay: 0.25 + i * 0.04, ease: 'easeOut' }}
            />,
          ])}
        </div>

        <div className="unlock-celebration__badge">
          <Sparkles size={11} />
          <span>
            {current.exclusive
              ? t('unlockCelebration.exclusiveBadge')
              : t('unlockCelebration.newBadge')}
          </span>
        </div>

        <motion.div
          className={`unlock-celebration__preview ${current.exclusive ? 'is-exclusive' : ''}`}
          initial={{ rotateZ: -6, scale: 0.8 }}
          animate={{ rotateZ: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.08 }}
        >
          {current.exclusive ? (
            <div className="unlock-celebration__prisma-bg" />
          ) : (
            <>
              <div className="unlock-celebration__preview-tl">
                <i /><i /><i />
              </div>
              <div className="unlock-celebration__preview-line" />
              <div className="unlock-celebration__preview-line unlock-celebration__preview-line--short" />
              <div className="unlock-celebration__preview-dot" />
            </>
          )}
        </motion.div>

        <div className="unlock-celebration__meta">
          <div className="unlock-celebration__label">{current.label}</div>
          <div className="unlock-celebration__sub">
            {current.exclusive
              ? t('unlockCelebration.exclusiveSub')
              : t('unlockCelebration.subCredits', {
                  count: current.unlockAt.toLocaleString(i18n.language),
                })}
          </div>
        </div>

        <div className="unlock-celebration__actions">
          <button
            type="button"
            className="unlock-celebration__btn unlock-celebration__btn--primary"
            onClick={() => applyNow(current.name)}
          >
            {t('unlockCelebration.applyNow')}
          </button>
          <button
            type="button"
            className="unlock-celebration__btn"
            onClick={viewInPicker}
          >
            {t('unlockCelebration.viewInPicker')}
          </button>
        </div>

        {queue.length > 1 && (
          <div className="unlock-celebration__queue">
            {t('unlockCelebration.queueRemaining', { count: queue.length - 1 })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
