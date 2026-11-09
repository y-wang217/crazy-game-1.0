import { BALANCE } from '../../config/balance';
import { useEffect, useRef, useState } from 'react';
import { ALL_STAGE_IDS, CHAPTERS } from '../../config/chapters';
import { t, useLang } from '../../i18n';
import { useSave } from '../../save/store';
import type { EnemyId, StageDef } from '../../game/types';
import type { Screen } from '../App';
import { CoinIcon } from '../components/Icons';
import { CatHead } from '../components/CatPreview';
import { ChapterCutscene } from '../components/ChapterCutscene';
import { GameIcon } from '../components/GameIcon';
import { Stars } from '../components/Stars';

function enemiesOf(stage?: StageDef): Set<EnemyId> {
  return new Set((stage?.waves ?? []).flatMap((w) => w.groups.flatMap((g) => ('enemy' in g ? [g.enemy] : []))));
}

/** Small tag describing what a stage introduces. */
function newThing(stage: StageDef, prev: StageDef | undefined): string {
  if (stage.isBoss) {
    const ch = CHAPTERS.find((c) => c.stages.includes(stage));
    // A boss that isn't the chapter's last stage is a milestone (e.g. 2-10 of 20).
    return ch && ch.stages[ch.stages.length - 1] !== stage ? t('tag.milestone') : t('tag.boss');
  }
  if (stage.miniBoss) return t('tag.miniBoss');
  const order = stage.order ?? stage.number;
  if (order === 1) return t('tag.basics');
  if (!prev) return t('tag.newMap'); // first stage of a later chapter
  const newCat = prev ? stage.roster.find((c) => !prev.roster.includes(c)) : undefined;
  if (newCat && prev) return t('tag.newCat', { name: t(`cat.${newCat}.name`) });
  // "New" means never seen in ANY earlier stage (not just the previous one).
  const before = new Set(
    CHAPTERS.flatMap((c) => c.stages)
      .filter((s) => (s.order ?? 0) < order)
      .flatMap((s) => [...enemiesOf(s)]),
  );
  const newEnemy = [...enemiesOf(stage)].find((e) => !before.has(e) && e !== 'normal');
  if (newEnemy) return t('tag.newEnemy', { name: t(`enemy.${newEnemy}.name`) });
  if (order === 2) return t('tag.practice');
  if (order === BALANCE.unlocks.skillShopFromStage) return t('tag.skills');
  return '';
}

export function StageSelect({ go, play }: { go: (s: Screen) => void; play: (id: string) => void }) {
  useLang();
  const save = useSave();
  const [story, setStory] = useState(false);
  // Scroll the newest unlocked stage into view (e.g. straight to Chapter 2).
  const latest = [...ALL_STAGE_IDS].reverse().find((id) => save.unlocked.includes(id));
  const latestRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    latestRef.current?.scrollIntoView?.({ block: 'center' });
  }, []);
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
      {/* The team random summons choose from (tutorial stages 1-1…1-6 use their own cats). */}
      <div className="team-strip">
        <div className="team-strip-head">
          <b>{t('stages.team')}</b>
          <button className="btn btn-small" onClick={() => go({ name: 'team', back: { name: 'stages' } })}>
            {t('team.edit')}
          </button>
        </div>
        <div className="team-strip-cats">
          {save.team.map((id) => (
            <span key={id} className="team-strip-cat" title={t(`cat.${id}.name`)}>
              <CatHead type={id} loadout={save.equipped} size={34} />
              <Stars n={save.collection[id]?.stars ?? 1} size={8} />
            </span>
          ))}
        </div>
        <div className="muted tiny">{t('team.tutorialNote')}</div>
      </div>
      {CHAPTERS.map((ch, ci) => {
        const first = ch.stages[0];
        const last = ch.stages[ch.stages.length - 1];
        const open = save.unlocked.includes(first.id);
        const stars = ch.stages.reduce((a, s) => a + (save.cleared[s.id] ?? 0), 0);
        const prevBoss = ci > 0 ? CHAPTERS[ci - 1].stages[CHAPTERS[ci - 1].stages.length - 1] : null;
        return (
          <div key={ch.id} className={`chapter ch-${ch.id} ${open ? '' : 'locked'}`}>
            <div className="chapter-head">
              <div className="chapter-kicker">{t('stages.chapterN', { n: ch.number })}</div>
              <h2>{t(`chapter.${ch.id}`)}</h2>
              <div className="chapter-meta">
                <span>{t('stages.range', { a: first.id, b: last.id })}</span>
                <span className="chapter-stars">
                  <GameIcon name="star" size={14} /> {stars}/{ch.stages.length * 3}
                </span>
              </div>
              {open && ch.id === 'ch2' && (
                <button className="btn btn-small btn-secondary story-btn" onClick={() => setStory(true)}>
                  <GameIcon name="play" size={14} /> {t('story.replay')}
                </button>
              )}
              {!open && prevBoss && (
                <div className="chapter-lock">
                  <GameIcon name="lock" size={14} /> {t('stages.locked', { stage: prevBoss.id })}
                </div>
              )}
            </div>
            <div className="stage-grid">
              {ch.stages.map((s, i) => {
                const unlocked = save.unlocked.includes(s.id);
                const stars = save.cleared[s.id] ?? 0;
                const tag = newThing(s, ch.stages[i - 1]);
                return (
                  <button
                    key={s.id}
                    ref={s.id === latest ? latestRef : undefined}
                    data-stage={s.id}
                    className={`stage-card ${unlocked ? '' : 'locked'} ${s.isBoss ? 'boss' : ''} ${stars ? 'cleared' : ''}`}
                    disabled={!unlocked}
                    onClick={() => play(s.id)}
                  >
                    <span className="stage-num">{unlocked ? s.number : <GameIcon name="lock" size={18} />}</span>
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
        );
      })}
      <p className="muted small center">{t('stages.footer')}</p>
      {story && <ChapterCutscene cats={save.team} loadout={save.equipped} onDone={() => setStory(false)} />}
    </div>
  );
}
