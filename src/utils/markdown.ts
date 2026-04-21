import i18n from '../i18n';

export function getGreeting(): string {
  const hour = new Date().getHours();
  const ns = 'chat';
  if (hour >= 5 && hour < 12) return i18n.t('greeting.morning', { ns });
  if (hour >= 12 && hour < 18) return i18n.t('greeting.afternoon', { ns });
  if (hour >= 18 && hour < 24) return i18n.t('greeting.evening', { ns });
  return i18n.t('greeting.default', { ns });
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
  const lng = i18n.language;

  if (isToday) {
    return date.toLocaleTimeString(lng, { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return i18n.t('time.yesterday', { ns: 'common' });
  }

  return date.toLocaleDateString(lng, { day: '2-digit', month: '2-digit' });
}

export function formatDraftAge(updatedAt: number): string | null {
  const now = Date.now();
  const diffMs = now - updatedAt;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;
  if (diffMs < ONE_DAY) return null;
  if (diffMs > SEVEN_DAYS) return null;
  const days = Math.floor(diffMs / ONE_DAY);
  if (days === 1) return i18n.t('time.draftAgeYesterday', { ns: 'common' });
  return i18n.t('time.draftAgeDays', { ns: 'common', count: days });
}
