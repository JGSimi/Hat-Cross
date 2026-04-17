import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { X, Copy, Check, MessageCircle, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Tier hierarchy drives the visual weight: starter is muted, popular gets
// the accent ring + badge, pro steps up the glow, power gets a full gradient.
// Each tier is the same credit math (BRL × brlToCredits) — the styling just
// nudges users toward the "Popular" choice without the numbers lying about
// value. brlToCredits comes live from Firestore config/pricing so the admin
// can retune margin without shipping a new build.
type TierTone = 'starter' | 'popular' | 'pro' | 'power';

interface Tier {
  brl: number;
  credits: number;
  label: string;
  tone: TierTone;
}

// Rough "messages per tier" estimate, assuming ~10 credits per Hat (standard)
// short message. Keeps the copy grounded without pretending to be exact.
const CREDITS_PER_MESSAGE_ESTIMATE = 10;

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
    return {
      brl,
      credits,
      label: `~${messages.toLocaleString('pt-BR')} mensagens Hat`,
      tone: toneFor(idx, sorted.length),
    };
  });
}

const PIX_KEY = 'joao02simi@gmail.com';
// +55 45 98423-1720. Pre-fills a PT-BR greeting so the dev knows who to expect.
const WHATSAPP_URL =
  'https://wa.me/5545984231720?text=' +
  encodeURIComponent('Oi João! Recarreguei créditos Hat via PIX. Segue meu ID de usuário:');

export default function RechargeModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const pricing = useCreditsStore((s) => s.pricing);
  const tiers = buildTiers(pricing.tierBrls, pricing.brlToCredits);
  const [copied, setCopied] = useState<'uid' | 'pix' | null>(null);

  const copy = async (text: string, which: 'uid' | 'pix') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // noop
    }
  };

  // Tauri's webview swallows target="_blank" / href-to-http-scheme clicks
  // silently because there's no OS default handler for the in-app webview.
  // Route through the Rust `open_external_url` command instead so the URL
  // reliably opens in the user's default browser.
  const openWhatsApp = () => {
    invoke('open_external_url', { url: WHATSAPP_URL }).catch((e) => {
      console.error('[recharge] whatsapp open failed:', e);
    });
  };

  // Render through a portal so the modal escapes any ancestor stacking
  // context (e.g. the Settings sidebar's transform/z-index) and always
  // sits above the rest of the UI.
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
              width: 460,
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background:
                'linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 8%, var(--bg-primary)), var(--bg-primary) 60%)',
              border: '0.5px solid color-mix(in srgb, var(--color-accent) 22%, var(--border-subtle))',
              borderRadius: 18,
              padding: '24px 28px',
              boxShadow:
                '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Ambient glow in the top-right corner */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -60,
                right: -60,
                width: 220,
                height: 220,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 55%, transparent) 0%, transparent 70%)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
                opacity: 0.55,
              }}
            />

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      color: 'color-mix(in srgb, var(--text-muted) 55%, var(--color-accent))',
                      marginBottom: 6,
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
                  }}
                  aria-label="Fechar"
                >
                  <X size={16} />
                </motion.button>
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.55,
                  margin: '12px 0 22px',
                }}
              >
                Mande o PIX pelo WhatsApp junto com seu ID de usuário. Libero os créditos na sua conta em minutos.
              </p>

              <Section title="1. Faça o PIX">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Chave PIX (email)</div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copy(PIX_KEY, 'pix')}
                    style={copyButton}
                  >
                    {copied === 'pix' ? (
                      <>
                        <Check size={11} /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy size={11} /> {PIX_KEY}
                      </>
                    )}
                  </motion.button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {tiers.map((tier) => (
                    <TierCard key={tier.brl} tier={tier} />
                  ))}
                </div>
              </Section>

              <Section title="2. Envie seu ID de usuário">
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Copie seu ID e cole na conversa do WhatsApp junto com o comprovante:
                </p>
                <motion.button
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  onClick={() => copy(user?.uid ?? '', 'uid')}
                  style={{
                    ...copyButton,
                    width: '100%',
                    padding: '11px 14px',
                    justifyContent: 'space-between',
                    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                    fontSize: 11,
                    borderRadius: 9,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.uid ?? 'faça login primeiro'}
                  </span>
                  {copied === 'uid' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                  onClick={openWhatsApp}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    marginTop: 12,
                    padding: '9px 16px',
                    borderRadius: 9,
                    background:
                      'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), color-mix(in srgb, var(--color-accent) 10%, transparent))',
                    color: 'var(--color-accent)',
                    fontSize: 11,
                    fontWeight: 600,
                    border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <MessageCircle size={12} /> Abrir WhatsApp
                </motion.button>
              </Section>

              <p
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  lineHeight: 1.5,
                  marginTop: 20,
                  marginBottom: 0,
                  textAlign: 'center',
                }}
              >
                Os créditos aparecem automaticamente no seu saldo assim que eu confirmar o PIX.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

function TierCard({ tier }: { tier: Tier }) {
  const { brl, credits, label, tone } = tier;

  const styles = TIER_STYLES[tone];

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        position: 'relative',
        padding: '12px 14px',
        borderRadius: 11,
        background: styles.background,
        border: styles.border,
        overflow: 'hidden',
        boxShadow: styles.shadow,
      }}
    >
      {tone === 'popular' && (
        <div
          style={{
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
          }}
        >
          <Sparkles size={9} strokeWidth={2.6} /> Popular
        </div>
      )}
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text-bright)',
          letterSpacing: -0.3,
        }}
      >
        R$ {brl}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: styles.creditsColor,
          marginTop: 2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {credits.toLocaleString('pt-BR')} créditos
      </div>
      <div
        style={{
          fontSize: 9.5,
          color: 'var(--text-muted)',
          marginTop: 4,
          letterSpacing: 0.1,
        }}
      >
        {label}
      </div>
    </motion.div>
  );
}

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
    border: '1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)',
    shadow: '0 8px 20px color-mix(in srgb, var(--color-accent) 25%, transparent)',
    creditsColor: 'var(--color-accent)',
  },
  pro: {
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, var(--surface-secondary)), var(--surface-secondary))',
    border: '0.5px solid color-mix(in srgb, var(--color-accent) 32%, var(--border-subtle))',
    shadow: 'none',
    creditsColor: 'color-mix(in srgb, var(--color-accent) 85%, var(--text-bright))',
  },
  power: {
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, var(--surface-secondary)) 0%, color-mix(in srgb, #C084FC 16%, var(--surface-secondary)) 100%)',
    border: '0.5px solid color-mix(in srgb, var(--color-accent) 40%, var(--border-subtle))',
    shadow: '0 10px 26px color-mix(in srgb, var(--color-accent) 18%, transparent)',
    creditsColor: 'var(--color-accent-hover, var(--color-accent))',
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'color-mix(in srgb, var(--text-muted) 65%, var(--color-accent))',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

const copyButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 11px',
  borderRadius: 7,
  background: 'var(--surface-secondary)',
  color: 'var(--text-secondary)',
  fontSize: 10.5,
  border: '0.5px solid var(--border-subtle)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s ease, color 0.15s ease',
};
