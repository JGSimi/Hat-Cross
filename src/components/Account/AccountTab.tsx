import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Loader2, CreditCard, Zap, Sparkles, Brain } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { AI_MODES, type AIMode } from '../../types/account';
import HorseLogo from '../Shared/HorseLogo';
import RechargeModal from './RechargeModal';

const MODE_ICONS: Record<AIMode, typeof Zap> = {
  mini: Zap,
  standard: Sparkles,
  plus: Brain,
};

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

  if (!user) {
    return <SignedOutView onSignIn={signInWithGoogle} isSigningIn={isSigningIn} error={signInError} />;
  }

  return (
    <>
      <SectionTitle>Sua conta</SectionTitle>
      <GlassCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--surface-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              {(user.displayName ?? user.email ?? '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName ?? 'Usuário'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={signOut}
            aria-label="Sair"
            style={{
              background: 'transparent',
              border: '0.5px solid var(--border-subtle)',
              borderRadius: 7,
              padding: 6,
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
      <GlassCard>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--text-bright)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.5,
              lineHeight: 1,
            }}
          >
            {creditsLoading ? '...' : credits.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>créditos</div>
        </div>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setRecharging(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 10px var(--accent-glow, rgba(99,102,241,0.3))',
          }}
        >
          <CreditCard size={13} /> Recarregar via PIX
        </motion.button>
      </GlassCard>

      <SectionTitle>Modelo preferido</SectionTitle>
      <GlassCard>
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
          Modo usado por padrão em novas conversas. Você pode trocar a qualquer momento no chat.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {AI_MODES.map((m) => {
            const Icon = MODE_ICONS[m.id];
            const active = selectedMode === m.id;
            return (
              <motion.button
                key={m.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedMode(m.id)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 8,
                  background: active ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'var(--surface-secondary)',
                  color: active ? 'var(--color-accent)' : 'var(--text-secondary)',
                  border: active ? '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)' : '0.5px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Icon size={14} />
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{m.label}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.description}</span>
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 8px 0' }}>
      <div style={{ marginBottom: 18 }}>
        <HorseLogo size={56} animated />
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text-bright)',
          letterSpacing: -0.3,
        }}
      >
        Entrar no Hat
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: '8px 0 20px', maxWidth: 300 }}>
        Faça login com Google para usar <strong style={{ color: 'var(--text-secondary)' }}>créditos Hat</strong> e acessar os modelos top-tier sem configurar API key.
      </p>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={onSignIn}
        disabled={isSigningIn}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '10px 20px',
          borderRadius: 10,
          background: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: isSigningIn ? 'default' : 'pointer',
          opacity: isSigningIn ? 0.7 : 1,
          boxShadow: '0 2px 12px var(--accent-glow, rgba(99,102,241,0.3))',
          minWidth: 200,
        }}
      >
        {isSigningIn ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'flex' }}>
              <Loader2 size={14} />
            </motion.div>
            Abrindo navegador...
          </>
        ) : (
          <>
            <GoogleIcon size={14} />
            Entrar com Google
          </>
        )}
      </motion.button>
      {error && (
        <p style={{ marginTop: 14, fontSize: 10.5, color: 'var(--error)', maxWidth: 300, lineHeight: 1.5 }}>{error}</p>
      )}
      <p style={{ marginTop: 24, fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5, maxWidth: 300 }}>
        Se você prefere usar sua própria API key, vá em <strong style={{ color: 'var(--text-muted)' }}>Modelos & IA</strong>.
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
        letterSpacing: 0.5,
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
