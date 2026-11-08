import { CAT_ORDER, TARGET_MODES, TARGET_MODE_INFO } from '../../config/cats';
import { t, useLang } from '../../i18n';
import { useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';

export function CatsScreen({ go }: { go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  return (
    <div className="screen cats">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          {t('common.home')}
        </button>
        <span />
      </div>
      <h2 className="center">{t('guide.title')}</h2>
      <div className="cat-list">
        {CAT_ORDER.map((id) => {
          const met = save.seen.includes(`cat:${id}`);
          return (
            <div key={id} className={`cat-row ${met ? '' : 'unknown'}`}>
              <div className="cat-levels">
                <CatPreview type={id} level={1} loadout={save.equipped} size={56} />
                <CatPreview type={id} level={3} loadout={save.equipped} size={56} />
                <CatPreview type={id} level={5} loadout={save.equipped} size={56} />
              </div>
              <div>
                <div className="cat-name">
                  {t(`cat.${id}.name`)} <span className="muted small">— {t(`cat.${id}.title`)}</span>
                </div>
                {met ? (
                  <>
                    <div className="small">{t(`cat.${id}.personality`)}</div>
                    <div className="small role">
                      <b>{t(`cat.${id}.role`)}:</b> {t(`cat.${id}.attack`)}
                    </div>
                    <div className="small">
                      <span className="good">＋</span> {t(`cat.${id}.strengths`)}
                    </div>
                    <div className="small">
                      <span className="bad">－</span> {t(`cat.${id}.weaknesses`)}
                    </div>
                  </>
                ) : (
                  <div className="small muted">{t('guide.unknownHint')}</div>
                )}
              </div>
            </div>
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
