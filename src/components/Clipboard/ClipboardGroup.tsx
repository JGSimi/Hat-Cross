import { Pin } from 'lucide-react';

interface Props {
  label: string;
  count: number;
  isPinnedGroup?: boolean;
  children: React.ReactNode;
}

export default function ClipboardGroup({ label, count, isPinnedGroup, children }: Props) {
  return (
    <section
      role="group"
      aria-label={`${label} — ${count} ${count === 1 ? 'item' : 'itens'}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <header
        role="heading"
        aria-level={3}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          padding: '14px 4px 8px',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 92%, transparent) 0%, color-mix(in srgb, var(--bg-primary) 82%, transparent) 65%, transparent 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {isPinnedGroup && (
          <Pin
            size={11}
            style={{
              color: 'var(--color-accent)',
              transform: 'rotate(38deg)',
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            color: isPinnedGroup ? 'var(--color-accent)' : 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        <span
          aria-hidden
          style={{
            flex: 1,
            height: 0.5,
            background:
              'linear-gradient(to right, color-mix(in srgb, var(--text-dim, var(--text-muted)) 35%, transparent), transparent)',
            alignSelf: 'center',
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-dim, var(--text-muted))',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {count}
        </span>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}
