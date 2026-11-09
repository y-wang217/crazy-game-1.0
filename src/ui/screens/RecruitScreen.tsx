import { useState } from 'react';
import { CAT_ORDER } from '../../config/cats';
import { RECRUIT, STARS, starCost } from '../../config/collection';
import { recruitOdds, type RecruitResult } from '../../game/collection';
import { t, useLang } from '../../i18n';
import { saveStore, useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { CatReveal } from '../components/CatReveal';
import { GameIcon } from '../components/GameIcon';
import { CoinIcon } from '../components/Icons';
import { Stars } from '../components/Stars';

/** Recruit cats with fish coins: transparent equal odds + a new-cat guarantee. */
export function RecruitScreen({ go }: { go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  const [last, setLast] = useState<Extract<RecruitResult, { ok: true }> | null>(null);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const odds = recruitOdds({ ...save });
  const unowned = CAT_ORDER.filter((id) => !save.collection[id]).length;
  const canAfford = save.fishCoins >= RECRUIT.cost;

  const draw = () => {
    setError(null);
    const r = saveStore.recruit();
    if (!r.ok) {
      setError(t('recruit.noCoins'));
      return;
    }
    setLast(r);
    if (r.isNew) {
      setReveal(true);
      // The reveal plays the first-time introduction, so battle won't repeat it.
      saveStore.markSeen(`cat:${r.cat}`);
    }
  };

  return (
    <div className="screen recruit">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          {t('common.home')}
        </button>
        <span className="coin-pill">
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      <h2 className="center">
        <GameIcon name="recruit" size={26} /> {t('recruit.title')}
      </h2>
      <p className="muted small center">{t('recruit.note')}</p>

      <div className="recruit-box">
        {last && !reveal ? (
          <div className="recruit-result" key={save.recruitDraws}>
            <CatPreview type={last.cat} level={1} loadout={save.equipped} size={110} attackLoop />
            <b>{t(`cat.${last.cat}.name`)}</b>
            {last.isNew ? (
              <span className="recruit-new">{t('recruit.new')}</span>
            ) : last.coins ? (
              <span>
                <CoinIcon size={16} /> {t('recruit.dupMax', { cat: t(`cat.${last.cat}.name`), n: last.coins })}
              </span>
            ) : (
              <span>
                <GameIcon name="fragment" size={16} /> {t('recruit.dup', { cat: t(`cat.${last.cat}.name`), n: last.fragments, t: last.totalFragments })}
              </span>
            )}
          </div>
        ) : (
          <div className="recruit-idle">
            <GameIcon name="recruit" size={72} />
          </div>
        )}
        <button className="btn btn-primary btn-big recruit-btn" disabled={!canAfford} onClick={draw}>
          {last ? t('recruit.again') : t('recruit.draw')} · <CoinIcon size={18} /> {RECRUIT.cost}
        </button>
        {error && <div className="bad small">{error}</div>}
        <div className="recruit-odds small">
          {t('recruit.odds', { p: Math.round(odds.perCat * 100), q: Math.round(odds.newChance * 100) })}
        </div>
        <div className="recruit-guarantee small">
          {unowned === 0
            ? t('recruit.allOwned')
            : odds.guaranteedNext
              ? t('recruit.guaranteeNext')
              : t('recruit.guarantee', { n: odds.drawsToGuarantee })}
        </div>
      </div>

      <h3 className="center">{t('recruit.pool')}</h3>
      <div className="recruit-pool">
        {CAT_ORDER.map((id) => {
          const own = save.collection[id];
          const cost = own ? starCost(own.stars) : null;
          return (
            <div key={id} className={`pool-card ${own ? 'owned' : 'missing'}`}>
              <div className="pool-art">
                <CatPreview type={id} level={1} loadout={save.equipped} size={54} animate={false} />
              </div>
              <div className="pool-name">{own ? t(`cat.${id}.name`) : t('guide.unknown')}</div>
              {own ? (
                <>
                  <Stars n={own.stars} size={11} />
                  <div className="tiny muted">
                    {own.stars >= STARS.max ? t('star.fragmentsMax', { n: own.fragments }) : t('star.fragments', { n: own.fragments, need: cost?.fragments ?? 0 })}
                  </div>
                </>
              ) : (
                <div className="tiny muted">{t('recruit.notOwned')}</div>
              )}
              <div className="tiny muted">{Math.round(odds.perCat * 100)}%</div>
            </div>
          );
        })}
      </div>

      {reveal && last && (
        <div className="overlay reveal-overlay">
          <CatReveal cat={last.cat} loadout={save.equipped} kicker={t('recruit.new')} closeLabel={t('recruit.close')} onClose={() => setReveal(false)} />
        </div>
      )}
    </div>
  );
}
