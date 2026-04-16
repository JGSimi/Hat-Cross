export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  if (hour >= 18 && hour < 24) return 'Boa noite';
  return 'Olá';
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatDraftAge(updatedAt: number): string | null {
  const now = Date.now();
  const diffMs = now - updatedAt;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;
  if (diffMs < ONE_DAY) return null;
  if (diffMs > SEVEN_DAYS) return null;
  const days = Math.floor(diffMs / ONE_DAY);
  if (days === 1) return 'rascunho de ontem';
  return `rascunho de ${days} dias`;
}
