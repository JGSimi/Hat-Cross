import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { LogOut, Loader2, CreditCard, Zap, Sparkles, Brain } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { AI_MODES, type AIMode } from '../../types/account';
import HorseLogo from '../Shared/HorseLogo';
import RechargeModal from './RechargeModal';

// Signature color per mode — mirrors ModeSelector so the tab and the chat
// picker share a consistent visual language.
const MODE_TINT: Record<AIMode, { icon: typeof Zap; hue: string; soft: string }> = {
  mini:     { icon: Zap,      hue: '#FBBF24', soft: 'rgba(251, 191, 36, 0.14)' },
  standard: { icon: Sparkles, hue: '#818CF8', soft: 'rgba(129, 140, 248, 0.14)' },
  plus:     { icon: Brain,    hue: '#C084FC', soft: 'rgba(192, 132, 252, 0.14)' },
};

// Animated integer counter — springs from previous value to current so the
// balance feels alive when a credit debit lands from the Firestore listener.
function CountUp({ value, reducedMotion }: { value: number; reducedMotion: boolean | null }) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, {
    stiffness: 140,
    damping: 22,
    mass: 0.4,
  });
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('pt-BR'));
  const [display, setDisplay] = useState(Math.round(value).toLocaleString('pt-BR'));

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(Math.round(value).toLocaleString('pt-BR'));
      return;
    }
    motionValue.set(value);
    const unsub = rounded.on('change', setDisplay);
    return unsub;
  }, [value, motionValue, rounded, reducedMotion]);

  return <>{display}</>;
}

export default function AccountTab() {
  const user = useAuthStore((s) => s.user);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  const signInError = useAuthStore((s) => s.signInError);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signOut = useAuthStore((s) => s.signOut);

  const credits = useCreditsStore((s) => s.credits);
  const creditsLoading = useCreditsStore((s) => s.isLoading);
  const selectedMode = useCreditsStore((s) => s.selectedMode);
  const setSelectedMode = useCreditsStore((s) => s.setSelectedMode);

  const [recharging, setRecharging] = useState(false);
  const reducedMotion = useReducedMotion();

  if (!user) {
    return <SignedOutView onSignIn={signInWithGoogle} isSigningIn={isSigningIn} error={signInError} />;
  }

  return (
    <>
      <SectionTitle>Sua conta</SectionTitle>
      <GlassCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
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
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--bg-primary)',
                }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                style={{
                  position: 'relative',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--surface-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  border: '2px solid var(--bg-primary)',
                }}
              >
                {(user.displayName ?? user.email ?? '?').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: -0.2,
              }}
            >
              {user.displayName ?? 'Usuário'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.email}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05, rotate: -3 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            onClick={signOut}
            aria-label="Sair"
            title="Sair"
            style={{
              background: 'transparent',
              border: '0.5px solid var(--border-subtle)',
              borderRadius: 7,
              padding: 7,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <LogOut size={13} />
          </motion.button>
        </div>
      </GlassCard>

      <SectionTitle>Saldo</SectionTitle>
      <motion.div
        layout
        style={{
          position: 'relative',
          padding: '22px 18px 18px',
          borderRadius: 14,
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, var(--surface-secondary)), var(--surface-secondary) 60%)',
          border: '0.5px solid color-mix(in srgb, var(--color-accent) 28%, var(--border-subtle))',
          overflow: 'hidden',
          marginBottom: 18,
        }}
      >
        <motion.div
          aria-hidden
          animate={
            reducedMotion
              ? undefined
              : {
                  opacity: [0.35, 0.6, 0.35],
                  scale: [1, 1.12, 1],
                }
          }
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 60%, transparent) 0%, transparent 70%)',
            filter: 'blur(24px)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'color-mix(in srgb, var(--text-muted) 60%, var(--color-accent))',
              marginBottom: 6,
            }}
          >
            Disponível
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 38,
                fontWeight: 700,
                color: 'var(--text-bright)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              {creditsLoading ? (
                <span style={{ opacity: 0.35 }}>—</span>
              ) : (
                <CountUp value={credits} reducedMotion={reducedMotion} />
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>créditos</div>
          </div>
          <motion.button
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => setRecharging(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--color-accent)',
              color: 'white',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow:
                '0 6px 16px color-mix(in srgb, var(--color-accent) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <CreditCard size={13} /> Recarregar via PIX
          </motion.button>
        </div>
      </motion.div>

      <SectionTitle>Modelo preferido</SectionTitle>
      <GlassCard>
        <p
          style={{
            fontSize: 10.5,
            color: 'var(--text-muted)',
            margin: '0 0 12px',
            lineHeight: 1.5,
          }}
        >
          Usado por padrão em novas conversas. Você pode trocar a qualquer momento no chat.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {AI_MODES.map((m) => {
            const { icon: Icon, hue, soft } = MODE_TINT[m.id];
            const active = selectedMode === m.id;
            return (
              <motion.button
                key={m.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                onClick={() => setSelectedMode(m.id)}
                style={{
                  position: 'relative',
                  padding: '12px 8px 10px',
                  borderRadius: 10,
                  background: active ? soft : 'var(--surface-secondary)',
                  color: active ? hue : 'var(--text-secondary)',
                  border: active
                    ? `1px solid ${hue}66`
                    : '0.5px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  overflow: 'hidden',
                }}
              >
                {active && (
                  <motion.span
                    aria-hidden
                    layoutId="mode-pref-glow"
                    style={{
                      position: 'absolute',
                      inset: -20,
                      background: `radial-gradient(circle, ${hue}22 0%, transparent 70%)`,
                      pointerEvents: 'none',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  />
                )}
                <Icon
                  size={16}
                  strokeWidth={active ? 2.4 : 2}
                  style={{ color: hue, position: 'relative' }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: active ? 600 : 500,
                    position: 'relative',
                    color: active ? 'var(--text-bright)' : 'var(--text-secondary)',
                  }}
                >
                  {m.label}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    position: 'relative',
                    letterSpacing: 0.1,
                  }}
                >
                  {m.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </GlassCard>

      <RechargeModal open={recharging} onClose={() => setRecharging(false)} />
    </>
  );
}

function SignedOutView({
  onSignIn,
  isSigningIn,
  error,
}: {
  onSignIn: () => Promise<void>;
  isSigningIn: boolean;
  error: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '24px 8px 8px',
        overflow: 'hidden',
      }}
    >
      {!reducedMotion && (
        <>
          <motion.div
            aria-hidden
            animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.1, 0.95, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: 10,
              left: 30,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 45%, transparent) 0%, transparent 65%)',
              filter: 'blur(32px)',
              pointerEvents: 'none',
              opacity: 0.7,
            }}
          />
          <motion.div
            aria-hidden
            animate={{ x: [0, -30, 20, 0], y: [0, 25, -15, 0], scale: [1, 0.9, 1.1, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            style={{
              position: 'absolute',
              top: 40,
              right: 20,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, transparent 65%)',
              filter: 'blur(32px)',
              pointerEvents: 'none',
              opacity: 0.6,
            }}
          />
        </>
      )}

      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        style={{ marginBottom: 18, position: 'relative' }}
      >
        <HorseLogo size={56} animated />
      </motion.div>

      <h3
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text-bright)',
          letterSpacing: -0.3,
          position: 'relative',
        }}
      >
        Entrar no Hat
      </h3>
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          margin: '8px 0 22px',
          maxWidth: 300,
          position: 'relative',
        }}
      >
        Faça login com Google para usar <strong style={{ color: 'var(--text-secondary)' }}>créditos Hat</strong> e acessar modelos top-tier sem configurar API key.
      </p>
      <motion.button
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        onClick={onSignIn}
        disabled={isSigningIn}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '11px 22px',
          borderRadius: 11,
          background: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: isSigningIn ? 'default' : 'pointer',
          opacity: isSigningIn ? 0.7 : 1,
          boxShadow:
            '0 8px 24px color-mix(in srgb, var(--color-accent) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.28)',
          minWidth: 210,
          position: 'relative',
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
            Abrindo navegador...
          </>
        ) : (
          <>
            <GoogleIcon size={14} /> Entrar com Google
          </>
        )}
      </motion.button>
      {error && (
        <p style={{ marginTop: 14, fontSize: 10.5, color: 'var(--error)', maxWidth: 300, lineHeight: 1.5, position: 'relative' }}>
          {error}
        </p>
      )}
      <p
        style={{
          marginTop: 28,
          fontSize: 10,
          color: 'var(--text-dim)',
          lineHeight: 1.5,
          maxWidth: 300,
          position: 'relative',
        }}
      >
        Dados protegidos via Firebase Auth. Saldo atualiza em tempo real assim que você recarrega.
      </p>
    </div>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'color-mix(in srgb, var(--text-muted) 70%, var(--color-accent))',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      {children}
    </h3>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'var(--glass-primary, var(--surface-secondary))',
        border: '0.5px solid var(--border-subtle)',
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}
