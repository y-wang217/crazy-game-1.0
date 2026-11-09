import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import { CATS, CAT_ORDER } from '../../config/cats';
import { STARS, ULTIMATE, abilityParams, starCost } from '../../config/collection';
import { RECRUIT } from '../../config/collection';
import { SKILLS, SKILL_ORDER, skillParams } from '../../config/skills';
import { getCatStats } from '../../game/combat';
import type { CatId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { saveStore, useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { GameIcon } from '../components/GameIcon';
import { CoinIcon } from '../components/Icons';
import { SimDemo } from '../components/SimDemo';
import { StarUpgrade } from '../components/StarUpgrade';
import { specialStats } from '../components/statText';
import { Stars } from '../components/Stars';

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString();

/**
 * A character page: permanent star rank + fragments + upgrade, Special & Ultimate,
 * star evolution, a live demo (real combat engine), stats per in-battle level, gear, story.
 * Permanent stars (★) and in-battle levels (Lv.) are always shown separately.
 */
export function CatProfileScreen({ cat, go }: { cat: CatId; go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  const own = save.collection[cat];
  const [level, setLevel] = useState(1);
  const [demoStar, setDemoStar] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const def = CATS[cat];
  const star = own?.stars ?? 1;
  const st = getCatStats(def, level, undefined, star);
  const support = def.attack === 'aura' || def.attack === 'support';
  const cell = 50;
  const skills = SKILL_ORDER.filter((id) => SKILLS[id].cat === cat);

  // Comparison bars against every cat at the same level and star rank 1 (no skills).
  const statsOf = (id: CatId) => getCatStats(CATS[id], level, undefined, id === cat ? star : 1);
  const maxAcross = (pick: (id: CatId) => number) => Math.max(...CAT_ORDER.map(pick).filter((v) => v > 0), 1e-6);
  const bars: { label: string; value: string; frac: number }[] = [];
  if (!support) {
    bars.push({
      label: t('info.damage'),
      value: st.comboHits > 1 ? t('info.hits', { dmg: fmt(st.damage), n: st.comboHits }) : fmt(st.damage),
      frac: st.damage / maxAcross((id) => statsOf(id).damage),
    });
  }
  bars.push({
    label: t('info.attackSpeed'),
    value: t('info.perSec', { n: fmt(1 / st.interval, 2) }),
    frac: 1 / st.interval / maxAcross((id) => 1 / statsOf(id).interval),
  });
  bars.push({
    label: support ? t('info.charm') : t('info.range'),
    value: t('info.tiles', { n: fmt(st.range / cell, 2) }),
    frac: st.range / maxAcross((id) => statsOf(id).range),
  });
  if (!support) {
    const dps = (id: CatId) => {
      const s = statsOf(id);
      return (s.damage * s.comboHits) / s.interval + s.poisonDps;
    };
    bars.push({ label: t('info.dps'), value: fmt(dps(cat)), frac: dps(cat) / maxAcross(dps) });
  }
  const extras = specialStats(cat, st, cell);

  const owned = CAT_ORDER.filter((id) => save.collection[id]);
  const idx = owned.indexOf(cat);
  const prev = owned.length > 1 && idx >= 0 ? owned[(idx - 1 + owned.length) % owned.length] : null;
  const next = owned.length > 1 && idx >= 0 ? owned[(idx + 1) % owned.length] : null;

  if (!own) {
    return (
      <div className="screen cats">
        <div className="topbar">
          <button className="btn btn-small" onClick={() => go({ name: 'cats' })}>
            {t('profile.back')}
          </button>
        </div>
        <p className="center muted">{t('guide.lockedHint')}</p>
      </div>
    );
  }

  const cost = starCost(own.stars);
  const maxed = own.stars >= STARS.max;
  const shownStar = demoStar ?? star;

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
        <p className="profile-line">「{t(`cat.${cat}.line`)}」</p>
      </div>

      {/* Permanent progression: star rank + fragments */}
      <section className="profile-card star-card">
        <h3>{t('star.title')}</h3>
        <div className="star-row">
          <Stars n={own.stars} size={26} />
          <span className="star-frag">
            <GameIcon name="fragment" size={16} />{' '}
            {maxed ? t('star.fragmentsMax', { n: own.fragments }) : t('star.fragments', { n: own.fragments, need: cost!.fragments })}
          </span>
        </div>
        {maxed ? (
          <>
            <div className="star-max">{t('star.max')}</div>
            {own.fragments > 0 && (
              <button className="btn btn-secondary btn-small" onClick={() => saveStore.exchangeFragments(cat)}>
                <CoinIcon size={14} /> {t('star.exchange', { n: own.fragments, c: own.fragments * RECRUIT.maxedFragmentCoins })}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="muted small">{t('star.cost', { f: cost!.fragments, c: cost!.coins })}</div>
            <button className="btn btn-primary" onClick={() => setUpgrading(true)}>
              <GameIcon name="star" size={18} /> {t('star.upgrade')}
            </button>
          </>
        )}
        <div className="muted tiny">{t('star.permanentNote')}</div>
      </section>

      {/* Special (3★) and Ultimate (5★) */}
      <section className="profile-card">
        <h3>{t('profile.abilities')}</h3>
        {(['special', 'ult'] as const).map((which) => {
          const need = which === 'special' ? STARS.specialAt : STARS.ultimateAt;
          const unlocked = own.stars >= need;
          return (
            <div key={which} className={`ability ${unlocked ? 'on' : 'locked'}`}>
              <div className="ability-head">
                <GameIcon name={which === 'ult' ? 'ult' : 'flag'} size={20} />
                <b>{t(`ability.${cat}.${which}.name`)}</b>
                <span className="ability-tag">{which === 'special' ? t('ability.special') : t('ability.ultimate')}</span>
                <span className={`ability-state ${unlocked ? 'good' : ''}`}>
                  {unlocked ? t('ability.unlocked') : (
                    <>
                      <GameIcon name="lock" size={12} /> {t('ability.locked', { n: need })}
                    </>
                  )}
                </span>
              </div>
              <div className="small">{t(`ability.${cat}.${which}.desc`, abilityParams(cat, which))}</div>
            </div>
          );
        })}
        <div className="muted tiny">{t('ability.ultNote', { s: ULTIMATE.cooldown })}</div>
      </section>

      {/* Live demo with star preview */}
      <section className="profile-card">
        <h3>{t('profile.signature')}</h3>
        <SimDemo type={cat} level={level} star={shownStar} loadout={save.equipped} />
        <div className="demo-stars" role="group" aria-label={t('profile.starFx')}>
          {Array.from({ length: STARS.max }, (_, i) => i + 1).map((s) => (
            <button key={s} className={`demo-star ${s === shownStar ? 'on' : ''} ${s > own.stars ? 'preview' : ''}`} onClick={() => setDemoStar(s === star ? null : s)}>
              {s}★
            </button>
          ))}
        </div>
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

      {/* ★1–★5 attack-effect evolution */}
      <section className="profile-card">
        <h3>{t('profile.starFx')}</h3>
        <ol className="star-fx">
          {Array.from({ length: STARS.max }, (_, i) => i + 1).map((s) => (
            <li key={s} className={s <= own.stars ? 'on' : ''}>
              <span className="star-fx-n">{s}★</span> {t(`starfx.${s}`)}
            </li>
          ))}
        </ol>
      </section>

      {/* In-battle level evolution (Lv.1–5, merging): gear + stats */}
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
        <h3>
          {t('profile.stats', { n: level })} · <Stars n={star} size={12} />
        </h3>
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
        <h3>{t('profile.story')}</h3>
        <p className="small story">{t(`cat.${cat}.story`)}</p>
      </section>

      <section className="profile-card">
        <h3>{t('profile.skills')}</h3>
        {skills.map((id) => (
          <div key={id} className="info-bonus">
            <GameIcon name={id} size={20} />
            <b>
              {t(`skill.${id}.name`)} <span className="muted tiny">{t('profile.maxLv', { n: SKILLS[id].maxLevel })}</span>
            </b>
            <span className="muted tiny">{t(`skill.${id}.desc`, skillParams(id, 1))}</span>
          </div>
        ))}
        <div className="muted tiny">{t('profile.skillsNote')}</div>
      </section>

      {upgrading && <StarUpgrade cat={cat} loadout={save.equipped} onClose={() => setUpgrading(false)} />}
    </div>
  );
}
