import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Trans, useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard as ClipboardIcon,
  Coins,
  Loader2,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react';
import HorseLogo from './HorseLogo';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { usePlatform, type Platform } from '../../hooks/usePlatform';
import { AI_MODES } from '../../types/account';

type Step = 'welcome' | 'shortcuts' | 'modes' | 'credits' | 'signin' | 'done';

const STEPS: Step[] = ['welcome', 'shortcuts', 'modes', 'credits', 'signin', 'done'];

const slideVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

// Color per mode mirrors AccountTab's MODE_TINT so the tour teaches the same
// visual language users will meet inside the app.
const MODE_TINT: Record<string, { icon: typeof Zap; hue: string; soft: string }> = {
  hat: { icon: Zap, hue: '#FBBF24', soft: 'rgba(251, 191, 36, 0.14)' },
  'hat-pro': { icon: Sparkles, hue: '#818CF8', soft: 'rgba(129, 140, 248, 0.14)' },
};

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  const user = useAuthStore((s) => s.user);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  const signInError = useAuthStore((s) => s.signInError);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const platform = usePlatform();
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation('onboarding');

  const goNext = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
    else onComplete();
  };
  const goBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // onAuthStateChanged fires; advance to the "done" step for a friendly
      // hand-off once the user is back from the browser flow.
      setStepIdx(STEPS.indexOf('done'));
    } catch {
      // signInError is already surfaced inline; stay on step.
    }
  };

  const isTerminal = step === 'done';
  const primaryLabel = isTerminal ? t('finish') : t('next');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        backdropFilter: 'blur(30px)',
      }}
    >
      {/* Ambient glow for depth */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 520,
          height: 360,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          opacity: 0.55,
        }}
      />

      <div
        style={{
          position: 'relative',
          width: 460,
          maxWidth: 'calc(100% - 32px)',
          height: 560,
          maxHeight: 'calc(100% - 64px)',
          padding: '20px 28px 22px',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 6%, var(--bg-secondary)), var(--bg-primary) 85%)',
          border: '0.5px solid color-mix(in srgb, var(--color-accent) 18%, var(--border-subtle))',
          borderRadius: 20,
          boxShadow:
            '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Header: brand + skip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HorseLogo size={22} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: -0.2,
              }}
            >
              Hat
            </span>
          </div>
          {!isTerminal && (
            <motion.button
              whileHover={{ opacity: 1 }}
              onClick={onComplete}
              aria-label={t('skipAria')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
                opacity: 0.7,
                fontFamily: 'inherit',
              }}
            >
              {t('skip')}
            </motion.button>
          )}
        </div>

        {/* Step body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                width: '100%',
                textAlign: 'center',
              }}
            >
              {step === 'welcome' && <WelcomeStep reducedMotion={!!reducedMotion} />}
              {step === 'shortcuts' && <ShortcutsStep platform={platform} />}
              {step === 'modes' && <ModesStep />}
              {step === 'credits' && <CreditsStep />}
              {step === 'signin' && (
                <SigninStep
                  user={user}
                  isSigningIn={isSigningIn}
                  signInError={signInError}
                  onSignIn={handleGoogleSignIn}
                  onSkip={goNext}
                />
              )}
              {step === 'done' && <DoneStep platform={platform} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: progress dots + navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 12,
          }}
        >
          <button
            onClick={goBack}
            disabled={stepIdx === 0}
            style={{
              visibility: stepIdx === 0 ? 'hidden' : 'visible',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'transparent',
              border: '0.5px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={12} /> {t('back')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {STEPS.map((s, i) => (
              <motion.div
                key={s}
                layout
                aria-current={i === stepIdx ? 'step' : undefined}
                animate={{
                  width: i === stepIdx ? 22 : 6,
                  backgroundColor:
                    i === stepIdx
                      ? 'var(--color-accent)'
                      : i < stepIdx
                      ? 'color-mix(in srgb, var(--color-accent) 45%, transparent)'
                      : 'var(--border-subtle)',
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                style={{ height: 6, borderRadius: 999 }}
              />
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={goNext}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 9,
              background: 'var(--color-accent)',
              color: 'var(--on-accent)',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 12px var(--accent-glow)',
              minWidth: 110,
              justifyContent: 'center',
            }}
          >
            {primaryLabel}
            {!isTerminal && <ArrowRight size={13} />}
            {isTerminal && <Check size={13} />}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ---- Steps ----

function WelcomeStep({ reducedMotion }: { reducedMotion: boolean }) {
  const { t } = useTranslation('onboarding');
  return (
    <div>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
        style={{ marginBottom: 22 }}
      >
        <HorseLogo size={76} animated={!reducedMotion} />
      </motion.div>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text-bright)',
          margin: '0 0 10px',
          letterSpacing: -0.5,
        }}
      >
        {t('welcome.title')}
      </h1>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          margin: '0 auto',
          maxWidth: 340,
        }}
      >
        {t('welcome.body')}
      </p>
    </div>
  );
}

function ShortcutsStep({ platform }: { platform: Platform }) {
  const settings = useSettingsStore((s) => s.settings);
  const { t } = useTranslation('onboarding');
  const rows = [
    {
      icon: MessageSquare,
      title: t('shortcuts.row1Title'),
      desc: t('shortcuts.row1Desc'),
      keys: formatShortcut(settings.shortcuts.floatingChat, platform),
    },
    {
      icon: ClipboardIcon,
      title: t('shortcuts.row2Title'),
      desc: t('shortcuts.row2Desc'),
      keys: formatShortcut(settings.shortcuts.clipboard, platform),
    },
  ];

  return (
    <div>
      <h2 style={stepTitle}>{t('shortcuts.title')}</h2>
      <p style={stepLede}>{t('shortcuts.lede')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22, textAlign: 'left' }}>
        {rows.map((row) => (
          <div
            key={row.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 11,
              background: 'var(--surface-secondary)',
              border: '0.5px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
                flexShrink: 0,
              }}
            >
              <row.icon size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-bright)', lineHeight: 1.3 }}>
                {row.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 2 }}>
                {row.desc}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              {row.keys.map((k, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {i > 0 && (
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.5 }}>+</span>
                  )}
                  <kbd style={kbdStyle}>{k}</kbd>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p style={{ ...stepFoot, marginTop: 14 }}>
        <Trans
          t={t}
          i18nKey="shortcuts.foot"
          components={{ strong: <span style={{ color: 'var(--text-secondary)' }} /> }}
        />
      </p>
    </div>
  );
}

function ModesStep() {
  const { t } = useTranslation('onboarding');
  return (
    <div>
      <h2 style={stepTitle}>{t('modes.title')}</h2>
      <p style={stepLede}>{t('modes.lede')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22, textAlign: 'left' }}>
        {AI_MODES.map((mode) => {
          const tint = MODE_TINT[mode.id];
          const Icon = tint.icon;
          return (
            <div
              key={mode.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px',
                borderRadius: 11,
                background: 'var(--surface-secondary)',
                border: '0.5px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: tint.soft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tint.hue,
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-bright)', letterSpacing: -0.1 }}>
                  {mode.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                  {mode.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ ...stepFoot, marginTop: 14 }}>{t('modes.foot')}</p>
    </div>
  );
}

function CreditsStep() {
  const pricing = useCreditsStore((s) => s.pricing);
  const exampleBrl = pricing.tierBrls[0] ?? 5;
  const exampleCredits = Math.floor(exampleBrl * pricing.brlToCredits);
  const exampleMessages = Math.round(exampleCredits / 10);
  const { t, i18n } = useTranslation('onboarding');

  const bullets = [
    t('credits.bullet1'),
    t('credits.bullet2'),
    t('credits.bullet3'),
  ];

  return (
    <div>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 30%, transparent), color-mix(in srgb, var(--color-accent) 10%, transparent))',
          border: '0.5px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
          color: 'var(--color-accent)',
          boxShadow: '0 10px 28px color-mix(in srgb, var(--color-accent) 20%, transparent)',
        }}
      >
        <Coins size={26} />
      </motion.div>

      <h2 style={stepTitle}>{t('credits.title')}</h2>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '18px 0 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          textAlign: 'left',
        }}
      >
        {bullets.map((b) => (
          <li
            key={b}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <Check size={9} strokeWidth={3} />
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div
        style={{
          marginTop: 18,
          padding: '12px 14px',
          borderRadius: 11,
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 14%, var(--surface-secondary)), var(--surface-secondary))',
          border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', letterSpacing: -0.3 }}>
          {t('credits.brl', { amount: exampleBrl })}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-accent)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t('credits.creditsCount', { count: exampleCredits.toLocaleString(i18n.language) })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('credits.messagesCount', { count: exampleMessages.toLocaleString(i18n.language) })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SigninStep({
  user,
  isSigningIn,
  signInError,
  onSignIn,
  onSkip,
}: {
  user: { displayName: string | null; email: string | null } | null;
  isSigningIn: boolean;
  signInError: string | null;
  onSignIn: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation('onboarding');
  if (user) {
    return (
      <div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--success) 15%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Check size={28} style={{ color: 'var(--success)' }} />
        </motion.div>
        <h2 style={stepTitle}>{t('signin.titleSigned')}</h2>
        <p style={stepLede}>
          <Trans
            t={t}
            i18nKey="signin.ledeSigned"
            values={{ name: user.displayName ?? user.email ?? '' }}
            components={{
              strong: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }} />,
            }}
          />
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={stepTitle}>{t('signin.titleGuest')}</h2>
      <p style={stepLede}>{t('signin.ledeGuest')}</p>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={onSignIn}
        disabled={isSigningIn}
        style={{
          marginTop: 24,
          padding: '11px 24px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          background: 'var(--color-accent)',
          color: 'var(--on-accent)',
          border: 'none',
          cursor: isSigningIn ? 'default' : 'pointer',
          opacity: isSigningIn ? 0.75 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minWidth: 220,
          boxShadow: '0 2px 12px var(--accent-glow)',
          fontFamily: 'inherit',
        }}
      >
        {isSigningIn ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ display: 'flex' }}
            >
              <Loader2 size={14} />
            </motion.div>
            {t('signin.opening')}
          </>
        ) : (
          <>
            <GoogleIcon size={14} /> {t('signin.googleButton')}
          </>
        )}
      </motion.button>

      {signInError && (
        <p
          style={{
            marginTop: 14,
            fontSize: 11,
            color: 'var(--error)',
            maxWidth: 320,
            margin: '14px auto 0',
            lineHeight: 1.5,
          }}
        >
          {signInError}
        </p>
      )}

      <button
        onClick={onSkip}
        style={{
          marginTop: 18,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 11.5,
          cursor: 'pointer',
          padding: '4px 8px',
          fontFamily: 'inherit',
          textDecoration: 'underline',
          textDecorationColor: 'var(--border-subtle)',
          textUnderlineOffset: 3,
        }}
      >
        {t('signin.skip')}
      </button>
    </div>
  );
}

function DoneStep({ platform }: { platform: Platform }) {
  const settings = useSettingsStore((s) => s.settings);
  const mainHotkey = formatShortcut(settings.shortcuts.floatingChat, platform).join(' + ');
  const { t } = useTranslation('onboarding');

  return (
    <div>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--success) 15%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 22px',
          boxShadow: '0 0 40px color-mix(in srgb, var(--success) 40%, transparent)',
        }}
      >
        <Check size={32} style={{ color: 'var(--success)' }} />
      </motion.div>

      <h2 style={stepTitle}>{t('done.title')}</h2>
      <p style={stepLede}>
        <Trans
          t={t}
          i18nKey="done.body"
          values={{ hotkey: mainHotkey }}
          components={{
            kbd: (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: 'var(--surface-secondary)',
                  border: '0.5px solid var(--border-subtle)',
                  color: 'var(--text-bright)',
                  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                  fontSize: 10.5,
                  fontWeight: 600,
                }}
              />
            ),
          }}
        />
      </p>
    </div>
  );
}

// ---- Helpers ----

function formatShortcut(shortcut: string, platform: Platform): string[] {
  return shortcut.split('+').map((part) => {
    if (part === 'CommandOrControl') return platform === 'macos' ? '⌘' : 'Ctrl';
    if (part === 'Command') return '⌘';
    if (part === 'Control') return 'Ctrl';
    if (part === 'Shift') return '⇧';
    if (part === 'Alt' || part === 'Option') return platform === 'macos' ? '⌥' : 'Alt';
    return part;
  });
}

const stepTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: 'var(--text-bright)',
  margin: '0 0 8px',
  letterSpacing: -0.4,
};

const stepLede: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--text-muted)',
  lineHeight: 1.55,
  margin: '0 auto',
  maxWidth: 340,
};

const stepFoot: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textAlign: 'center',
  lineHeight: 1.5,
};

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 20,
  height: 22,
  padding: '0 6px',
  borderRadius: 5,
  background: 'var(--bg-primary)',
  border: '0.5px solid var(--border-subtle)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)',
  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
  fontSize: 10.5,
  fontWeight: 600,
  color: 'var(--text-bright)',
  letterSpacing: -0.2,
};

function GoogleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20.5H24v7h11.3c-1.5 4.1-5.4 7-10.3 7-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.4 2.8l4.9-4.9C34.5 7.2 29.5 5 24 5 13.5 5 5 13.5 5 24s8.5 19 19 19c10.5 0 18.5-7.5 18.5-19 0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l5.7 4.2C13.6 15.5 18.4 12 24 12c2.8 0 5.4 1.1 7.4 2.8l4.9-4.9C34.5 7.2 29.5 5 24 5c-7.1 0-13.2 4-16.4 9.7z" />
      <path fill="#4CAF50" d="M24 43c5.4 0 10.3-2.1 14-5.5l-6.4-5.3c-2 1.3-4.6 2.1-7.6 2.1-4.8 0-8.8-3-10.3-7.1l-6 4.6C10.6 38.4 16.7 43 24 43z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20.5H24v7h11.3c-.7 2-2 3.8-3.8 5.1 0 0 0 0 0 0l6.4 5.3C38.8 34.2 43 29.6 43 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

