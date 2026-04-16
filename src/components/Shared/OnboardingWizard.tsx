import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import HorseLogo from './HorseLogo';
import { useAuthStore } from '../../stores/authStore';

type Step = 'welcome' | 'done';

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  const signInError = useAuthStore((s) => s.signInError);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // onAuthStateChanged fires, MainLayout's needsOnboarding turns false,
      // but we also flip to the "done" step for a friendly hand-off.
      setStep('done');
    } catch {
      // Error is surfaced via signInError; stay on welcome.
    }
  };

  const slideVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

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
      <div style={{ width: 400, maxHeight: '80vh', overflow: 'auto', padding: 32 }}>
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ textAlign: 'center' }}
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
                style={{ marginBottom: 24 }}
              >
                <HorseLogo size={72} animated />
              </motion.div>

              <h1 style={{
                fontSize: 24, fontWeight: 700, color: 'var(--text-bright)',
                margin: '0 0 8px', letterSpacing: -0.5,
              }}>
                Bem-vindo ao Hat
              </h1>

              <p style={{
                fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
                margin: '0 0 28px',
              }}>
                Entre com Google para usar <strong style={{ color: 'var(--text-secondary)' }}>créditos Hat</strong> e acessar modelos top-tier sem configurar nada.
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                style={{
                  padding: '11px 24px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  cursor: isSigningIn ? 'default' : 'pointer',
                  opacity: isSigningIn ? 0.75 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  minWidth: 220,
                  boxShadow: '0 2px 12px var(--accent-glow)',
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
                    <GoogleIcon size={14} /> Entrar com Google
                  </>
                )}
              </motion.button>

              {signInError && (
                <p style={{ marginTop: 14, fontSize: 11, color: 'var(--error)', maxWidth: 320, lineHeight: 1.5 }}>
                  {signInError}
                </p>
              )}
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ textAlign: 'center' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--success) 15%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <Check size={28} style={{ color: 'var(--success)' }} />
              </motion.div>

              <h2 style={{
                fontSize: 20, fontWeight: 700, color: 'var(--text-bright)',
                margin: '0 0 8px',
              }}>
                Tudo pronto!
              </h2>
              <p style={{
                fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5,
              }}>
                Você já pode conversar com o Hat. Para recarregar créditos, vá em Configurações → Conta.
              </p>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onComplete}
                style={{
                  marginTop: 20,
                  padding: '10px 28px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  background: 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 12px var(--accent-glow)',
                }}
              >
                Começar a usar <ArrowRight size={14} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
