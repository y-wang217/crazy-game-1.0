import { useEffect } from 'react';
import { CATS, TARGET_MODE_INFO } from '../../config/cats';
import { SKILLS, SKILL_ORDER, skillParams } from '../../config/skills';
import type { Battle, CatUnit } from '../../game/battle';
import { getCatStats, NO_MODS, type CatStats } from '../../game/combat';
import type { CosmeticLoadout, SkillId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { CatPreview } from './CatPreview';
import { GameIcon } from './GameIcon';

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString();

/** Skills currently boosting this cat (its own skills + general combat skills). */
export function bonusesFor(cat: CatUnit, b: Battle): [SkillId, number][] {
  return SKILL_ORDER.filter((id) => {
    const lv = b.skills[id] ?? 0;
    if (!lv) return false;
    const def = SKILLS[id];
    if (def.cat) return def.cat === cat.type;
    return !def.per.fish; // fish income doesn't change the cat itself
  }).map((id) => [id, b.skills[id]!]);
}

/** Effective stats (after level, skills and debug tuning) plus base stats for comparison. */
export function effectiveStats(cat: CatUnit, b: Battle): { eff: CatStats; base: CatStats } {
  const def = CATS[cat.type];
  const eff = getCatStats(def, cat.level, b.mods);
  const base = getCatStats(def, cat.level, NO_MODS);
  const k = b.tuning.catDamageMult;
  return { eff: { ...eff, damage: eff.damage * k }, base: { ...base, damage: base.damage * k } };
}

/**
 * Long-press (or right-click) details for one cat. The battle is paused while
 * it is open; tap anywhere outside or the close button to dismiss.
 */
export function CatInfoPanel({
  cat,
  battle,
  loadout,
  onClose,
}: {
  cat: CatUnit;
  battle: Battle;
  loadout: CosmeticLoadout;
  onClose: () => void;
}) {
  useLang();
  // Desktop: Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const def = CATS[cat.type];
  const { eff, base } = effectiveStats(cat, battle);
  const cell = battle.map.cell;
  const aura = def.attack === 'aura';
  const mode = TARGET_MODE_INFO[cat.mode];
  const bonuses = bonusesFor(cat, battle);

  /** "value (base)" when an upgrade changed it. */
  const cmp = (v: number, b0: number, d = 1, suffix = '') => (
    <>
      {fmt(v, d)}
      {suffix}
      {Math.abs(v - b0) > 1e-6 && (
        <span className="info-up">
          {' '}
          ▲ <s>{fmt(b0, d)}</s>
        </span>
      )}
    </>
  );

  const rows: [string, React.ReactNode][] = [];
  if (!aura) {
    rows.push([
      t('info.damage'),
      eff.comboHits > 1 ? (
        <>
          {t('info.hits', { dmg: fmt(eff.damage), n: eff.comboHits })}
          {(Math.abs(eff.damage - base.damage) > 1e-6 || eff.comboHits !== base.comboHits) && (
            <span className="info-up">
              {' '}
              ▲ <s>{t('info.hits', { dmg: fmt(base.damage), n: base.comboHits })}</s>
            </span>
          )}
        </>
      ) : (
        cmp(eff.damage, base.damage)
      ),
    ]);
  }
  rows.push([t('info.attackSpeed'), <>{t('info.perSec', { n: fmt(1 / eff.interval, 2) })}{1 / eff.interval > 1 / base.interval + 1e-6 && <span className="info-up"> ▲ <s>{fmt(1 / base.interval, 2)}</s></span>}</>]);
  rows.push([aura ? t('info.charm') : t('info.range'), cmp(eff.range / cell, base.range / cell, 2, ' ' + t('info.tiles', { n: '' }).trim())]);
  if (!aura) {
    const dps = (eff.damage * eff.comboHits) / eff.interval;
    const bdps = (base.damage * base.comboHits) / base.interval;
    rows.push([t('info.dps'), cmp(dps, bdps)]);
  }
  if (def.attack === 'slam') {
    rows.push([t('info.splash'), t('info.splashVal', { r: fmt(eff.splashRadius / cell, 2), p: Math.round(eff.splashRatio * 100) })]);
  }
  if (aura) {
    rows.push([t('info.slow'), t('info.slowVal', { p: Math.round(eff.slowStrength * 100), s: fmt(eff.slowDuration) })]);
    rows.push([t('info.focus'), t('info.focusVal', { p: Math.round(eff.focusBonus * 100) })]);
  }

  return (
    <div className="overlay info-overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel info-panel" role="dialog" aria-label={t(`cat.${cat.type}.name`)}>
        <button className="info-x" onClick={onClose} aria-label={t('info.close')}>
          ✕
        </button>
        <div className="info-head">
          <CatPreview type={cat.type} level={cat.level} loadout={loadout} size={96} attackLoop />
          <div className="info-title">
            <div className="info-name">
              {t(`cat.${cat.type}.name`)} <span className="info-lv">{t('info.level', { n: cat.level })}</span>
            </div>
            <div className="muted small">{t(`cat.${cat.type}.title`)}</div>
            <div className="small info-quote">{t(`cat.${cat.type}.personality`)}</div>
          </div>
        </div>
        <div className="info-tags">
          <span className="info-tag">{t(`attack.${def.attack}`)}</span>
          <span className="info-tag mode" style={{ background: mode.color }}>
            {t(`mode.${cat.mode}.short`)} {t(`mode.${cat.mode}`)}
          </span>
        </div>
        <div className="small info-mech">{t(`cat.${cat.type}.attack`)}</div>
        <table className="info-stats">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="info-bonuses">
          <div className="info-sub">{t('info.bonuses')}</div>
          {bonuses.length === 0 ? (
            <div className="muted tiny">{t('info.noBonuses')}</div>
          ) : (
            bonuses.map(([id, lv]) => (
              <div key={id} className="info-bonus">
                <GameIcon name={id} size={20} />
                <b>
                  {t(`skill.${id}.name`)} Lv.{lv}
                </b>
                <span className="muted tiny">{t(`skill.${id}.desc`, skillParams(id, lv))}</span>
              </div>
            ))
          )}
        </div>
        <div className="muted tiny center">{t('info.hint')}</div>
      </div>
    </div>
  );
}
