import { CATS } from '../../config/cats';
import type { CatStats } from '../../game/combat';
import type { CatId } from '../../game/types';
import { t } from '../../i18n';

export const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString();

/** Role-specific stat lines (shared by the profile and the in-battle details panel). */
export function specialStats(cat: CatId, st: CatStats, cell: number): [string, string][] {
  const def = CATS[cat];
  const out: [string, string][] = [];
  if (def.attack === 'combo') out.push([t('profile.combo'), t('profile.comboVal', { n: st.comboHits, g: fmt(def.comboGap ?? 0.08, 2) })]);
  if (def.attack === 'slam') {
    out.push([t('info.splash'), t('info.splashVal', { r: fmt(st.splashRadius / cell, 2), p: Math.round(st.splashRatio * 100) })]);
    out.push([t('profile.windup'), t('profile.secs', { s: fmt(def.windup ?? 0, 2) })]);
  }
  if (def.attack === 'snipe') out.push([t('profile.aim'), t('profile.secs', { s: fmt(def.windup ?? 0, 2) })]);
  if (def.attack === 'aura') {
    out.push([t('info.slow'), t('info.slowVal', { p: Math.round(st.slowStrength * 100), s: fmt(st.slowDuration) })]);
    out.push([t('info.focus'), t('info.focusVal', { p: Math.round(st.focusBonus * 100) })]);
  }
  if (def.attack === 'ricochet') out.push([t('info.bounces'), t('info.bouncesVal', { n: st.bounces, p: Math.round((1 - st.bounceFalloff) * 100) })]);
  if (def.attack === 'pierce') out.push([t('info.pierce'), t('info.pierceVal', { l: fmt(st.pierceLength / cell, 2) })]);
  if (def.attack === 'support') out.push([t('info.buff'), t('info.buffVal', { p: Math.round(st.buffSpeed * 100), s: fmt(st.buffDuration) })]);
  if (def.attack === 'execute') out.push([t('info.execute'), t('info.executeVal', { m: fmt(st.executeMult), p: Math.round(st.executeThreshold * 100) })]);
  if (def.attack === 'poison') out.push([t('info.poison'), t('info.poisonVal', { d: fmt(st.poisonDps), s: fmt(st.poisonDuration) })]);
  return out;
}
