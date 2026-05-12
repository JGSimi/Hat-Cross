import { useEffect, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { LogOut, Loader2, CreditCard, Zap, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { AI_MODES, type AIMode } from '../../types/account';
import RechargeModal from '../Account/RechargeModal';
import Skeleton from '../Shared/Skeleton';
import TierProgressionStrip from './TierProgressionStrip';

// Signature color per mode — mirrors ModeSelector so the header and the chat
// picker share a consistent visual language.
const MODE_TINT: Record<AIMode, { icon: typeof Zap; hue: string; soft: string }> = {
  hat:       { icon: Zap,      hue: '#FBBF24', soft: 'rgba(251, 191, 36, 0.14)' },
  'hat-pro': { icon: Sparkles, hue: '#818CF8', soft: 'rgba(129, 140, 248, 0.14)' },
};

// Animated integer counter — springs from previous value to current so the
// balance feels alive when a credit debit lands from the Firestore listener.
function CountUp({ value, reducedMotion }: { value: number; reducedMotion: boolean | null }) {
  const { i18n } = useTranslation();
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, {
    stiffness: 140,
    damping: 22,
    mass: 0.4,
  });
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString(i18n.language));
  const [display, setDisplay] = useState(Math.round(value).toLocaleString(i18n.language));

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(Math.round(value).toLocaleString(i18n.language));
      return;
    }
    motionValue.set(value);
    const unsub = rounded.on('change', setDisplay);
    return unsub;
  }, [value, motionValue, rounded, reducedMotion, i18n.language]);

  return <>{display}</>;
}

function Divider() {
  return <div aria-hidden className="account-header__divider" />;
}

export default function AccountHeader() {
  const user = useAuthStore((s) => s.user);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  const signInError = useAuthStore((s) => s.signInError);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const cancelSignIn = useAuthStore((s) => s.cancelSignIn);
  const signOut = useAuthStore((s) => s.signOut);

  const credits = useCreditsStore((s) => s.credits);
  const creditsLoading = useCreditsStore((s) => s.isLoading);
  const selectedMode = useCreditsStore((s) => s.selectedMode);
  const setSelectedMode = useCreditsStore((s) => s.setSelectedMode);

  const [recharging, setRecharging] = useState(false);
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation('account');

  // --- NOT SIGNED IN: compact inline Google button + error -----------------
  if (!user) {
    return (
      <div
        className="account-header settings-card"
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 64,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--surface-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            border: '0.5px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <GoogleIcon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: -0.1,
            }}
          >
            {t('notConnected')}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-muted)',
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {t('signInHint')}
          </div>
          {signInError && (
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: 'var(--error, #ef4444)',
                lineHeight: 1.4,
              }}
            >
              {signInError}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            onClick={() => { void signInWithGoogle().catch(() => {}); }}
            disabled={isSigningIn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 9,
              background: 'var(--color-accent)',
              color: 'var(--on-accent)',
              border: 'none',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isSigningIn ? 'default' : 'pointer',
              opacity: isSigningIn ? 0.7 : 1,
              boxShadow:
                '0 4px 12px color-mix(in srgb, var(--color-accent) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            {isSigningIn ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  style={{ display: 'flex' }}
                >
                  <Loader2 size={13} />
                </motion.div>
                {t('signingIn')}
              </>
            ) : (
              <>
                <GoogleIcon size={13} /> {t('signIn')}
              </>
            )}
          </motion.button>
          {isSigningIn && (
            <button
              type="button"
              onClick={cancelSignIn}
              style={{
                padding: '8px 10px',
                borderRadius: 9,
                border: '0.5px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- SIGNED IN: 2-column header — left = identity + model picker, right = balance tile ---
  return (
    <>
      <div
        className="account-header settings-card"
        style={{ padding: '12px 14px' }}
      >
        <div className="account-header__inner">
        {/* LEFT COLUMN: identity (top) + model picker (bottom) */}
        <div className="account-header__left">
        {/* 1. Identity */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <motion.div
              aria-hidden
              animate={
                reducedMotion
                  ? undefined
                  : {
                      background: [
                        'conic-gradient(from 0deg, var(--color-accent), transparent 30%, transparent 70%, var(--color-accent))',
                        'conic-gradient(from 360deg, var(--color-accent), transparent 30%, transparent 70%, var(--color-accent))',
                      ],
                    }
              }
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: '50%',
                background:
                  'conic-gradient(from 0deg, var(--color-accent), transparent 30%, transparent 70%, var(--color-accent))',
                opacity: 0.45,
              }}
            />
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--bg-primary)',
                  display: 'block',
                }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--surface-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: 14,
                  border: '2px solid var(--bg-primary)',
                }}
              >
                {(user.displayName ?? user.email ?? '?').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: -0.1,
                lineHeight: 1.25,
              }}
              title={user.displayName ?? t('user')}
            >
              {user.displayName ?? t('user')}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                  minWidth: 0,
                }}
                title={user.email ?? undefined}
              >
                {user.email}
              </div>
              <motion.button
                whileHover={{ scale: 1.1, color: 'var(--text-secondary)' }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={signOut}
                aria-label={t('signOut')}
                title={t('signOut')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 2,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  lineHeight: 0,
                }}
              >
                <LogOut size={11} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* 2. Model picker — bottom of the left column */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          {AI_MODES.map((m) => {
            const { icon: Icon, hue, soft } = MODE_TINT[m.id];
            const active = selectedMode === m.id;
            return (
              <motion.button
                key={m.id}
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                onClick={() => setSelectedMode(m.id)}
                title={`${m.label} — ${m.description}`}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 999,
                  height: 26,
                  background: active ? soft : 'var(--surface-secondary)',
                  color: active ? hue : 'var(--text-secondary)',
                  border: active
                    ? `1px solid ${hue}66`
                    : '0.5px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                  fontSize: 10.5,
                  fontWeight: active ? 600 : 500,
                  overflow: 'hidden',
                }}
              >
                {active && (
                  <motion.span
                    aria-hidden
                    layoutId="mode-header-glow"
                    style={{
                      position: 'absolute',
                      inset: -12,
                      background: `radial-gradient(circle, ${hue}22 0%, transparent 70%)`,
                      pointerEvents: 'none',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  />
                )}
                <Icon
                  size={12}
                  strokeWidth={active ? 2.4 : 2}
                  style={{ color: hue, position: 'relative', flexShrink: 0 }}
                />
                <span
                  style={{
                    position: 'relative',
                    color: active ? 'var(--text-bright)' : 'var(--text-secondary)',
                  }}
                >
                  {m.id === 'hat-pro' ? 'Pro' : 'Hat'}
                </span>
              </motion.button>
            );
          })}
        </div>
        </div>
        {/* END LEFT COLUMN */}

        <Divider />

        {/* RIGHT COLUMN: Balance — stretched, PIX at the bottom */}
        <div className="account-header__balance">
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.7,
              color: 'color-mix(in srgb, var(--text-muted) 55%, var(--color-accent))',
              lineHeight: 1,
            }}
          >
            {t('available')}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: 'var(--text-bright)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.9,
              lineHeight: 1,
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {creditsLoading ? (
              <Skeleton
                width={120}
                height={34}
                radius={8}
                ariaLabel={t('balanceLoading', { defaultValue: 'Carregando saldo...' })}
              />
            ) : (
              <CountUp value={credits} reducedMotion={reducedMotion} />
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            onClick={() => setRecharging(true)}
            title={t('recharge')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--color-accent)',
              color: 'var(--on-accent)',
              border: 'none',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow:
                '0 4px 12px color-mix(in srgb, var(--color-accent) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)',
              alignSelf: 'stretch',
            }}
          >
            <CreditCard size={13} /> {t('recharge')}
          </motion.button>
          {/* Tier progression — surfaces the gamification arc on every
              Settings open instead of hiding it behind a scroll into the
              full ThemePicker ProgressBar. Returns null when all themes
              are unlocked. */}
          <TierProgressionStrip />
        </div>
        </div>
      </div>

      <RechargeModal open={recharging} onClose={() => setRecharging(false)} />
    </>
  );
}

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
