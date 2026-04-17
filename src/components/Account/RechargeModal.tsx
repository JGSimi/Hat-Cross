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
  Wallet,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { useToastStore } from '../../stores/toastStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

type TierTone = 'starter' | 'popular' | 'pro' | 'power';

interface Tier {
  brl: number;
  credits: number;
  messages: number;
  tone: TierTone;
}

// Rough "messages per tier" estimate, assuming ~10 credits per Hat (standard)
// short message. Keeps the copy grounded without pretending to be exact.
const CREDITS_PER_MESSAGE_ESTIMATE = 10;

const PIX_KEY = 'joao02simi@gmail.com';
const WHATSAPP_BASE = 'https://wa.me/5545984231720';

function buildTiers(tierBrls: number[], brlToCredits: number): Tier[] {
  const sorted = [...tierBrls].sort((a, b) => a - b);
  const popularIdx = sorted.length >= 2 ? 1 : 0;
  const toneFor = (idx: number, total: number): TierTone => {
    if (idx === popularIdx) return 'popular';
    if (idx === 0) return 'starter';
    if (idx === total - 1) return 'power';
    return 'pro';
  };
  return sorted.map((brl, idx) => {
    const credits = Math.floor(brl * brlToCredits);
    const messages = Math.round(credits / CREDITS_PER_MESSAGE_ESTIMATE);
    return { brl, credits, messages, tone: toneFor(idx, sorted.length) };
  });
}

function whatsappUrl(brl: number | null, uid: string | null): string {
  const lines = ['Oi João! Recarreguei créditos Hat via PIX.', ''];
  if (brl != null) lines.push(`Valor: R$ ${brl}`);
  if (uid) lines.push(`Meu ID: ${uid}`);
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

  // Pre-select the "popular" tier so the user lands on a sensible default
  // and the WhatsApp CTA is ready without an extra click.
  const defaultTier = useMemo(
    () => tiers.find((t) => t.tone === 'popular') ?? tiers[0] ?? null,
    [tiers],
  );
  const [selectedBrl, setSelectedBrl] = useState<number | null>(defaultTier?.brl ?? null);
  const [copied, setCopied] = useState<'uid' | 'pix' | null>(null);
  const [copyTouched, setCopyTouched] = useState(false);

  // Reset selection to default when modal opens or pricing changes.
  useEffect(() => {
    if (open && defaultTier && selectedBrl === null) {
      setSelectedBrl(defaultTier.brl);
    }
  }, [open, defaultTier, selectedBrl]);

  useEffect(() => {
    if (!open) {
      setCopyTouched(false);
      setCopied(null);
    }
  }, [open]);

  const selectedTier = useMemo(
    () => tiers.find((t) => t.brl === selectedBrl) ?? null,
    [tiers, selectedBrl],
  );

  // --- Success celebration: watch credit balance while modal is open ---
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

  // --- Actions ---
  const copy = async (text: string, which: 'uid' | 'pix') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setCopyTouched(true);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      showToast('Não consegui copiar. Selecione manualmente.', 'error');
    }
  };

  const openWhatsApp = () => {
    if (!selectedTier) return;
    setCopyTouched(true);
    const url = whatsappUrl(selectedTier.brl, user?.uid ?? null);
    invoke('open_external_url', { url }).catch(() => {
      showToast('Não consegui abrir o WhatsApp. Copie o link manualmente.', 'error', {
        duration: 5000,
      });
    });
  };

  // Stepper logic
  const stage: 1 | 2 | 3 = !selectedTier ? 1 : copyTouched ? 3 : 2;

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
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(10px) saturate(1.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 520,
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background:
                'linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 8%, var(--bg-primary)), var(--bg-primary) 60%)',
              border:
                '0.5px solid color-mix(in srgb, var(--color-accent) 22%, var(--border-subtle))',
              borderRadius: 18,
              padding: '22px 26px 24px',
              boxShadow:
                '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Ambient glow */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -80,
                right: -60,
                width: 260,
                height: 260,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 55%, transparent) 0%, transparent 70%)',
                filter: 'blur(50px)',
                pointerEvents: 'none',
                opacity: 0.5,
              }}
            />

            {/* Header */}
            <div style={{ position: 'relative', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: 'color-mix(in srgb, var(--text-muted) 55%, var(--color-accent))',
                    marginBottom: 4,
                  }}
                >
                  Recarga via PIX
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--text-bright)',
                    letterSpacing: -0.4,
                  }}
                >
                  Mais créditos pro Hat
                </h2>
              </div>

              {/* Current balance pill */}
              {user && (
                <BalanceBadge
                  credits={credits}
                  isLoading={creditsLoading}
                  reducedMotion={!!reducedMotion}
                />
              )}

              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 6,
                  display: 'flex',
                  borderRadius: 8,
                  alignSelf: 'flex-start',
                }}
                aria-label="Fechar"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Stepper */}
            <Stepper stage={stage} signedIn={!!user} />

            {/* Signed-out state: gate the whole flow behind sign-in */}
            {!user ? (
              <SignedOutGate
                onSignIn={signInWithGoogle}
                isSigningIn={isSigningIn}
              />
            ) : (
              <>
                {/* Tier grid */}
                <div style={{ position: 'relative', marginTop: 20 }}>
                  <SubHeading>1. Escolha o valor</SubHeading>
                  <div
                    role="radiogroup"
                    aria-label="Valores de recarga"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 10,
                    }}
                  >
                    {tiers.map((tier) => (
                      <TierCard
                        key={tier.brl}
                        tier={tier}
                        selected={tier.brl === selectedBrl}
                        onSelect={() => setSelectedBrl(tier.brl)}
                      />
                    ))}
                  </div>
                </div>

                {/* Summary bar */}
                <AnimatePresence mode="wait">
                  {selectedTier && (
                    <motion.div
                      key={selectedTier.brl}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                      style={{
                        marginTop: 12,
                        padding: '11px 14px',
                        borderRadius: 11,
                        background:
                          'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 14%, var(--surface-secondary)), var(--surface-secondary))',
                        border:
                          '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Você envia{' '}
                        <strong style={{ color: 'var(--text-bright)' }}>R$ {selectedTier.brl}</strong>
                        {' '}e recebe{' '}
                        <strong style={{ color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>
                          {selectedTier.credits.toLocaleString('pt-BR')} créditos
                        </strong>
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        ~{selectedTier.messages.toLocaleString('pt-BR')} mensagens
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Copy row */}
                <div style={{ marginTop: 20 }}>
                  <SubHeading>2. Copie pix e seu ID</SubHeading>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <CopyCard
                      label="Chave PIX (email)"
                      value={PIX_KEY}
                      monospace={false}
                      copiedNow={copied === 'pix'}
                      onCopy={() => copy(PIX_KEY, 'pix')}
                    />
                    <CopyCard
                      label="Seu ID Hat"
                      value={user.uid}
                      monospace
                      copiedNow={copied === 'uid'}
                      onCopy={() => copy(user.uid, 'uid')}
                    />
                  </div>
                </div>

                {/* Primary CTA */}
                <div style={{ marginTop: 18 }}>
                  <SubHeading>3. Envie o comprovante</SubHeading>
                  <motion.button
                    whileHover={selectedTier ? { scale: 1.01, y: -1 } : undefined}
                    whileTap={selectedTier ? { scale: 0.99 } : undefined}
                    transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                    onClick={openWhatsApp}
                    disabled={!selectedTier}
                    title={!selectedTier ? 'Escolha um valor primeiro' : undefined}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 11,
                      background: selectedTier
                        ? 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #A78BFA))'
                        : 'var(--surface-secondary)',
                      color: selectedTier ? 'white' : 'var(--text-muted)',
                      fontSize: 13,
                      fontWeight: 600,
                      border: selectedTier
                        ? '0.5px solid color-mix(in srgb, var(--color-accent) 60%, transparent)'
                        : '0.5px solid var(--border-subtle)',
                      cursor: selectedTier ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontFamily: 'inherit',
                      boxShadow: selectedTier
                        ? '0 8px 24px color-mix(in srgb, var(--color-accent) 25%, transparent)'
                        : 'none',
                      opacity: selectedTier ? 1 : 0.7,
                    }}
                  >
                    <MessageCircle size={14} />
                    Enviar comprovante via WhatsApp
                  </motion.button>
                </div>

                {/* Footer */}
                <p
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-dim, var(--text-muted))',
                    lineHeight: 1.5,
                    marginTop: 18,
                    marginBottom: 0,
                    textAlign: 'center',
                  }}
                >
                  Os créditos aparecem automaticamente no seu saldo assim que eu confirmar o PIX.
                </p>
              </>
            )}

            {/* Success celebration overlay */}
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

function BalanceBadge({
  credits,
  isLoading,
  reducedMotion,
}: {
  credits: number;
  isLoading: boolean;
  reducedMotion: boolean;
}) {
  const mv = useMotionValue(credits);
  const spring = useSpring(mv, { stiffness: 140, damping: 22, mass: 0.4 });
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('pt-BR'));
  const [display, setDisplay] = useState(Math.round(credits).toLocaleString('pt-BR'));

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(Math.round(credits).toLocaleString('pt-BR'));
      return;
    }
    mv.set(credits);
    const unsub = rounded.on('change', setDisplay);
    return unsub;
  }, [credits, mv, rounded, reducedMotion]);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 11px',
        borderRadius: 999,
        background: 'var(--surface-secondary)',
        border: '0.5px solid var(--border-subtle)',
        fontSize: 11,
        whiteSpace: 'nowrap',
      }}
    >
      <Wallet size={12} style={{ color: 'var(--color-accent)' }} />
      <span style={{ color: 'var(--text-muted)' }}>Saldo</span>
      <span
        style={{
          color: 'var(--text-bright)',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 28,
          textAlign: 'right',
        }}
      >
        {isLoading ? '…' : display}
      </span>
    </div>
  );
}

function Stepper({ stage, signedIn }: { stage: 1 | 2 | 3; signedIn: boolean }) {
  if (!signedIn) return null;
  const steps = [
    { n: 1, label: 'Escolher valor' },
    { n: 2, label: 'Fazer PIX' },
    { n: 3, label: 'Enviar comprovante' },
  ] as const;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 18,
      }}
    >
      {steps.map((s, i) => {
        const done = stage > s.n;
        const active = stage === s.n;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i === 2 ? 0 : 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                flexShrink: 0,
              }}
            >
              <motion.div
                animate={{
                  backgroundColor: done
                    ? 'var(--color-accent)'
                    : active
                    ? 'color-mix(in srgb, var(--color-accent) 30%, transparent)'
                    : 'var(--surface-secondary)',
                  borderColor: done || active
                    ? 'color-mix(in srgb, var(--color-accent) 60%, transparent)'
                    : 'var(--border-subtle)',
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid',
                  fontSize: 10,
                  fontWeight: 700,
                  color: done ? 'white' : active ? 'var(--color-accent)' : 'var(--text-muted)',
                }}
              >
                {done ? <Check size={11} strokeWidth={3} /> : s.n}
              </motion.div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: active ? 600 : 500,
                  color: done || active ? 'var(--text-secondary)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <motion.div
                animate={{
                  background: done
                    ? 'color-mix(in srgb, var(--color-accent) 45%, transparent)'
                    : 'var(--border-subtle)',
                }}
                style={{
                  flex: 1,
                  height: 1,
                  minWidth: 10,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
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
        marginTop: 22,
        padding: '24px 20px',
        borderRadius: 12,
        border: '0.5px solid var(--border-subtle)',
        background: 'var(--surface-secondary)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 11,
          background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
          color: 'var(--color-accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <CreditCard size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 6 }}>
        Entre pra recarregar
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 auto 16px', maxWidth: 320, lineHeight: 1.5 }}>
        Seu saldo de créditos fica na sua conta Google. Entre pra ver preços, copiar seu ID Hat e enviar o PIX.
      </p>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={onSignIn}
        disabled={isSigningIn}
        style={{
          padding: '9px 20px',
          borderRadius: 9,
          fontSize: 12.5,
          fontWeight: 600,
          background: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          cursor: isSigningIn ? 'default' : 'pointer',
          opacity: isSigningIn ? 0.75 : 1,
          fontFamily: 'inherit',
          boxShadow: '0 2px 12px var(--accent-glow)',
        }}
      >
        {isSigningIn ? 'Abrindo navegador...' : 'Entrar com Google'}
      </motion.button>
    </div>
  );
}

function TierCard({
  tier,
  selected,
  onSelect,
}: {
  tier: Tier;
  selected: boolean;
  onSelect: () => void;
}) {
  const { brl, credits, messages, tone } = tier;
  const styles = TIER_STYLES[tone];

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        position: 'relative',
        padding: '13px 14px',
        borderRadius: 12,
        background: styles.background,
        border: selected
          ? '1.5px solid var(--color-accent)'
          : styles.border,
        overflow: 'hidden',
        boxShadow: selected
          ? '0 8px 24px color-mix(in srgb, var(--color-accent) 28%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-accent) 12%, transparent)'
          : styles.shadow,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'box-shadow 0.18s ease, border 0.18s ease',
      }}
    >
      {tone === 'popular' && !selected && (
        <div style={popularBadgeStyle}>
          <Sparkles size={9} strokeWidth={2.6} /> Popular
        </div>
      )}
      {selected && (
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 4px 10px color-mix(in srgb, var(--color-accent) 45%, transparent)',
          }}
        >
          <Check size={11} strokeWidth={3} />
        </motion.div>
      )}

      <div
        style={{
          fontSize: 19,
          fontWeight: 700,
          color: 'var(--text-bright)',
          letterSpacing: -0.3,
        }}
      >
        R$ {brl}
      </div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: selected ? 'var(--color-accent)' : styles.creditsColor,
          marginTop: 2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {credits.toLocaleString('pt-BR')} créditos
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          marginTop: 4,
          letterSpacing: 0.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ~{messages.toLocaleString('pt-BR')} mensagens Hat
      </div>
    </motion.button>
  );
}

function CopyCard({
  label,
  value,
  monospace,
  copiedNow,
  onCopy,
}: {
  label: string;
  value: string;
  monospace: boolean;
  copiedNow: boolean;
  onCopy: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onCopy}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--surface-secondary)',
        border: '0.5px solid var(--border-subtle)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {label}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          {copiedNow ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'inline-flex', color: 'var(--success)' }}
            >
              <Check size={12} strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
            >
              <Copy size={12} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--text-bright)',
          fontFamily: monospace ? "'JetBrains Mono', 'SF Mono', monospace" : 'inherit',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
          fontWeight: 500,
        }}
      >
        {copiedNow ? 'Copiado!' : value}
      </span>
    </motion.button>
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
    : Array.from({ length: 6 }).map((_, i) => ({
        id: i,
        x: 50 + (Math.random() - 0.5) * 200,
        y: 40 + (Math.random() - 0.5) * 160,
        delay: 0.1 + i * 0.08,
      }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(circle at center, color-mix(in srgb, var(--success) 12%, transparent), var(--bg-primary) 70%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        zIndex: 2,
        textAlign: 'center',
        padding: 32,
      }}
    >
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.9], x: s.x, y: s.y }}
          transition={{ duration: 1.4, delay: s.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            color: 'var(--color-accent)',
          }}
        >
          <Sparkles size={14} />
        </motion.div>
      ))}

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--success) 18%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 60px color-mix(in srgb, var(--success) 50%, transparent)',
          marginBottom: 16,
        }}
      >
        <Check size={36} strokeWidth={2.5} style={{ color: 'var(--success)' }} />
      </motion.div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-bright)',
          letterSpacing: -0.4,
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

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'color-mix(in srgb, var(--text-muted) 65%, var(--color-accent))',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

// --- Styles ---

const TIER_STYLES: Record<
  TierTone,
  {
    background: string;
    border: string;
    shadow: string;
    creditsColor: string;
  }
> = {
  starter: {
    background: 'var(--surface-secondary)',
    border: '0.5px solid var(--border-subtle)',
    shadow: 'none',
    creditsColor: 'var(--text-secondary)',
  },
  popular: {
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 14%, var(--surface-secondary)), var(--surface-secondary))',
    border: '0.5px solid color-mix(in srgb, var(--color-accent) 35%, var(--border-subtle))',
    shadow: '0 4px 14px color-mix(in srgb, var(--color-accent) 15%, transparent)',
    creditsColor: 'var(--color-accent)',
  },
  pro: {
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, var(--surface-secondary)), var(--surface-secondary))',
    border: '0.5px solid color-mix(in srgb, var(--color-accent) 25%, var(--border-subtle))',
    shadow: 'none',
    creditsColor: 'color-mix(in srgb, var(--color-accent) 85%, var(--text-bright))',
  },
  power: {
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, var(--surface-secondary)) 0%, color-mix(in srgb, #C084FC 16%, var(--surface-secondary)) 100%)',
    border: '0.5px solid color-mix(in srgb, var(--color-accent) 35%, var(--border-subtle))',
    shadow: '0 6px 20px color-mix(in srgb, var(--color-accent) 14%, transparent)',
    creditsColor: 'var(--color-accent-hover, var(--color-accent))',
  },
};

const popularBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '2px 7px',
  borderRadius: 999,
  background: 'var(--color-accent)',
  color: 'white',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  boxShadow: '0 4px 10px color-mix(in srgb, var(--color-accent) 45%, transparent)',
};
