import { CATS } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { useSave } from '../../save/store';
import type { StageDef } from '../../game/types';
import type { Screen } from '../App';
import { CoinIcon } from '../components/Icons';

function newThing(stage: StageDef, prev: StageDef | undefined): string {
  if (stage.isBoss) return 'Boss';
  const newCat = stage.roster.find((c) => !prev?.roster.includes(c));
  if (newCat && prev) return `New: ${CATS[newCat].name}`;
  const enemies = new Set(stage.waves.flatMap((w) => w.groups.map((g) => ('enemy' in g ? g.enemy : ''))));
  const prevEnemies = new Set(prev?.waves.flatMap((w) => w.groups.map((g) => ('enemy' in g ? g.enemy : ''))) ?? []);
  if (enemies.has('fast') && !prevEnemies.has('fast')) return 'New: Zippy Mice';
  if (enemies.has('armored') && !prevEnemies.has('armored')) return 'New: Armor';
  if (enemies.has('shielded') && !prevEnemies.has('shielded')) return 'New: Shields';
  if (stage.number === 2) return 'Merging';
  return '';
}

export function StageSelect({ go, play }: { go: (s: Screen) => void; play: (id: string) => void }) {
  const save = useSave();
  return (
    <div className="screen stages">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          ← Home
        </button>
        <span className="coin-pill">
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      {CHAPTERS.map((ch) => (
        <div key={ch.id} className="chapter">
          <h2>
            Chapter {ch.number} · {ch.name}
          </h2>
          <div className="stage-grid">
            {ch.stages.map((s, i) => {
              const unlocked = save.unlocked.includes(s.id);
              const stars = save.cleared[s.id] ?? 0;
              const tag = newThing(s, ch.stages[i - 1]);
              return (
                <button
                  key={s.id}
                  className={`stage-card ${unlocked ? '' : 'locked'} ${s.isBoss ? 'boss' : ''} ${stars ? 'cleared' : ''}`}
                  disabled={!unlocked}
                  onClick={() => play(s.id)}
                >
                  <span className="stage-num">{unlocked ? s.number : '🔒'}</span>
                  <span className="stage-name">{s.name}</span>
                  <span className="stars">
                    {[1, 2, 3].map((k) => (
                      <span key={k} className={k <= stars ? 'on' : ''}>
                        ★
                      </span>
                    ))}
                  </span>
                  {tag && unlocked && <span className="stage-tag">{tag}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="muted small center">Clear a stage to unlock the next. Stars = base HP kept.</p>
    </div>
  );
}
