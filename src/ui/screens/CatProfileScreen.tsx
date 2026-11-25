import { useState } from 'react';
import { Storybook } from '../components/Storybook';
import { BALANCE } from '../../config/balance';
import { CATS, CAT_ORDER } from '../../config/cats';
import { STARS, ULTIMATE, abilityParams, starCost } from '../../config/collection';
import { RECRUIT } from '../../config/collection';
import { SKILLS, SKILL_ORDER, skillParams } from '../../config/skills';
import { getCatStats } from '../../game/combat';
import type { CatId } from '../../game/types';
import { has as hasKey, t, useLang } from '../../i18n';
import { saveStore, useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { GameIcon, type IconName } from '../components/GameIcon';
import { CoinIcon } from '../components/Icons';
import { SimDemo } from '../components/SimDemo';
import { StarUpgrade } from '../components/StarUpgrade';
import { specialStats } from '../components/statText';
import { Stars } from '../components/Stars';
import { TUTORIALS, isFeatureUnlocked } from '../../config/unlocks';
import { CatScene } from '../components/CatScene';
import { CatClassChips } from '../components/CatClassChips';
import { introStats } from '../../game/introStats';

/** Profile tabs: meet the cat first (Intro); battle data, growth and the full story on demand. */
type ProfileTab = 'intro' | 'battle' | 'growth' | 'story';
const TABS: ProfileTab[] = ['intro', 'battle', 'growth', 'story'];

/** Existing skill icons that picture each cat's signature move (Intro tab). */
const SIGNATURE_ICON: Record<CatId, IconName> = {
  kitten: 'bravePaws',
  tabby: 'quickJabs',
  orange: 'bellySlam',
  black: 'deadeye',
  white: 'dazzlingGrace',
  whiskers: 'stageMagic',
  sable: 'keenEdge',
  mallow: 'biggerBell',
  pounce: 'sharpInstinct',
  devil: 'potentBrew',
};

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString();

/**
 * A character page (V1.6.2, progressive disclosure): the cat first — room, art, name, its line, role
 * and skill tags — then a compact star row, then tabs: Intro (default), Battle (real demo; numbers in
 * expandables), Growth (permanent ★ path vs in-battle Lv. sprites, kept apart) and Story.
 */
export function CatProfileScreen({ cat, go }: { cat: CatId; go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  const own = save.collection[cat];
  /** Star upgrades open with Recruitment (2-5): before that no fragments exist, so the card would only confuse. */
  const starsOpen = isFeatureUnlocked(save, 'recruit');
  const [level, setLevel] = useState(1);
  const [demoStar, setDemoStar] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('intro');
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

      {/* 1. Meet the cat: its room, its look, its name and voice, and what it does in one glance. */}
      <div className="profile-hero">
        {/* Same evolving scene as the collection card, at full size (permanent ★, not the Lv. picker). */}
        <div className={`profile-scene rank-${star}`}>
          <CatScene cat={cat} star={star} />
        </div>
        <div className="profile-art">
          <CatPreview key={`${cat}-${level}`} type={cat} level={level} loadout={save.equipped} size={176} attackLoop />
        </div>
        <h1 className="profile-name">{t(`cat.${cat}.name`)}</h1>
        <p className="profile-line">「{t(`cat.${cat}.line`)}」</p>
        <CatClassChips cat={cat} stars={own.stars} />
      </div>

      {/* Players who already had Sir Sable before his lesson existed: offered here, never forced. */}
      {cat === 'sable' && save.tutorials.pierce === 'legacy' && (
        <div className="offer-banner" data-offer="pierce">
          <span>{t('offer.pierce')}</span>
          <button className="btn btn-small btn-primary" onClick={() => go({ name: 'practice', lesson: 'pierce', onboarding: true, run: Date.now(), back: { name: 'catProfile', cat: 'sable' } })}>
            {t('unlock.startLesson')}
          </button>
          <button className="btn btn-small" onClick={() => saveStore.setTutorial(TUTORIALS.pierce, 'skipped')}>
            {t('offer.noThanks')}
          </button>
        </div>
      )}

      {/* 2. Permanent stars + upgrade — compact, and only once Recruitment (2-5) brings fragments. */}
      {starsOpen && (
        <section className="profile-card star-card star-strip">
          <Stars n={own.stars} size={22} />
          <span className="star-frag">
            <GameIcon name="fragment" size={15} />{' '}
            {maxed ? t('star.fragmentsMax', { n: own.fragments }) : t('star.fragments', { n: own.fragments, need: cost!.fragments })}
          </span>
          {maxed ? (
            own.fragments > 0 && (
              <button className="btn btn-secondary btn-small" onClick={() => saveStore.exchangeFragments(cat)}>
                <CoinIcon size={14} /> {t('star.exchange', { n: own.fragments, c: own.fragments * RECRUIT.maxedFragmentCoins })}
              </button>
            )
          ) : (
            <button className="btn btn-primary btn-small" onClick={() => setUpgrading(true)}>
              <GameIcon name="star" size={16} /> {t('star.upgrade')}
            </button>
          )}
        </section>
      )}

      {/* 3. Details on demand: four tabs. */}
      <div className="profile-tabs" role="tablist">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {t(`profile.tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'intro' && (
        // Who is this cat, and what is it good at? (The full biography lives in the Story tab.)
        <section className="profile-card profile-pane intro-pane" role="tabpanel">
          <p className="profile-intro">{t(`cat.${cat}.intro`)}</p>
          <div className="intro-stats">
            <div className="intro-head">{t('introStat.title')}</div>
            <dl className="intro-stat-list">
              {introStats(cat, star).map((st) => (
                <div key={st.key} className={`intro-stat ${st.signature ? 'signature' : ''}`} data-stat={st.key}>
                  <dt>{t(`introStat.${st.key}.label`)}</dt>
                  <dd>
                    {st.key === 'damage'
                      ? st.params.v === 0
                        ? t('introStat.damage.none')
                        : t(st.params.hits ? 'introStat.damage.combo' : 'introStat.damage.value', st.params)
                      : t(`introStat.${st.key}.value`, st.params)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="muted tiny">{t('introStat.basis', { s: star })}</div>
          </div>
          <div className="intro-signature">
            <GameIcon name={SIGNATURE_ICON[cat]} size={30} />
            <div>
              <div className="intro-head">{t('overview.signature')}</div>
              <div className="small">{t(`cat.${cat}.sigShort`)}</div>
            </div>
          </div>
          <button className="link-btn" onClick={() => setTab('story')}>
            {t('profile.readStory')} ›
          </button>
        </section>
      )}

      {tab === 'battle' && (
        <section className="profile-card profile-pane" role="tabpanel">
          <SimDemo type={cat} level={level} star={shownStar} loadout={save.equipped} />
          <div className="demo-stars" role="group" aria-label={t('profile.starFx')}>
            {Array.from({ length: STARS.max }, (_, i) => i + 1).map((s) => (
              <button key={s} className={`demo-star ${s === shownStar ? 'on' : ''} ${s > own.stars ? 'preview' : ''}`} onClick={() => setDemoStar(s === star ? null : s)}>
                {s}★
              </button>
            ))}
          </div>
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
          <details className="profile-more">
            <summary>
              {t('profile.detailStats')} · Lv.{level} · <Stars n={star} size={11} />
            </summary>
            <div className="level-mini" role="group" aria-label={t('profile.mergeLevels')}>
              {Array.from({ length: BALANCE.levels.maxLevel }, (_, i) => i + 1).map((lv) => (
                <button key={lv} className={lv === level ? 'on' : ''} onClick={() => setLevel(lv)}>
                  Lv.{lv}
                </button>
              ))}
            </div>
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
          </details>
          <details className="profile-more">
            <summary>{t('profile.moreSkills')}</summary>
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
          </details>
        </section>
      )}

      {tab === 'growth' && (
        <>
          {/* Permanent stars (★): a visual path with the 3★ Special and 5★ Ultimate. */}
          <section className="profile-card profile-pane" role="tabpanel">
            <h3>{t('profile.permanentStars')}</h3>
            <div className="muted small">{t('profile.starsCarry')}</div>
            <ol className="star-path">
              {Array.from({ length: STARS.max }, (_, i) => i + 1).map((s) => (
                <li key={s} className={`${s <= own.stars ? 'on' : ''} ${s === STARS.specialAt || s === STARS.ultimateAt ? 'milestone' : ''}`}>
                  <span className="star-path-dot">{s}★</span>
                  {s === STARS.specialAt && <span className="star-path-label">{t('ability.special')}</span>}
                  {s === STARS.ultimateAt && <span className="star-path-label">{t('ability.ultimate')}</span>}
                </li>
              ))}
            </ol>
            {(['special', 'ult'] as const).map((which) => {
              const need = which === 'special' ? STARS.specialAt : STARS.ultimateAt;
              const unlocked = own.stars >= need;
              return (
                <div key={which} className={`ability ${unlocked ? 'on' : 'locked'}`}>
                  <div className="ability-head">
                    <GameIcon name={which === 'ult' ? 'ult' : 'flag'} size={20} />
                    <b>{t(`ability.${cat}.${which}.name`)}</b>
                    <span className={`ability-state ${unlocked ? 'good' : ''}`}>
                      {unlocked ? (
                        t('ability.unlocked')
                      ) : (
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
            {starsOpen ? (
              !maxed && <div className="muted small">{t('star.cost', { f: cost!.fragments, c: cost!.coins })}</div>
            ) : (
              <div className="muted small">{t('profile.starsLater')}</div>
            )}
            <details className="profile-more">
              <summary>{t('profile.starFx')}</summary>
              <ol className="star-fx">
                {Array.from({ length: STARS.max }, (_, i) => i + 1).map((s) => (
                  <li key={s} className={s <= own.stars ? 'on' : ''}>
                    <span className="star-fx-n">{s}★</span> {t(`starfx.${s}`)}
                  </li>
                ))}
              </ol>
              <div className="muted tiny">{t('ability.ultNote', { s: ULTIMATE.cooldown })}</div>
            </details>
          </section>

          {/* In-battle merge levels (Lv.): real sprites, reset after every battle. */}
          <section className="profile-card">
            <h3>{t('profile.mergeLevels')}</h3>
            <div className="level-strip">
              {Array.from({ length: BALANCE.levels.maxLevel }, (_, i) => i + 1).map((lv) => (
                <button key={lv} className={`level-pick ${lv === level ? 'on' : ''}`} onClick={() => setLevel(lv)} aria-label={`Lv.${lv}`}>
                  <CatPreview type={cat} level={lv} loadout={save.equipped} size={50} animate={false} />
                  <span>Lv.{lv}</span>
                </button>
              ))}
            </div>
            <div className="muted small">{t('profile.starsVsLevels')}</div>
            <details className="profile-more">
              <summary>
                {t('profile.showGear')} · Lv.{level}
              </summary>
              <div className="gear-line">{gearText(cat, level, save.equipped.skins[cat])}</div>
            </details>
          </section>
        </>
      )}

      {tab === 'story' && (
        <section className="profile-card profile-pane" role="tabpanel">
          <Storybook key={cat} cat={cat} star={star} loadout={save.equipped} />
        </section>
      )}

      {upgrading && <StarUpgrade cat={cat} loadout={save.equipped} onClose={() => setUpgrading(false)} />}
    </div>
  );
}

/**
 * What the cat wears at this in-battle level. With a skin equipped, the outfit's own evolution is
 * described (the default gear in the slots it covers is not drawn), so the text matches the art.
 */
function gearText(cat: CatId, level: number, skin: string | undefined): string {
  if (skin && hasKey(`skingear.${skin}.${level}`)) return `${t(`cosmetic.${skin}.name`)} · ${t(`skingear.${skin}.${level}`)}`;
  return t(`gear.${cat}.${level}`);
}
