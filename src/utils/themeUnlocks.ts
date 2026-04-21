// Centraliza a lógica de unlock de temas baseada em créditos gastos.
// O backend (hat-proxy) é a source of truth — ele escreve em
// users/{uid}.unlockedThemes ao cruzar cada milestone. Aqui no front
// fazemos fallback derivando do creditsSpent, de modo que o usuário
// ainda vê seus temas se o backend estiver atrasado ou o snapshot
// ainda não atualizou.

import {
  THEME_PRESETS,
  TIER_MILESTONES,
  FREE_THEMES,
  type AppTheme,
  type ThemePreset,
  type ThemeTier,
  type ThemeTierInfo,
} from '../types';

/**
 * Dado o total de créditos gastos (lifetime), retorna todos os temas que
 * DEVERIAM estar desbloqueados. Exclusivo segue regra igual (1M) — é
 * tratado como milestone normal na lógica, a diferença estética fica no UI.
 */
export function computeUnlocks(creditsSpent: number): AppTheme[] {
  return THEME_PRESETS
    .filter((t) => t.unlockAt <= creditsSpent)
    .map((t) => t.name);
}

/**
 * Retorna um Set união dos temas desbloqueados no Firestore (autoritativo)
 * com o fallback derivado do creditsSpent. Sempre inclui os free themes.
 */
export function resolveUnlockedSet(
  creditsSpent: number,
  firestoreUnlocked: readonly string[] | undefined,
): Set<AppTheme> {
  const result = new Set<AppTheme>(FREE_THEMES);
  // Fallback: derivado do creditsSpent
  for (const name of computeUnlocks(creditsSpent)) {
    result.add(name);
  }
  // Autoridade: o array do Firestore (pode ter temas manualmente
  // concedidos mesmo se creditsSpent ainda não bateu o milestone,
  // ex: promoções, gifts).
  if (firestoreUnlocked) {
    for (const name of firestoreUnlocked) {
      if (isAppTheme(name)) result.add(name);
    }
  }
  return result;
}

/**
 * Dado o set de desbloqueados, retorna os próximos N temas bloqueados
 * em ordem crescente de unlockAt — são estes que aparecem "com lock"
 * no picker (teaser).
 */
export function getNextLocked(
  unlocked: Set<AppTheme>,
  count: number = 3,
): ThemePreset[] {
  return THEME_PRESETS
    .filter((t) => !unlocked.has(t.name))
    .sort((a, b) => a.unlockAt - b.unlockAt)
    .slice(0, count);
}

/**
 * Progresso até o próximo tema a ser desbloqueado. Se tudo já foi
 * desbloqueado, retorna null.
 */
export function getProgressToNext(
  creditsSpent: number,
  unlocked: Set<AppTheme>,
): { next: ThemePreset; progress: number; remaining: number } | null {
  const nextTheme = THEME_PRESETS
    .filter((t) => !unlocked.has(t.name))
    .sort((a, b) => a.unlockAt - b.unlockAt)[0];

  if (!nextTheme) return null;

  const progress = nextTheme.unlockAt > 0
    ? Math.min(1, creditsSpent / nextTheme.unlockAt)
    : 1;
  const remaining = Math.max(0, nextTheme.unlockAt - creditsSpent);

  return { next: nextTheme, progress, remaining };
}

/** Agrupa temas por tier, preservando a ordem de TIER_MILESTONES. */
export function groupByTier(): Array<{ tier: ThemeTierInfo; themes: ThemePreset[] }> {
  return TIER_MILESTONES.map((tier) => ({
    tier,
    themes: THEME_PRESETS.filter((t) => t.tier === tier.tier),
  })).filter((g) => g.themes.length > 0);
}

/** Conta temas desbloqueados por tier (pra exibir "3/10" no header). */
export function countUnlockedInTier(
  tier: ThemeTier,
  unlocked: Set<AppTheme>,
): { unlocked: number; total: number } {
  const inTier = THEME_PRESETS.filter((t) => t.tier === tier);
  return {
    unlocked: inTier.filter((t) => unlocked.has(t.name)).length,
    total: inTier.length,
  };
}

/**
 * Formata números grandes pra exibição no lock badge:
 * 500 → "500", 1_000 → "1k", 50_000 → "50k", 1_000_000 → "1M".
 */
export function formatCredits(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'M';
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'k';
  }
  return String(n);
}

function isAppTheme(name: string): name is AppTheme {
  return THEME_PRESETS.some((t) => t.name === name);
}
