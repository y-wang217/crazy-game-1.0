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
import { FeatureButton, FeatureUnlockCard } from '../components/FeatureUnlock';
import { UNLOCK_INTRO, isFeatureUnlocked } from '../../config/unlocks';
import { CanIcon } from '../components/Icons';
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
  // Feature gates (V1.6): decided only by completed stages.
  const unlocked = {
    shop: isFeatureUnlocked(save, 'shop'),
    encyclopedia: isFeatureUnlocked(save, 'encyclopedia'),
    team: isFeatureUnlocked(save, 'team'),
    recruit: isFeatureUnlocked(save, 'recruit'),
  };
  // Edit Team tutorial: starts on its own as soon as Edit Team unlocks (1-10, with Sir Sable), and
  // comes back until the team is confirmed with the new cat or the player taps Skip tutorial.
  const tutCat = unlocked.team ? teamTutorialCat(save) : null;
  const showTeamTut = !blocked && tutCat !== null;
  // One short unlock card at a time. Veterans who already met the Shop (old "tut:shop") skip it.
  const showShopCats =
    !blocked && !showTeamTut && unlocked.shop && !save.seen.includes(UNLOCK_INTRO.shopCats) && !save.seen.includes(SHOP_INTRO_ID);
  const showRecruitIntro = !blocked && !showTeamTut && !showShopCats && unlocked.recruit && !save.seen.includes(UNLOCK_INTRO.recruit);
  const showShopIntro = showShopCats; // keeps the spotlight styling of the Shop/Encyclopedia buttons
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
        <span className="home-wallet">
          <span className="coin-pill" title={t('currency.coins')}>
            <CoinIcon /> {save.fishCoins}
          </span>
          {unlocked.recruit && (
            <span className="coin-pill can-pill" title={t('currency.cans')}>
              <CanIcon /> {save.cans}
            </span>
          )}
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
        <FeatureButton
          feature="team"
          unlocked={unlocked.team}
          label={t('team.edit')}
          className={`btn btn-small home-team-btn ${showTeamTut ? 'spotlit' : ''}`}
          iconSize={16}
          onOpen={editTeam}
          onLocked={flash}
        />
      </div>
      <div className={`home-menu ${showShopIntro || showRecruitIntro ? 'intro-active' : ''}`}>
        <button className="btn btn-big btn-primary" onClick={() => go({ name: 'stages' })}>
          <GameIcon name="play" size={22} /> {t('home.play')}
        </button>
        <div className="row">
          <FeatureButton
            feature="recruit"
            unlocked={unlocked.recruit}
            label={t('home.recruit')}
            className={`btn btn-secondary ${showRecruitIntro ? 'spotlit' : ''}`}
            onOpen={() => go({ name: 'recruit' })}
            onLocked={flash}
          />
          <FeatureButton
            feature="shop"
            unlocked={unlocked.shop}
            label={t('home.shop')}
            className={`btn btn-secondary ${showShopCats ? 'spotlit' : ''}`}
            onOpen={() => go({ name: 'shop' })}
            onLocked={flash}
          />
          <FeatureButton
            feature="encyclopedia"
            unlocked={unlocked.encyclopedia}
            label={t('home.cats')}
            className={`btn btn-secondary ${showShopCats ? 'spotlit' : ''}`}
            onOpen={() => go({ name: 'cats' })}
            onLocked={flash}
          />
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
      {showShopCats && (
        <FeatureUnlockCard
          kind="shopCats"
          onClose={() => saveStore.markSeen(UNLOCK_INTRO.shopCats)}
          actions={[
            {
              label: t('home.shop'),
              icon: 'shop',
              onClick: () => {
                saveStore.markSeen(UNLOCK_INTRO.shopCats);
                go({ name: 'shop' });
              },
            },
            {
              label: t('home.cats'),
              icon: 'book',
              onClick: () => {
                saveStore.markSeen(UNLOCK_INTRO.shopCats);
                go({ name: 'cats' });
              },
            },
          ]}
        />
      )}
      {showRecruitIntro && (
        <FeatureUnlockCard
          kind="recruit"
          onClose={() => saveStore.markSeen(UNLOCK_INTRO.recruit)}
          actions={[
            {
              label: t('unlock.recruit.go'),
              icon: 'recruit',
              onClick: () => {
                saveStore.markSeen(UNLOCK_INTRO.recruit);
                go({ name: 'recruit' });
              },
            },
          ]}
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
            <button
              className={`btn btn-secondary practice-choice ${unlocked.team ? '' : 'feature-locked'}`}
              data-practice="team"
              aria-disabled={!unlocked.team}
              onClick={() => (unlocked.team ? go({ name: 'team', back: { name: 'home' }, practice: true }) : flash(t('lock.toast', { feature: t('team.edit'), stage: '1-10' })))}
            >
              <span>
                <GameIcon name={unlocked.team ? 'team' : 'lock'} size={20} /> {t('practice.team')}
              </span>
              <small>{unlocked.team ? t('practice.teamList') : t('lock.after', { stage: '1-10' })}</small>
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
