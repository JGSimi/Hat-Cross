import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  Check,
  Copy,
  CreditCard,
  MessageCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { useToastStore } from '../../stores/toastStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Tier {
  brl: number;
  credits: number;
  messages: number;
  popular: boolean;
}

const CREDITS_PER_MESSAGE_ESTIMATE = 10;
const PIX_KEY = 'joao02simi@gmail.com';
const WHATSAPP_BASE = 'https://wa.me/5545984231720';

function buildTiers(tierBrls: number[], brlToCredits: number): Tier[] {
  const sorted = [...tierBrls].sort((a, b) => a - b);
  const popularIdx = sorted.length >= 2 ? 1 : 0;
  return sorted.map((brl, idx) => {
    const credits = Math.floor(brl * brlToCredits);
    const messages = Math.round(credits / CREDITS_PER_MESSAGE_ESTIMATE);
    return { brl, credits, messages, popular: idx === popularIdx };
  });
}

function whatsappUrl(brl: number | null, email: string | null): string {
  const lines = ['Oi João! Recarreguei créditos Hat via PIX.', ''];
  if (brl != null) lines.push(`Valor: R$ ${brl}`);
  if (email) lines.push(`Meu email: ${email}`);
  lines.push('', 'Segue o comprovante:');
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export default function RechargeModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  const pricing = useCreditsStore((s) => s.pricing);
  const credits = useCreditsStore((s) => s.credits);
  const creditsLoading = useCreditsStore((s) => s.isLoading);
  const showToast = useToastStore((s) => s.showToast);
  const reducedMotion = useReducedMotion();

  const tiers = useMemo(
    () => buildTiers(pricing.tierBrls, pricing.brlToCredits),
    [pricing.tierBrls, pricing.brlToCredits],
  );

  const defaultTier = useMemo(
    () => tiers.find((t) => t.popular) ?? tiers[0] ?? null,
    [tiers],
  );
  const [selectedBrl, setSelectedBrl] = useState<number | null>(defaultTier?.brl ?? null);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    if (open && defaultTier && selectedBrl === null) {
      setSelectedBrl(defaultTier.brl);
    }
  }, [open, defaultTier, selectedBrl]);

  useEffect(() => {
    if (!open) setPixCopied(false);
  }, [open]);

  const selectedTier = useMemo(
    () => tiers.find((t) => t.brl === selectedBrl) ?? null,
    [tiers, selectedBrl],
  );

  // --- Success celebration ---
  const prevCreditsRef = useRef<number>(credits);
  const [celebration, setCelebration] = useState<{ delta: number } | null>(null);

  useEffect(() => {
    if (!open) {
      prevCreditsRef.current = credits;
      return;
    }
    if (credits > prevCreditsRef.current && !creditsLoading) {
      const delta = credits - prevCreditsRef.current;
      prevCreditsRef.current = credits;
      setCelebration({ delta });
      const t = setTimeout(() => {
        setCelebration(null);
        onClose();
      }, 2600);
      return () => clearTimeout(t);
    }
    prevCreditsRef.current = credits;
  }, [credits, creditsLoading, open, onClose]);

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2000);
    } catch {
      showToast('Não consegui copiar. Selecione manualmente.', 'error');
    }
  };

  const openWhatsApp = () => {
    if (!selectedTier) return;
    const url = whatsappUrl(selectedTier.brl, user?.email ?? null);
    invoke('open_external_url', { url }).catch(() => {
      showToast('Não consegui abrir o WhatsApp. Copie o link manualmente.', 'error', {
        duration: 5000,
      });
    });
  };

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.66)',
            backdropFilter: 'blur(14px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 460,
              maxWidth: '100%',
              maxHeight: '92vh',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-subtle)',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow:
                '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
            }}
          >
            {/* Close */}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                zIndex: 3,
                background: 'color-mix(in srgb, var(--bg-primary) 70%, transparent)',
                border: '0.5px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 7,
                display: 'flex',
                borderRadius: 8,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
              aria-label="Fechar"
            >
              <X size={14} />
            </motion.button>

            {/* Scrollable content */}
            <div style={{ maxHeight: '92vh', overflowY: 'auto' }}>
              {!user ? (
                <div style={{ padding: 26 }}>
                  <SignedOutGate onSignIn={signInWithGoogle} isSigningIn={isSigningIn} />
                </div>
              ) : (
                <>
                  {/* HERO — the star of the show */}
                  <Hero
                    selectedTier={selectedTier}
                    reducedMotion={!!reducedMotion}
                  />

                  {/* Body */}
                  <div style={{ padding: '0 22px 22px' }}>
                    {/* Tier pills row */}
                    <TierPills
                      tiers={tiers}
                      selected={selectedBrl}
                      onSelect={setSelectedBrl}
                    />

                    {/* Divider with centered label */}
                    <SectionDivider>Chave PIX</SectionDivider>

                    {/* PIX pill */}
                    <PixPill
                      pixKey={PIX_KEY}
                      copied={pixCopied}
                      onCopy={copyPix}
                    />

                    {/* Primary CTA: WhatsApp */}
                    <motion.button
                      whileHover={selectedTier ? { scale: 1.01, y: -1 } : undefined}
                      whileTap={selectedTier ? { scale: 0.99 } : undefined}
                      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                      onClick={openWhatsApp}
                      disabled={!selectedTier}
                      style={{
                        width: '100%',
                        marginTop: 14,
                        padding: '14px 18px',
                        borderRadius: 13,
                        background: selectedTier
                          ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)'
                          : 'var(--surface-secondary)',
                        color: selectedTier ? 'white' : 'var(--text-muted)',
                        fontSize: 13.5,
                        fontWeight: 600,
                        border: selectedTier
                          ? '0.5px solid rgba(255,255,255,0.2)'
                          : '0.5px solid var(--border-subtle)',
                        cursor: selectedTier ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        fontFamily: 'inherit',
                        boxShadow: selectedTier
                          ? '0 12px 32px rgba(37, 211, 102, 0.35), inset 0 1px 0 rgba(255,255,255,0.22)'
                          : 'none',
                      }}
                    >
                      <MessageCircle size={15} strokeWidth={2.2} />
                      Enviar comprovante via WhatsApp
                    </motion.button>

                    {/* Saldo atual */}
                    <div
                      style={{
                        marginTop: 14,
                        fontSize: 10.5,
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                        textAlign: 'center',
                      }}
                    >
                      Saldo atual:{' '}
                      <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {creditsLoading ? '…' : credits.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <AnimatePresence>
              {celebration && (
                <CelebrationOverlay
                  delta={celebration.delta}
                  reducedMotion={!!reducedMotion}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

// --- Sub-components ---

function Hero({
  selectedTier,
  reducedMotion,
}: {
  selectedTier: Tier | null;
  reducedMotion: boolean;
}) {
  const creditsValue = selectedTier?.credits ?? 0;

  return (
    <div
      style={{
        position: 'relative',
        padding: '38px 22px 26px',
        overflow: 'hidden',
        borderBottom: '0.5px solid var(--border-subtle)',
        background:
          'linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 22%, var(--bg-primary)) 0%, color-mix(in srgb, var(--color-accent) 6%, var(--bg-primary)) 60%, var(--bg-primary) 100%)',
      }}
    >
      {/* Glowing orb top-right */}
      <motion.div
        aria-hidden
        animate={
          reducedMotion
            ? undefined
            : {
                scale: [1, 1.08, 1],
                opacity: [0.55, 0.7, 0.55],
              }
        }
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: -100,
          right: -60,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 70%, transparent) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />
      {/* Second glow bottom-left for mesh effect */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -80,
          left: -60,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in srgb, #C084FC 45%, transparent) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          opacity: 0.4,
        }}
      />

      <div style={{ position: 'relative' }}>
        {/* Animated giant credits number */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: 'var(--text-bright)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -2,
              lineHeight: 1,
              background:
                'linear-gradient(180deg, var(--text-bright) 0%, color-mix(in srgb, var(--text-bright) 82%, var(--color-accent)) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            +<AnimatedNumber value={creditsValue} reducedMotion={reducedMotion} />
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: -0.2,
            }}
          >
            créditos
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>por</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={selectedTier?.brl ?? 'none'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              style={{
                fontWeight: 700,
                color: 'var(--text-bright)',
                padding: '2px 9px',
                borderRadius: 7,
                background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
                border: '0.5px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                letterSpacing: -0.1,
              }}
            >
              R$ {selectedTier?.brl ?? 0}
            </motion.span>
          </AnimatePresence>
          <span style={{ color: 'var(--text-muted)' }}>via PIX</span>
          {selectedTier && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 11 }}>
              ~{selectedTier.messages.toLocaleString('pt-BR')} mensagens
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AnimatedNumber({
  value,
  reducedMotion,
}: {
  value: number;
  reducedMotion: boolean;
}) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 120, damping: 20, mass: 0.5 });
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('pt-BR'));
  const [display, setDisplay] = useState(Math.round(value).toLocaleString('pt-BR'));

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(Math.round(value).toLocaleString('pt-BR'));
      return;
    }
    mv.set(value);
    const unsub = rounded.on('change', setDisplay);
    return unsub;
  }, [value, mv, rounded, reducedMotion]);

  return <>{display}</>;
}

function TierPills({
  tiers,
  selected,
  onSelect,
}: {
  tiers: Tier[];
  selected: number | null;
  onSelect: (brl: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Valores de recarga"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        margin: '18px 0 4px',
      }}
    >
      {tiers.map((t) => {
        const active = t.brl === selected;
        return (
          <motion.button
            key={t.brl}
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(t.brl)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            style={{
              position: 'relative',
              flex: '1 1 80px',
              minWidth: 80,
              padding: '10px 12px',
              borderRadius: 10,
              background: active
                ? 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #C084FC))'
                : 'var(--surface-secondary)',
              border: active
                ? '1px solid color-mix(in srgb, var(--color-accent) 60%, transparent)'
                : '0.5px solid var(--border-subtle)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'center',
              overflow: 'hidden',
              boxShadow: active
                ? '0 8px 22px color-mix(in srgb, var(--color-accent) 28%, transparent)'
                : 'none',
              transition: 'box-shadow 0.18s ease',
            }}
          >
            {t.popular && !active && (
              <div
                style={{
                  position: 'absolute',
                  top: -1,
                  right: -1,
                  fontSize: 8,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '0 9px 0 7px',
                  background: 'var(--color-accent)',
                  color: 'white',
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Popular
              </div>
            )}
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: active ? 'white' : 'var(--text-bright)',
                letterSpacing: -0.2,
                lineHeight: 1.1,
              }}
            >
              R$ {t.brl}
            </div>
            <div
              style={{
                fontSize: 9.5,
                marginTop: 2,
                color: active ? 'rgba(255,255,255,0.82)' : 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0.1,
              }}
            >
              {t.credits.toLocaleString('pt-BR')} créd.
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: '20px 0 10px',
      }}
    >
      <div style={{ flex: 1, height: 0.5, background: 'var(--border-subtle)' }} />
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'color-mix(in srgb, var(--text-muted) 60%, var(--color-accent))',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {children}
      </div>
      <div style={{ flex: 1, height: 0.5, background: 'var(--border-subtle)' }} />
    </div>
  );
}

function PixPill({
  pixKey,
  copied,
  onCopy,
}: {
  pixKey: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onCopy}
      whileHover={{ scale: 1.005, y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: copied
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--success, #16A34A) 14%, var(--surface-secondary)), var(--surface-secondary))'
          : 'var(--surface-secondary)',
        border: copied
          ? '1px solid color-mix(in srgb, var(--success, #16A34A) 38%, transparent)'
          : '0.5px solid var(--border-subtle)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 0.2s ease, border 0.2s ease',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: copied
            ? 'color-mix(in srgb, var(--success, #16A34A) 22%, transparent)'
            : 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
          color: copied ? 'var(--success, #16A34A)' : 'var(--color-accent)',
          transition: 'all 0.2s ease',
        }}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="ok"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Check size={15} strokeWidth={3} />
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CreditCard size={15} strokeWidth={2.2} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Key + label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: copied ? 'var(--success, #16A34A)' : 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            marginBottom: 2,
            transition: 'color 0.2s ease',
          }}
        >
          {copied ? 'Copiado' : 'Toque para copiar'}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-bright)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
            letterSpacing: -0.2,
          }}
          title={pixKey}
        >
          {pixKey}
        </div>
      </div>

      {/* Action indicator */}
      <div
        style={{
          flexShrink: 0,
          color: copied ? 'var(--success, #16A34A)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.2s ease',
        }}
      >
        {copied ? (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            ✓
          </span>
        ) : (
          <Copy size={13} />
        )}
      </div>
    </motion.button>
  );
}

function SignedOutGate({
  onSignIn,
  isSigningIn,
}: {
  onSignIn: () => void;
  isSigningIn: boolean;
}) {
  return (
    <div
      style={{
        padding: '28px 20px',
        borderRadius: 14,
        border: '0.5px solid var(--border-subtle)',
        background: 'var(--surface-secondary)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 13,
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), color-mix(in srgb, var(--color-accent) 8%, transparent))',
          color: 'var(--color-accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
          boxShadow: '0 0 30px color-mix(in srgb, var(--color-accent) 30%, transparent)',
        }}
      >
        <CreditCard size={24} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 6 }}>
        Entre pra recarregar
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 auto 18px', maxWidth: 320, lineHeight: 1.5 }}>
        Seu saldo fica ligado à conta Google. Entre pra ver preços e copiar a chave PIX.
      </p>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={onSignIn}
        disabled={isSigningIn}
        style={{
          padding: '10px 22px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          background: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          cursor: isSigningIn ? 'default' : 'pointer',
          opacity: isSigningIn ? 0.75 : 1,
          fontFamily: 'inherit',
          boxShadow: '0 4px 16px color-mix(in srgb, var(--color-accent) 40%, transparent)',
        }}
      >
        {isSigningIn ? 'Abrindo navegador...' : 'Entrar com Google'}
      </motion.button>
    </div>
  );
}

function CelebrationOverlay({
  delta,
  reducedMotion,
}: {
  delta: number;
  reducedMotion: boolean;
}) {
  const sparkles = reducedMotion
    ? []
    : Array.from({ length: 10 }).map((_, i) => ({
        id: i,
        x: 50 + (Math.random() - 0.5) * 260,
        y: 40 + (Math.random() - 0.5) * 200,
        delay: 0.1 + i * 0.05,
      }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(circle at center, color-mix(in srgb, var(--success, #16A34A) 20%, transparent), var(--bg-primary) 72%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        zIndex: 4,
        textAlign: 'center',
        padding: 32,
      }}
    >
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.4, 0.9], x: s.x, y: s.y }}
          transition={{ duration: 1.5, delay: s.delay, ease: 'easeOut' }}
          style={{ position: 'absolute', color: 'var(--color-accent)' }}
        >
          <Sparkles size={16} />
        </motion.div>
      ))}

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{
          width: 78,
          height: 78,
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--success, #16A34A) 22%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 70px color-mix(in srgb, var(--success, #16A34A) 55%, transparent)',
          marginBottom: 18,
        }}
      >
        <Check size={40} strokeWidth={2.5} style={{ color: 'var(--success, #16A34A)' }} />
      </motion.div>

      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: 'var(--text-bright)',
          letterSpacing: -0.6,
          marginBottom: 4,
        }}
      >
        +{delta.toLocaleString('pt-BR')} créditos
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Recebidos! Bom Hat pra você.
      </div>
    </motion.div>
  );
}
