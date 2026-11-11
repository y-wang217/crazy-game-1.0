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
import { TUTORIALS, isFeatureUnlocked } from '../../config/unlocks';
import { tourStore, useTour } from '../../tutorial/tours';
import { SableStory } from '../components/SableStory';
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
  // Unlock tutorials, one at a time, each started automatically and ended only by finishing it or
  // by a visible Skip Tutorial (save.tutorials: done / skipped; 'legacy' = passed before V1.6, so
  // an advanced player is never interrupted — those live in the replay menu / first-visit offers).
  const [replayStory, setReplayStory] = useState(false);
  const tut = save.tutorials;
  const touring = useTour() !== null;
  const free = !blocked && !touring && !replayStory;
  const sableOwned = !!save.collection.sable;
  const teamDecided = !!tut.team || save.seen.includes(TEAM_TUTORIAL_ID);
  const showShopCats = free && unlocked.shop && !tut.shopCats;
  const showSableStory = free && !showShopCats && unlocked.team && sableOwned && !tut.sableStory;
  // Edit Team tutorial (after Sir Sable's story): put him in the team.
  const tutCat = unlocked.team && !tut.team ? teamTutorialCat(save) : null;
  const showTeamTut = free && !showShopCats && !showSableStory && tutCat !== null;
  // Then his piercing lesson.
  const showPierce = free && !showShopCats && !showSableStory && !showTeamTut && unlocked.team && sableOwned && teamDecided && !tut.pierce;
  const showRecruitIntro = free && !showShopCats && !showSableStory && !showTeamTut && !showPierce && unlocked.recruit && !tut.recruit;
  const showShopIntro = showShopCats; // keeps the spotlight styling of the Shop/Encyclopedia buttons
  // Players who already put a new cat in their team on their own don't need the lesson.
  useEffect(() => {
    if (!save.seen.includes(TEAM_TUTORIAL_ID) && save.team.some((id) => !STARTER_CATS.includes(id))) saveStore.markSeen(TEAM_TUTORIAL_ID);
    if (!save.tutorials.team && save.seen.includes(TEAM_TUTORIAL_ID)) saveStore.setTutorial(TUTORIALS.team, 'done');
  }, [save.seen, save.team, save.tutorials.team]);
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
      {replayStory && (
        // Replay: Sir Sable's story, then his piercing lesson (nothing is saved).
        <SableStory
          loadout={save.equipped}
          onDone={() => {
            setReplayStory(false);
            go({ name: 'practice', lesson: 'pierce', run: Date.now(), back: { name: 'home' } });
          }}
          onSkip={() => setReplayStory(false)}
          replay
        />
      )}
      {showShopCats && (
        <FeatureUnlockCard kind="shopCats" onStart={() => tourStore.start('shopCats', 'onboarding')} onSkip={() => saveStore.setTutorial(TUTORIALS.shopCats, 'skipped')} />
      )}
      {showSableStory && (
        <SableStory
          loadout={save.equipped}
          onDone={() => saveStore.setTutorial(TUTORIALS.sableStory, 'done')}
          onSkip={() => saveStore.setTutorial(TUTORIALS.sableStory, 'skipped')}
        />
      )}
      {showPierce && (
        <FeatureUnlockCard
          kind="pierce"
          onStart={() => go({ name: 'practice', lesson: 'pierce', onboarding: true, run: Date.now(), back: { name: 'home' } })}
          onSkip={() => saveStore.setTutorial(TUTORIALS.pierce, 'skipped')}
        />
      )}
      {showRecruitIntro && (
        <FeatureUnlockCard kind="recruit" onStart={() => tourStore.start('recruit', 'onboarding')} onSkip={() => saveStore.setTutorial(TUTORIALS.recruit, 'skipped')} />
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
            {(
              [
                { id: 'shopCats', ok: unlocked.shop, stage: '1-4', icon: 'shop', start: () => tourStore.start('shopCats', 'replay') },
                { id: 'sable', ok: unlocked.team && sableOwned, stage: '1-10', icon: 'damage', start: () => setReplayStory(true) },
                { id: 'recruit', ok: unlocked.recruit, stage: '2-5', icon: 'recruit', start: () => tourStore.start('recruit', 'replay') },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                className={`btn btn-secondary practice-choice ${r.ok ? '' : 'feature-locked'}`}
                data-practice={r.id}
                aria-disabled={!r.ok}
                onClick={() => {
                  if (!r.ok) return flash(t('lock.toast', { feature: t(`practice.${r.id}`), stage: r.stage }));
                  setPracticeMenu(false);
                  r.start();
                }}
              >
                <span>
                  <GameIcon name={r.ok ? r.icon : 'lock'} size={20} /> {t(`practice.${r.id}`)}
                </span>
                <small>{r.ok ? t(`practice.${r.id}List`) : t('lock.after', { stage: r.stage })}</small>
              </button>
            ))}
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
