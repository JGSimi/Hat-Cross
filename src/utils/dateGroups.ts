export const DATE_GROUP_ORDER = [
  'Hoje',
  'Ontem',
  'Esta semana',
  'Este mês',
  'Mais antigas',
] as const;

export type DateGroup = (typeof DATE_GROUP_ORDER)[number];

export function getDateGroup(timestamp: number): DateGroup {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  if (date >= today) return 'Hoje';
  if (date >= yesterday) return 'Ontem';
  if (date >= weekAgo) return 'Esta semana';
  if (date >= monthAgo) return 'Este mês';
  return 'Mais antigas';
}

export function groupByDate<T>(
  items: T[],
  getTimestamp: (item: T) => number,
): Map<DateGroup, T[]> {
  const groups = new Map<DateGroup, T[]>();
  for (const item of items) {
    const group = getDateGroup(getTimestamp(item));
    const existing = groups.get(group) ?? [];
    existing.push(item);
    groups.set(group, existing);
  }
  const sorted = new Map<DateGroup, T[]>();
  for (const key of DATE_GROUP_ORDER) {
    if (groups.has(key)) sorted.set(key, groups.get(key)!);
  }
  return sorted;
}
