import { useEffect, useState } from 'react';
import type { ChapterGrant } from '../game/collection';
import type { CatId } from '../game/types';
import { saveStore, useSave } from '../save/store';
import { ChapterReward } from './components/ChapterReward';
import { BattleScreen } from './screens/BattleScreen';
import { CatProfileScreen } from './screens/CatProfileScreen';
import { CatsScreen } from './screens/CatsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RecruitScreen } from './screens/RecruitScreen';
import { ShopScreen } from './screens/ShopScreen';
import { StageSelect } from './screens/StageSelect';
import { TeamScreen } from './screens/TeamScreen';

export type Screen =
  | { name: 'home' }
  | { name: 'stages' }
  | { name: 'battle'; stageId: string; run: number }
  | { name: 'shop' }
  | { name: 'cats' }
  | { name: 'catProfile'; cat: CatId }
  | { name: 'recruit' }
  | { name: 'team'; back: Screen };

export function App() {
  const save = useSave();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [grants, setGrants] = useState<ChapterGrant[]>([]);
  const go = (s: Screen) => setScreen(s);
  const play = (stageId: string) => setScreen({ name: 'battle', stageId, run: Date.now() });

  // Chapter-completion cats: granted once each — also retroactively for chapters cleared
  // before this feature existed. (Inside a battle, the victory screen presents them itself.)
  useEffect(() => {
    if (screen.name === 'battle') return;
    const g = saveStore.claimChapterRewards();
    if (g.length) setGrants((cur) => [...cur, ...g]);
  }, [screen.name]);

  return (
    <div className="app">
      {screen.name === 'home' && <HomeScreen go={go} />}
      {screen.name === 'stages' && <StageSelect go={go} play={play} />}
      {screen.name === 'shop' && <ShopScreen go={go} />}
      {screen.name === 'cats' && <CatsScreen go={go} />}
      {screen.name === 'catProfile' && <CatProfileScreen key={screen.cat} cat={screen.cat} go={go} />}
      {screen.name === 'recruit' && <RecruitScreen go={go} />}
      {screen.name === 'team' && <TeamScreen go={go} back={screen.back} />}
      {screen.name === 'battle' && (
        // key forces a fully fresh battle screen per stage entry
        <BattleScreen
          key={`${screen.stageId}:${screen.run}`}
          stageId={screen.stageId}
          onExit={() => go({ name: 'stages' })}
          onPlay={play}
          onHome={() => go({ name: 'home' })}
        />
      )}
      {grants.length > 0 && screen.name !== 'battle' && (
        <ChapterReward key={grants[0].chapterId} grant={grants[0]} loadout={save.equipped} onClose={() => setGrants((g) => g.slice(1))} />
      )}
    </div>
  );
}
