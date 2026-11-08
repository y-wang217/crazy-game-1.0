import { CATS, CAT_ORDER, TARGET_MODES, TARGET_MODE_INFO } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import type { CatId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';

/** First stage where a cat can appear (for "Meet in Stage N"). */
export function firstStageOf(cat: CatId): number {
  for (const ch of CHAPTERS) for (const s of ch.stages) if (s.roster.includes(cat)) return s.number;
  return 1;
}

/** Cat Collection overview: one card per cat; discovered cats open their profile page. */
export function CatsScreen({ go }: { go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  const found = CAT_ORDER.filter((id) => save.seen.includes(`cat:${id}`)).length;

  return (
    <div className="screen cats">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          {t('common.home')}
        </button>
        <span className="coin-pill collection-count">
          🐾 {t('guide.discovered', { n: found, total: CAT_ORDER.length })}
        </span>
      </div>
      <h2 className="center">{t('guide.collection')}</h2>
      <div className="collection-grid">
        {CAT_ORDER.map((id) => {
          const met = save.seen.includes(`cat:${id}`);
          const accent = CATS[id].palette.body;
          return (
            <button
              key={id}
              className={`collection-card ${met ? 'met' : 'unknown'}`}
              style={{ ['--cat-accent' as string]: accent }}
              disabled={!met}
              onClick={() => met && go({ name: 'catProfile', cat: id })}
              aria-label={met ? t(`cat.${id}.name`) : t('guide.undiscovered')}
            >
              <div className="collection-portrait">
                <CatPreview type={id} level={met ? 3 : 1} loadout={save.equipped} size={92} animate={met} />
              </div>
              <div className="collection-name">{met ? t(`cat.${id}.name`) : t('guide.unknown')}</div>
              <div className="collection-role">{met ? t(`cat.${id}.role`) : t('guide.discoverAt', { n: firstStageOf(id) })}</div>
              <div className={`collection-state ${met ? 'met' : ''}`}>{met ? t('guide.tapToView') : `🔒 ${t('guide.undiscovered')}`}</div>
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
          <li>{t('info.hint')}</li>
        </ul>
      </div>
    </div>
  );
}
