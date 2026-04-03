import { getGreeting } from '../../utils/markdown';

export default function EmptyState() {
  const greeting = getGreeting();

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 animate-fade-in">
      {/* Hat icon with glow */}
      <div className="relative mb-4">
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-30"
          style={{ background: 'var(--color-accent)' }}
        />
        <div className="relative w-16 h-16 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center justify-center text-3xl">
          🎩
        </div>
      </div>

      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
        {greeting}
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Como posso ajudar?
      </p>

      <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
          <kbd className="font-mono text-[10px]">⌘⇧X</kbd>
          <span>Clipboard</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
          <kbd className="font-mono text-[10px]">⌘⇧Z</kbd>
          <span>Tela</span>
        </div>
      </div>
    </div>
  );
}
