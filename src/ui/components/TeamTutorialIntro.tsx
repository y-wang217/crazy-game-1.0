import { useEffect, useState } from 'react';
import type { CatId, CosmeticLoadout } from '../../game/types';
import { t, useLang } from '../../i18n';
import { saveStore } from '../../save/store';
import { TEAM_TUTORIAL_ID } from '../../tutorial/teamTutorial';
import { CatPreview } from './CatPreview';
import { GameIcon } from './GameIcon';

/**
 * Edit Team tutorial, step 1 (Home): the new cat says hello and the Edit Team button is
 * spotlighted. There is no "close" — only "Edit team" (continue) or a deliberate, confirmed
 * "Skip tutorial". The lesson is complete only when the team is confirmed with the new cat.
 */
export function TeamTutorialIntro({ cat, loadout, onGo }: { cat: CatId; loadout: CosmeticLoadout; onGo: () => void }) {
  useLang();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = window.setTimeout(() => setReady(true), 700); // no accidental tap-through
    return () => window.clearTimeout(r);
  }, []);
  const name = t(`cat.${cat}.name`);
  return (
    <div className="shop-intro spot team-intro" role="dialog" aria-modal="true" aria-labelledby="team-intro-title">
      <div className="panel shop-intro-card">
        <div className="intro-kicker gold">{t('teamTut.kicker')} · 0/3</div>
        <h2 id="team-intro-title">{t('teamTut.title', { cat: name })}</h2>
        <div className="shop-intro-stage">
          <div className="shop-intro-cat" style={{ width: 84, minWidth: 84 }}>
            <CatPreview type={cat} loadout={loadout} size={84} attackLoop />
          </div>
          <div className="shop-intro-bubble">
            <b>{name}</b> {t('teamTut.line')}
          </div>
        </div>
        <p className="small">{t('teamTut.why')}</p>
        <div className="shop-intro-btns">
          <button
            className="btn btn-secondary"
            disabled={!ready}
            onClick={() => {
              if (window.confirm(t('teamTut.skipConfirm'))) saveStore.markSeen(TEAM_TUTORIAL_ID);
            }}
          >
            {t('teamTut.skip')}
          </button>
          <button className="btn btn-primary" disabled={!ready} onClick={onGo}>
            <GameIcon name="team" size={18} /> {t('team.edit')}
          </button>
        </div>
      </div>
    </div>
  );
}
