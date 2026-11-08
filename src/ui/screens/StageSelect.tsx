import { BALANCE } from '../../config/balance';
import { CHAPTERS } from '../../config/chapters';
import { t, useLang } from '../../i18n';
import { useSave } from '../../save/store';
import type { EnemyId, StageDef } from '../../game/types';
import type { Screen } from '../App';
import { CoinIcon } from '../components/Icons';

function enemiesOf(stage?: StageDef): Set<EnemyId> {
  return new Set((stage?.waves ?? []).flatMap((w) => w.groups.flatMap((g) => ('enemy' in g ? [g.enemy] : []))));
}

/** Small tag describing what a stage introduces. */
function newThing(stage: StageDef, prev: StageDef | undefined): string {
  if (stage.isBoss) return t('tag.boss');
  const newCat = stage.roster.find((c) => !prev?.roster.includes(c));
  if (newCat && prev) return t('tag.newCat', { name: t(`cat.${newCat}.name`) });
  const before = enemiesOf(prev);
  const newEnemy = [...enemiesOf(stage)].find((e) => !before.has(e) && e !== 'normal');
  if (newEnemy) return t('tag.newEnemy', { name: t(`enemy.${newEnemy}.name`) });
  if (stage.number === 1) return t('tag.basics');
  if (stage.number === 2) return t('tag.practice');
  if (stage.number === BALANCE.unlocks.skillShopFromStage) return t('tag.skills');
  return '';
}

export function StageSelect({ go, play }: { go: (s: Screen) => void; play: (id: string) => void }) {
  useLang();
  const save = useSave();
  return (
    <div className="screen stages">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          {t('common.home')}
        </button>
        <span className="coin-pill">
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      {CHAPTERS.map((ch) => (
        <div key={ch.id} className="chapter">
          <h2>{t('stages.chapter', { n: ch.number, name: t(`chapter.${ch.id}`) })}</h2>
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
                  <span className="stage-name">{t(`stage.${s.id}`)}</span>
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
      <p className="muted small center">{t('stages.footer')}</p>
    </div>
  );
}
