import { useState } from 'react';
import { BattleScreen } from './screens/BattleScreen';
import { CatProfileScreen } from './screens/CatProfileScreen';
import { CatsScreen } from './screens/CatsScreen';
import type { CatId } from '../game/types';
import { HomeScreen } from './screens/HomeScreen';
import { ShopScreen } from './screens/ShopScreen';
import { StageSelect } from './screens/StageSelect';

export type Screen =
  | { name: 'home' }
  | { name: 'stages' }
  | { name: 'battle'; stageId: string; run: number }
  | { name: 'shop' }
  | { name: 'cats' }
  | { name: 'catProfile'; cat: CatId };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const go = (s: Screen) => setScreen(s);
  const play = (stageId: string) => setScreen({ name: 'battle', stageId, run: Date.now() });

  return (
    <div className="app">
      {screen.name === 'home' && <HomeScreen go={go} />}
      {screen.name === 'stages' && <StageSelect go={go} play={play} />}
      {screen.name === 'shop' && <ShopScreen go={go} />}
      {screen.name === 'cats' && <CatsScreen go={go} />}
      {screen.name === 'catProfile' && <CatProfileScreen key={screen.cat} cat={screen.cat} go={go} />}
      {screen.name === 'battle' && (
        // key forces a fully fresh battle screen per stage entry
        <BattleScreen
          key={`${screen.stageId}:${screen.run}`}
          stageId={screen.stageId}
          onExit={() => go({ name: 'stages' })}
          onPlay={play}
        />
      )}
    </div>
  );
}
