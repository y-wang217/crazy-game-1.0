import { useEffect, useRef, useState } from 'react';
import { LANGS, chapterNumeral, setLang, t, useLang } from '../../i18n';
import { chapterProgress, currentChapter } from '../../game/progression';
import { THEMES, setTheme, useTheme } from '../../theme';
import { saveStore, useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { BrandEmblem, HomeScenery } from '../components/Brand';
import { GameIcon } from '../components/GameIcon';
import { CoinIcon } from '../components/Icons';
import { debugStore, useDebug } from '../debugStore';
import { ShopIntro } from '../components/ShopIntro';
import { SKIN_RULES } from '../../config/cosmetics';
import { STARTER_CATS } from '../../config/cats';
import { TEAM_TUTORIAL_ID, teamTutorialCat } from '../../tutorial/teamTutorial';
import { TeamTutorialIntro } from '../components/TeamTutorialIntro';

/** Seen-id of the one-time Skin Shop introduction (Home → Replay tutorials shows it again). */
export const SHOP_INTRO_ID = 'tut:shop';

import { APP_VERSION } from '../../config/version';
export { APP_VERSION };

export function HomeScreen({
  go,
  blocked = false,
}: {
  go: (s: Screen) => void;
  /** Another popup is open (resume prompt, rewards). */ blocked?: boolean;
}) {
  const lang = useLang();
  const theme = useTheme();
  const save = useSave();
  const debug = useDebug();
  // Progress is counted per chapter (only that chapter's own stages), never as one combined total.
  const chapters = chapterProgress(save);
  const current = currentChapter(chapters);
  const finished = chapters.filter((c) => c.complete && c.id !== current.id);
  const [note, setNote] = useState<string | null>(null);
  const [practiceMenu, setPracticeMenu] = useState(false);
  const taps = useRef<number[]>([]);
  // Skin Shop intro: once, after the first clear of Stage 1-3 (also for players already past it).
  const showShopIntro = !blocked && SKIN_RULES.shopIntroAfterStage in save.cleared && !save.seen.includes(SHOP_INTRO_ID);
  // Edit Team tutorial: the first time a new cat joins (after its reveal), until the team is confirmed with it.
  const tutCat = teamTutorialCat(save);
  const showTeamTut = !blocked && !showShopIntro && tutCat !== null;
  // Players who already put a new cat in their team on their own don't need the lesson.
  useEffect(() => {
    if (!save.seen.includes(TEAM_TUTORIAL_ID) && save.team.some((id) => !STARTER_CATS.includes(id))) saveStore.markSeen(TEAM_TUTORIAL_ID);
  }, [save.seen, save.team]);
  const editTeam = () => go({ name: 'team', back: { name: 'home' } });

  const flash = (m: string) => {
    setNote(m);
    window.setTimeout(() => setNote(null), 2200);
  };

  // Hidden developer toggle: tap the version label 5 times quickly.
  const onVersionTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((x) => now - x < 2000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      debugStore.setEnabled(!debugStore.get().enabled);
      flash(debugStore.get().enabled ? 'Debug tools ON' : 'Debug tools OFF');
    }
  };

  return (
    <div className="screen home">
      <HomeScenery />
      <div className="topbar">
        <div className="home-settings">
          <div className="lang-switch" role="group" aria-label={t('home.language')}>
            {LANGS.map((l) => (
              <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          {/* Visual theme only: never touches progress, stats or combat. */}
          <div className="theme-switch" role="group" aria-label={t('theme.label')}>
            {THEMES.map((th) => (
              <button key={th.id} className={theme === th.id ? 'on' : ''} onClick={() => setTheme(th.id)}>
                <GameIcon name={th.id === 'moonlit' ? 'moon' : 'sun'} size={14} /> {t(`theme.${th.id}`)}
              </button>
            ))}
          </div>
        </div>
        <span className="coin-pill" title={t('currency.coins')}>
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      <div className={`home-hero ${showTeamTut ? 'team-tut-active' : ''}`}>
        <BrandEmblem />
        <h1 className={`logo ${lang === 'zh-HK' ? 'zh' : ''}`}>
          <span>{t('logo.1')}</span>
          <span>{t('logo.2')}</span>
        </h1>
        <p className="tagline">{t('home.tagline')}</p>
        <div className="home-cats">
          {save.team.map((c) => (
            <CatPreview key={c} type={c} loadout={save.equipped} size={60} />
          ))}
        </div>
        <button className={`btn btn-small home-team-btn ${showTeamTut ? 'spotlit' : ''}`} onClick={editTeam}>
          <GameIcon name="team" size={16} /> {t('team.edit')}
        </button>
      </div>
      <div className={`home-menu ${showShopIntro ? 'intro-active' : ''}`}>
        <button className="btn btn-big btn-primary" onClick={() => go({ name: 'stages' })}>
          <GameIcon name="play" size={22} /> {t('home.play')}
        </button>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => go({ name: 'recruit' })}>
            <GameIcon name="recruit" size={22} /> {t('home.recruit')}
          </button>
          <button
            className={`btn btn-secondary ${showShopIntro ? 'spotlit' : ''}`}
            onClick={() => {
              if (showShopIntro) saveStore.markSeen(SHOP_INTRO_ID);
              go({ name: 'shop' });
            }}
          >
            <GameIcon name="shop" size={22} /> {t('home.shop')}
          </button>
          <button className="btn btn-secondary" onClick={() => go({ name: 'cats' })}>
            <GameIcon name="book" size={22} /> {t('home.cats')}
          </button>
        </div>
        <div className="home-progress">
          {finished.map((c) => (
            <span key={c.id} className="chapter-done" data-chapter={c.id}>
              {t('home.chapterDone', { n: chapterNumeral(c.number), done: c.cleared, total: c.total })}
            </span>
          ))}
          <p className={`muted small ${current.complete ? 'chapter-done' : ''}`} data-chapter={current.id}>
            {t(current.complete ? 'home.chapterDone' : 'home.progress', { n: chapterNumeral(current.number), done: current.cleared, total: current.total })}
          </p>
        </div>
        {/* Tutorial replay: a safe practice session (nothing is reset or saved). */}
        <button className="btn btn-secondary home-replay-btn" onClick={() => setPracticeMenu(true)}>
          <GameIcon name="tap" size={20} /> {t('practice.replay')}
        </button>
        <div className="home-links">
          <button
            className="link-btn"
            onClick={() => {
              if (window.confirm(t('home.resetConfirm'))) saveStore.reset();
            }}
          >
            {t('home.reset')}
          </button>
        </div>
        <button className="version" onClick={onVersionTap}>
          v{APP_VERSION}
          {debug.enabled ? ' · debug' : ''}
        </button>
      </div>
      {showShopIntro && (
        <ShopIntro
          onClose={() => saveStore.markSeen(SHOP_INTRO_ID)}
          onGo={() => {
            saveStore.markSeen(SHOP_INTRO_ID);
            go({ name: 'shop' });
          }}
        />
      )}
      {showTeamTut && tutCat && <TeamTutorialIntro cat={tutCat} loadout={save.equipped} onGo={editTeam} />}
      {practiceMenu && (
        <div className="shop-intro practice-menu" role="dialog" aria-modal="true" aria-labelledby="practice-title">
          <div className="panel shop-intro-card">
            <h2 id="practice-title">{t('practice.replay')}</h2>
            <p className="muted small">{t('practice.intro')}</p>
            <button className="btn btn-primary practice-choice" data-practice="battle" onClick={() => go({ name: 'practice', run: Date.now(), back: { name: 'home' } })}>
              <span>
                <GameIcon name="play" size={20} /> {t('practice.battle')}
              </span>
              <small>{t('practice.battleList')}</small>
            </button>
            <button className="btn btn-secondary practice-choice" data-practice="team" onClick={() => go({ name: 'team', back: { name: 'home' }, practice: true })}>
              <span>
                <GameIcon name="team" size={20} /> {t('practice.team')}
              </span>
              <small>{t('practice.teamList')}</small>
            </button>
            <button className="btn btn-small" onClick={() => setPracticeMenu(false)}>
              {t('common.close')}
            </button>
            {/* The old behaviour (first-time tips again in real stages) stays available, clearly separate. */}
            <button
              className="link-btn tiny"
              onClick={() => {
                if (!window.confirm(t('practice.resetTipsConfirm'))) return;
                saveStore.resetTutorials();
                setPracticeMenu(false);
                flash(t('home.replayDone'));
              }}
            >
              {t('practice.resetTips')}
            </button>
          </div>
        </div>
      )}
      {note && <div className="toast-inline">{note}</div>}
    </div>
  );
}
