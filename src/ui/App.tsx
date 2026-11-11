import { useEffect, useState } from 'react';
import type { ChapterGrant } from '../game/collection';
import type { CatId } from '../game/types';
import { recovery, type RecoveryRecord } from '../save/battleRecovery';
import { saveStore, useSave } from '../save/store';
import { RecoveryPrompt } from './components/RecoveryPrompt';
import { EarlyAccessNotice, noticeSeenThisSession } from './components/EarlyAccessNotice';
import { ChapterReward } from './components/ChapterReward';
import { BattleScreen } from './screens/BattleScreen';
import { CatProfileScreen } from './screens/CatProfileScreen';
import { CatsScreen } from './screens/CatsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RecruitScreen } from './screens/RecruitScreen';
import { ShopScreen } from './screens/ShopScreen';
import { StageSelect } from './screens/StageSelect';
import { TeamScreen } from './screens/TeamScreen';
import { PIERCE_LESSON_ID, PRACTICE_STAGE_ID } from '../config/chapters';
import { TUTORIALS, featureOfScreen, isFeatureUnlocked } from '../config/unlocks';
import { CanIcon } from './components/Icons';
import { TourCoach } from './components/TourCoach';
import { t } from '../i18n';

export type Screen =
  | { name: 'home' }
  | { name: 'stages' }
  | { name: 'battle'; stageId: string; run: number; resume?: RecoveryRecord }
  | { name: 'shop' }
  | { name: 'cats' }
  | { name: 'catProfile'; cat: CatId }
  | { name: 'recruit' }
  | { name: 'team'; back: Screen; practice?: boolean }
  /** Tutorial replay: the practice battle (temporary session, nothing is saved). */
  | { name: 'practice'; run: number; back: Screen; lesson?: 'pierce'; onboarding?: boolean };

export function App() {
  const save = useSave();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [grants, setGrants] = useState<ChapterGrant[]>([]);
  const [cansNotice, setCansNotice] = useState(0);
  // Feature gates: a locked screen can never be opened, whatever button or path asks for it.
  const allowed = (s: Screen) => {
    const f = featureOfScreen(s);
    return !f || isFeatureUnlocked(saveStore.get(), f);
  };
  const go = (s: Screen) => setScreen(allowed(s) ? s : { name: 'home' });
  const play = (stageId: string) => setScreen({ name: 'battle', stageId, run: Date.now() });
  // An unfinished battle saved before the page was closed / refreshed / navigated away.
  const [offer, setOffer] = useState<RecoveryRecord | null>(() => recovery.load());
  // Early Access notice: before the main menu, once per browser session.
  const [notice, setNotice] = useState(() => !noticeSeenThisSession());

  // Chapter-completion cats: granted once each — also retroactively for chapters cleared
  // before this feature existed. (Inside a battle, the victory screen presents them itself.)
  useEffect(() => {
    if (screen.name === 'battle' || screen.name === 'practice') return;
    saveStore.claimRecruitIntro(); // 2-5 cleared → the introductory Cat Food Cans, exactly once
    // First-clear can milestones already earned (older saves): paid once, never twice.
    const milestoneCans = saveStore.claimMilestoneCans();
    if (milestoneCans) {
      setCansNotice(milestoneCans);
      window.setTimeout(() => setCansNotice(0), 4000);
    }
    const g = saveStore.claimChapterRewards();
    if (g.length) setGrants((cur) => [...cur, ...g]);
  }, [screen.name]);

  return (
    <div className="app">
      {screen.name === 'home' && <HomeScreen go={go} blocked={notice || !!offer || grants.length > 0} />}
      {screen.name === 'stages' && <StageSelect go={go} play={play} />}
      {screen.name === 'shop' && <ShopScreen go={go} />}
      {screen.name === 'cats' && <CatsScreen go={go} />}
      {screen.name === 'catProfile' && <CatProfileScreen key={screen.cat} cat={screen.cat} go={go} />}
      {screen.name === 'recruit' && <RecruitScreen go={go} />}
      {screen.name === 'team' && <TeamScreen key={screen.practice ? 'practice' : 'team'} go={go} back={screen.back} practice={screen.practice} />}
      {screen.name === 'practice' && (
        <BattleScreen
          key={`practice:${screen.run}`}
          stageId={screen.lesson ? PIERCE_LESSON_ID : PRACTICE_STAGE_ID}
          onLessonEnd={(outcome) => {
            // Only the automatic first run records the outcome; replays never change the save.
            if (screen.onboarding) saveStore.setTutorial(TUTORIALS.pierce, outcome);
            go(screen.back);
          }}
          onExit={() => go(screen.back)}
          onPlay={() => go(screen.back)}
          onHome={() => go(screen.back)}
          onPracticeTeam={isFeatureUnlocked(save, 'team') ? () => go({ name: 'team', back: screen.back, practice: true }) : undefined}
        />
      )}
      {screen.name === 'battle' && (
        // key forces a fully fresh battle screen per stage entry
        <BattleScreen
          key={`${screen.stageId}:${screen.run}`}
          stageId={screen.stageId}
          run={screen.run}
          resume={screen.resume}
          onExit={() => go({ name: 'stages' })}
          onPlay={play}
          onHome={() => go({ name: 'home' })}
        />
      )}
      {cansNotice > 0 && !notice && (
        <div className="toast-inline cans-notice" role="status">
          <CanIcon size={20} /> {t('cans.milestoneNotice', { n: cansNotice })}
        </div>
      )}
      {!notice && <TourCoach screen={screen.name} />}
      {notice && <EarlyAccessNotice onClose={() => setNotice(false)} />}
      {offer && !notice && screen.name !== 'battle' && screen.name !== 'practice' && (
        <RecoveryPrompt
          record={offer}
          onResume={() => {
            setOffer(null);
            setScreen({ name: 'battle', stageId: offer.stageId, run: Date.now(), resume: offer });
          }}
          onDiscard={() => {
            recovery.clear(offer.runId);
            setOffer(null);
          }}
        />
      )}
      {grants.length > 0 && screen.name !== 'battle' && screen.name !== 'practice' && !offer && !notice && (
        <ChapterReward key={grants[0].chapterId} grant={grants[0]} loadout={save.equipped} onClose={() => setGrants((g) => g.slice(1))} />
      )}
    </div>
  );
}
