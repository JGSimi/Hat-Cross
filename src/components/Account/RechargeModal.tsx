import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { X, Copy, Check, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

// You receive the PIX from the user, then edit `credits` in the Firebase
// Console to match the table below. Whole-real amounts × 700 credits (60%
// margin). Must mirror BRL_TO_CREDITS in hat-proxy/src/pricing.ts.
const RECHARGE_TIERS = [
  { brl: 5,  credits: 3_500,  label: '~350 mensagens Hat' },
  { brl: 10, credits: 7_000,  label: '~700 mensagens Hat' },
  { brl: 20, credits: 14_000, label: '~1.400 mensagens Hat' },
  { brl: 50, credits: 35_000, label: '~3.500 mensagens Hat' },
];

const PIX_KEY = 'joao02simi@gmail.com';
// +55 45 98423-1720. Pre-fills a PT-BR greeting so the dev knows who to expect.
const WHATSAPP_URL =
  'https://wa.me/5545984231720?text=' +
  encodeURIComponent('Oi João! Recarguei créditos Hat via PIX. Segue meu ID de usuário:');

export default function RechargeModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
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
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 440,
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: '22px 26px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>
                Recarregar créditos
              </h2>
              <button
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 0 18px' }}>
              A recarga é manual: mande o PIX pra mim (João) pelo WhatsApp junto com seu ID de usuário. Libero os créditos na sua conta em minutos.
            </p>

            <Section title="1. Faça o PIX">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Chave PIX (email)
                </div>
                <button
                  onClick={() => copy(PIX_KEY, 'pix')}
                  style={copyButton}
                >
                  {copied === 'pix' ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> {PIX_KEY}</>}
                </button>
              </div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {RECHARGE_TIERS.map((tier) => (
                  <div
                    key={tier.brl}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--surface-secondary)',
                      border: '0.5px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>R$ {tier.brl}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 600, marginTop: 1 }}>
                      {tier.credits.toLocaleString('pt-BR')} créditos
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>{tier.label}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="2. Envie seu ID de usuário">
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
                Mande o comprovante e seu ID pela conversa do WhatsApp:
              </p>
              <button
                onClick={() => copy(user?.uid ?? '', 'uid')}
                style={{
                  ...copyButton,
                  width: '100%',
                  padding: '10px 12px',
                  justifyContent: 'space-between',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.uid ?? 'faça login primeiro'}
                </span>
                {copied === 'uid' ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <button
                onClick={openWhatsApp}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 10,
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                  color: 'var(--color-accent)',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <MessageCircle size={12} /> Abrir WhatsApp
              </button>
            </Section>

            <p style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 18, marginBottom: 0, textAlign: 'center' }}>
              Os créditos aparecem automaticamente no seu saldo assim que eu confirmar o PIX.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'color-mix(in srgb, var(--text-muted) 70%, var(--color-accent))',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 10,
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
  padding: '5px 10px',
  borderRadius: 6,
  background: 'var(--surface-secondary)',
  color: 'var(--text-secondary)',
  fontSize: 10.5,
  border: '0.5px solid var(--border-subtle)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
