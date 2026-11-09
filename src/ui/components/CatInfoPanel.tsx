import { useEffect, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { STARS } from '../../config/collection';
import { CATS, TARGET_MODE_INFO } from '../../config/cats';
import { SKILLS, SKILL_ORDER, skillParams } from '../../config/skills';
import type { Battle, CatUnit } from '../../game/battle';
import { getCatStats, NO_MODS, type CatStats } from '../../game/combat';
import type { CosmeticLoadout, SkillId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { CatPreview } from './CatPreview';
import { GameIcon } from './GameIcon';
import { FishIcon } from './Icons';
import { Stars } from './Stars';
import { fmt, skinBonusText, specialStats } from './statText';
import { feature } from '../../config/features';

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

/** Effective stats (level × star × skills × buffs × debug tuning) plus the no-skill base for comparison. */
export function effectiveStats(cat: CatUnit, b: Battle): { eff: CatStats; base: CatStats } {
  const def = CATS[cat.type];
  const eff = b.unitStats(cat);
  const base = getCatStats(def, cat.level, NO_MODS, b.starOf(cat.type));
  const k = b.tuning.catDamageMult;
  return { eff: { ...eff, damage: eff.damage * k, poisonDps: eff.poisonDps * k }, base: { ...base, damage: base.damage * k } };
}

/**
 * Long-press (or right-click) details for one cat. The battle is paused while
 * it is open; tap anywhere outside or the close button to dismiss.
 * Shows the in-battle level (Lv.) and the permanent star rank (★) separately, the cat's
 * real current stats and what the next merge (Lv.+1) would give.
 */
export function CatInfoPanel({
  cat,
  battle,
  loadout,
  onClose,
  onSell,
  canSell = false,
}: {
  cat: CatUnit;
  battle: Battle;
  loadout: CosmeticLoadout;
  onClose: () => void;
  /** Sell this cat (only offered during an active battle / preparation). */
  onSell?: () => void;
  canSell?: boolean;
}) {
  useLang();
  const [confirming, setConfirming] = useState(false);
  // Desktop: Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const def = CATS[cat.type];
  const { eff } = effectiveStats(cat, battle);
  const maxed = cat.level >= BALANCE.levels.maxLevel;
  const nextEff = maxed ? null : effectiveStats({ ...cat, level: cat.level + 1 }, battle).eff;
  const cell = battle.map.cell;
  const support = def.attack === 'aura' || def.attack === 'support';
  const mode = TARGET_MODE_INFO[cat.mode];
  const bonuses = bonusesFor(cat, battle);
  const star = battle.starOf(cat.type);
  const ult = battle.ultReadiness(cat.type);

  const dps = (s: CatStats) => (s.damage * s.comboHits) / s.interval + s.poisonDps;
  const rows: [string, string, string | null][] = [];
  const dmgText = (s: CatStats) => (s.comboHits > 1 ? t('info.hits', { dmg: fmt(s.damage), n: s.comboHits }) : fmt(s.damage));
  if (!support) rows.push([t('info.damage'), dmgText(eff), nextEff && dmgText(nextEff)]);
  rows.push([
    t('info.attackSpeed'),
    t('info.perSec', { n: fmt(1 / eff.interval, 2) }),
    nextEff && t('info.perSec', { n: fmt(1 / nextEff.interval, 2) }),
  ]);
  rows.push([
    support ? t('info.charm') : t('info.range'),
    t('info.tiles', { n: fmt(eff.range / cell, 2) }),
    nextEff && t('info.tiles', { n: fmt(nextEff.range / cell, 2) }),
  ]);
  if (!support) rows.push([t('info.dps'), fmt(dps(eff)), nextEff && fmt(dps(nextEff))]);
  const cur = specialStats(cat.type, eff, cell);
  const nxt = nextEff ? specialStats(cat.type, nextEff, cell) : [];
  cur.forEach(([k, v], i) => rows.push([k, v, nextEff ? (nxt[i]?.[1] ?? null) : null]));

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
              {t(`cat.${cat.type}.name`)} <span className="info-lv">{t('info.level', { n: cat.level })}</span> <Stars n={star} size={11} />
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
        {battle.skinBonus[cat.type] && (
          <div className="info-skin">
            <GameIcon name="star" size={13} /> {t('skin.bonusLine', { bonus: skinBonusText(battle.skinBonus[cat.type]!) })}
          </div>
        )}
        <table className="info-stats info-compare">
          <thead>
            <tr>
              <th />
              <th>{t('info.level', { n: cat.level })}</th>
              <th>{maxed ? t('info.nextMax') : t('info.next', { n: cat.level + 1 })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, v, n]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
                <td className={n && n !== v ? 'info-up' : 'muted'}>{maxed ? t('star.max') : (n ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="info-abilities">
          <div className={`info-ability ${battle.hasSpecial(cat.type) ? 'on' : ''}`}>
            <GameIcon name="flag" size={16} /> <b>{t('info.special')}:</b> {t(`ability.${cat.type}.special.name`)}{' '}
            <span className="muted tiny">{battle.hasSpecial(cat.type) ? t('ability.unlocked') : t('info.lockedAt', { n: STARS.specialAt })}</span>
          </div>
          <div className={`info-ability ${ult !== undefined ? 'on' : ''}`}>
            <GameIcon name="ult" size={16} /> <b>{t('info.ult')}:</b> {t(`ability.${cat.type}.ult.name`)}{' '}
            <span className="muted tiny">
              {ult === undefined
                ? t('info.lockedAt', { n: STARS.ultimateAt })
                : ult >= 1
                  ? t('info.ultReady')
                  : t('info.ultCharging', { p: Math.round(ult * 100) })}
            </span>
          </div>
        </div>
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
        {onSell && (
          <div className="sell-box">
            {confirming ? (
              <>
                <div className="small b">{t('sell.confirm', { lv: cat.level, cat: t(`cat.${cat.type}.name`), n: battle.sellValue(cat.uid) })}</div>
                <div className="sell-actions">
                  <button className="btn btn-secondary btn-small" onClick={() => setConfirming(false)}>
                    {t('sell.cancel')}
                  </button>
                  <button className="btn btn-danger btn-small" onClick={onSell}>
                    {t('sell.yes')}
                  </button>
                </div>
              </>
            ) : (
              <button
                className="btn btn-secondary sell-btn"
                disabled={!canSell}
                onClick={() => (cat.level >= BALANCE.sell.confirmFromLevel ? setConfirming(true) : onSell())}
              >
                {t('sell.button')} · +{battle.sellValue(cat.uid)} <FishIcon size={16} />
              </button>
            )}
            <div className="muted tiny">{t('sell.note')}</div>
          </div>
        )}
        <div className="muted tiny center">{t(feature('focusTargeting') ? 'info.hint' : 'info.hintBasic')}</div>
      </div>
    </div>
  );
}
