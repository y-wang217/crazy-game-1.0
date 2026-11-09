import { CATS, CAT_ORDER, TARGET_MODES, TARGET_MODE_INFO } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import type { CatId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { CHAPTER_REWARDS } from '../../config/collection';
import { GameIcon } from '../components/GameIcon';
import { Stars } from '../components/Stars';
import { feature } from '../../config/features';

/** First stage where a cat can appear (for "Meet in Stage N"). */
export function firstStageOf(cat: CatId): number {
  for (const ch of CHAPTERS) for (const s of ch.stages) if (s.roster.includes(cat)) return s.number;
  return 1;
}

/** Cat Collection overview: one card per cat; discovered cats open their profile page. */
export function CatsScreen({ go }: { go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  const found = CAT_ORDER.filter((id) => save.collection[id]).length;

  return (
    <div className="screen cats">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          {t('common.home')}
        </button>
        <span className="coin-pill collection-count">
          <GameIcon name="team" size={16} /> {t('guide.owned', { n: found, total: CAT_ORDER.length })}
        </span>
      </div>
      <h2 className="center">{t('guide.collection')}</h2>
      <div className="row collection-actions">
        <button className="btn btn-secondary btn-small" onClick={() => go({ name: 'team', back: { name: 'cats' } })}>
          <GameIcon name="team" size={16} /> {t('team.edit')}
        </button>
        <button className="btn btn-secondary btn-small" onClick={() => go({ name: 'recruit' })}>
          <GameIcon name="recruit" size={16} /> {t('home.recruit')}
        </button>
      </div>
      <div className="collection-grid">
        {CAT_ORDER.map((id) => {
          const own = save.collection[id];
          const accent = CATS[id].palette.body;
          const reward = Object.entries(CHAPTER_REWARDS).find(([, r]) => r.cat === id);
          const hint = reward ? t('guide.locked.chapter', { n: CHAPTERS.find((c) => c.id === reward[0])?.number ?? 1 }) + ' · ' + t('guide.locked.recruit') : t('guide.locked.recruit');
          return (
            <button
              key={id}
              className={`collection-card ${own ? 'met' : 'unknown'}`}
              style={{ ['--cat-accent' as string]: accent }}
              disabled={!own}
              onClick={() => own && go({ name: 'catProfile', cat: id })}
              aria-label={own ? t(`cat.${id}.name`) : t('guide.unknown')}
            >
              <div className="collection-portrait">
                <CatPreview type={id} level={own ? 3 : 1} loadout={save.equipped} size={92} animate={!!own} />
              </div>
              <div className="collection-name">{own ? t(`cat.${id}.name`) : t('guide.unknown')}</div>
              {own ? <Stars n={own.stars} size={12} /> : null}
              <div className="collection-role">{own ? t(`cat.${id}.role`) : hint}</div>
              <div className={`collection-state ${own ? 'met' : ''}`}>
                {own ? (
                  save.team.includes(id) ? (
                    t('team.inTeam')
                  ) : (
                    t('guide.tapToView')
                  )
                ) : (
                  <>
                    <GameIcon name="lock" size={13} /> {t('guide.lockedHint')}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="help-card">
        <h3>{t('guide.howTo')}</h3>
        <ul className="small">
          <li>{t('guide.summon')}</li>
          <li>{t('guide.move')}</li>
          <li>{t('guide.swap')}</li>
          <li>{t('guide.merge')}</li>
          <li>
            {t('guide.target')}{' '}
            {TARGET_MODES.map((m) => (
              <span key={m} className="mode-chip" style={{ background: TARGET_MODE_INFO[m].color }}>
                {t(`mode.${m}.short`)} {t(`mode.${m}`)}
              </span>
            ))}
          </li>
          <li>{t('guide.chest')}</li>
          <li>{t(feature('focusTargeting') ? 'info.hint' : 'info.hintBasic')}</li>
        </ul>
      </div>
    </div>
  );
}
