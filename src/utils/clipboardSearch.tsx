import type React from 'react';

export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function matchesSearch(text: string, query: string): boolean {
  if (!query) return true;
  return normalizeForSearch(text).includes(normalizeForSearch(query));
}

/**
 * Renders text with case-insensitive matches wrapped in <mark>.
 * Uses plain case-insensitive match (not accent-insensitive) for the visual
 * highlight so character offsets stay aligned with the original string.
 */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const ql = query.toLowerCase();
  if (!ql) return text;

  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let nodeIndex = 0;
  while (i < text.length) {
    const idx = lower.indexOf(ql, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark
        key={`m-${nodeIndex++}`}
        style={{
          background: 'color-mix(in srgb, var(--color-accent) 28%, transparent)',
          color: 'var(--text-bright, var(--text-primary))',
          borderRadius: 2,
          padding: '0 2px',
        }}
      >
        {text.slice(idx, idx + ql.length)}
      </mark>,
    );
    i = idx + ql.length;
  }
  return <>{parts}</>;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d >= today) return time;
  if (d >= yesterday) return `Ontem ${time}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ` ${time}`;
}

export function formatFullTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/#+\s?/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
