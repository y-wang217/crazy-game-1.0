import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import { CATS, CAT_ORDER } from '../../config/cats';
import { SKILLS, SKILL_ORDER, skillParams } from '../../config/skills';
import { getCatStats } from '../../game/combat';
import type { CatId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { useSave } from '../../save/store';
import type { Screen } from '../App';
import { AttackDemo } from '../components/AttackDemo';
import { CatPreview } from '../components/CatPreview';

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString();

/** Largest value of a stat across all cats at a level — used to scale comparison bars. */
function maxAcross(level: number, pick: (id: CatId) => number): number {
  return Math.max(...CAT_ORDER.map(pick).filter((v) => v > 0), 1e-6);
  void level;
}

/** A dedicated character page: story, stats per level, gear evolution, signature attack, skills. */
export function CatProfileScreen({ cat, go }: { cat: CatId; go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  const [level, setLevel] = useState(1);
  const def = CATS[cat];
  const st = getCatStats(def, level);
  const aura = def.attack === 'aura';
  const cell = 50;
  const met = save.seen.includes(`cat:${cat}`);
  const skills = SKILL_ORDER.filter((id) => SKILLS[id].cat === cat);

  // Comparison bars against the other cats at the same level (no skills).
  const statsOf = (id: CatId) => getCatStats(CATS[id], level);
  const bars: { label: string; value: string; frac: number }[] = [];
  if (!aura) {
    bars.push({
      label: t('info.damage'),
      value: st.comboHits > 1 ? t('info.hits', { dmg: fmt(st.damage), n: st.comboHits }) : fmt(st.damage),
      frac: st.damage / maxAcross(level, (id) => statsOf(id).damage),
    });
  }
  bars.push({
    label: t('info.attackSpeed'),
    value: t('info.perSec', { n: fmt((st.comboHits > 1 ? 1 : 1) / st.interval, 2) }),
    frac: 1 / st.interval / maxAcross(level, (id) => 1 / statsOf(id).interval),
  });
  bars.push({
    label: aura ? t('info.charm') : t('info.range'),
    value: t('info.tiles', { n: fmt(st.range / cell, 2) }),
    frac: st.range / maxAcross(level, (id) => statsOf(id).range),
  });
  if (!aura) {
    const dps = (id: CatId) => {
      const s = statsOf(id);
      return (s.damage * s.comboHits) / s.interval;
    };
    bars.push({ label: t('info.dps'), value: fmt(dps(cat)), frac: dps(cat) / maxAcross(level, dps) });
  }

  const extras: [string, string][] = [];
  if (def.attack === 'combo') extras.push([t('profile.combo'), t('profile.comboVal', { n: st.comboHits, g: fmt(def.comboGap ?? 0.08, 2) })]);
  if (def.attack === 'slam') {
    extras.push([t('info.splash'), t('info.splashVal', { r: fmt(st.splashRadius / cell, 2), p: Math.round(st.splashRatio * 100) })]);
    extras.push([t('profile.windup'), t('profile.secs', { s: fmt(def.windup ?? 0, 2) })]);
  }
  if (def.attack === 'snipe') extras.push([t('profile.aim'), t('profile.secs', { s: fmt(def.windup ?? 0, 2) })]);
  if (aura) {
    extras.push([t('info.slow'), t('info.slowVal', { p: Math.round(st.slowStrength * 100), s: fmt(st.slowDuration) })]);
    extras.push([t('info.focus'), t('info.focusVal', { p: Math.round(st.focusBonus * 100) })]);
  }

  const idx = CAT_ORDER.indexOf(cat);
  const metList = CAT_ORDER.filter((id) => save.seen.includes(`cat:${id}`));
  const neighbour = (dir: 1 | -1): CatId | null => {
    for (let k = 1; k < CAT_ORDER.length; k++) {
      const c = CAT_ORDER[(idx + dir * k + CAT_ORDER.length) % CAT_ORDER.length];
      if (metList.includes(c)) return c === cat ? null : c;
    }
    return null;
  };
  const prev = neighbour(-1);
  const next = neighbour(1);

  if (!met) {
    return (
      <div className="screen cats">
        <div className="topbar">
          <button className="btn btn-small" onClick={() => go({ name: 'cats' })}>
            {t('profile.back')}
          </button>
        </div>
        <p className="center muted">{t('guide.unknownHint')}</p>
      </div>
    );
  }

  return (
    <div className="screen profile" style={{ ['--cat-accent' as string]: def.palette.body }}>
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'cats' })}>
          {t('profile.back')}
        </button>
        <div className="profile-nav">
          {prev && (
            <button className="btn btn-small" onClick={() => go({ name: 'catProfile', cat: prev })} aria-label={t(`cat.${prev}.name`)}>
              ‹
            </button>
          )}
          {next && (
            <button className="btn btn-small" onClick={() => go({ name: 'catProfile', cat: next })} aria-label={t(`cat.${next}.name`)}>
              ›
            </button>
          )}
        </div>
      </div>

      <div className="profile-hero">
        <div className="profile-art">
          <CatPreview key={`${cat}-${level}`} type={cat} level={level} loadout={save.equipped} size={176} attackLoop />
        </div>
        <h1 className="profile-name">{t(`cat.${cat}.name`)}</h1>
        <div className="profile-title">{t(`cat.${cat}.title`)}</div>
        <div className="info-tags center-tags">
          <span className="info-tag">{t(`cat.${cat}.role`)}</span>
          <span className="info-tag">{t(`attack.${def.attack}`)}</span>
        </div>
        <p className="profile-quote">“{t(`cat.${cat}.personality`)}”</p>
      </div>

      {/* Level evolution: each level adds visible gear; the role never changes. */}
      <section className="profile-card">
        <h3>{t('profile.levels')}</h3>
        <div className="level-strip">
          {Array.from({ length: BALANCE.levels.maxLevel }, (_, i) => i + 1).map((lv) => (
            <button key={lv} className={`level-pick ${lv === level ? 'on' : ''}`} onClick={() => setLevel(lv)} aria-label={`Lv.${lv}`}>
              <CatPreview type={cat} level={lv} loadout={save.equipped} size={50} animate={false} />
              <span>Lv.{lv}</span>
            </button>
          ))}
        </div>
        <div className="gear-line">
          <b>{t('profile.gear')}:</b> {t(`gear.${cat}.${level}`)}
        </div>
      </section>

      <section className="profile-card">
        <h3>{t('profile.stats', { n: level })}</h3>
        <div className="stat-compare">
          {bars.map((b) => (
            <div key={b.label} className="stat-compare-row">
              <span className="stat-compare-label">{b.label}</span>
              <div className="stat-track">
                <div className="stat-fill" style={{ width: `${Math.max(6, Math.round(b.frac * 100))}%` }} />
              </div>
              <span className="stat-compare-val">{b.value}</span>
            </div>
          ))}
        </div>
        {extras.length > 0 && (
          <table className="info-stats">
            <tbody>
              {extras.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="muted tiny">{t('profile.statsNote')}</div>
      </section>

      <section className="profile-card">
        <h3>{t('profile.signature')}</h3>
        <AttackDemo type={cat} level={level} loadout={save.equipped} />
        <p className="small">{t(`cat.${cat}.attack`)}</p>
        <p className="small">{t(`cat.${cat}.signature`)}</p>
        <div className="sw-grid">
          <div>
            <div className="good small b">{t('intro.strengths')}</div>
            <div className="small">{t(`cat.${cat}.strengths`)}</div>
          </div>
          <div>
            <div className="bad small b">{t('intro.weaknesses')}</div>
            <div className="small">{t(`cat.${cat}.weaknesses`)}</div>
          </div>
        </div>
      </section>

      <section className="profile-card">
        <h3>{t('profile.story')}</h3>
        <p className="small story">{t(`cat.${cat}.story`)}</p>
      </section>

      <section className="profile-card">
        <h3>{t('profile.skills')}</h3>
        {skills.map((id) => (
          <div key={id} className="info-bonus">
            <span>{SKILLS[id].icon}</span>
            <b>
              {t(`skill.${id}.name`)} <span className="muted tiny">{t('profile.maxLv', { n: SKILLS[id].maxLevel })}</span>
            </b>
            <span className="muted tiny">{t(`skill.${id}.desc`, skillParams(id, 1))}</span>
          </div>
        ))}
        <div className="muted tiny">{t('profile.skillsNote')}</div>
      </section>
    </div>
  );
}
