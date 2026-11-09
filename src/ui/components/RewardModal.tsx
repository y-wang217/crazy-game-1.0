import { useEffect, useState } from 'react';
import { CHESTS } from '../../config/enemies';
import { SKILLS, skillParams } from '../../config/skills';
import { t, useLang } from '../../i18n';
import type { RewardOffer } from '../../game/battle';
import type { CatUnit } from '../../game/battle';
import type { CatId, SkillId } from '../../game/types';
import { GameIcon } from './GameIcon';
import { SkillOwner } from './SkillOwner';
import { CoinIcon } from './Icons';
import { useSave } from '../../save/store';

/** Chest-opening animation followed by a 3-choice skill pick. Combat is paused meanwhile. */
export function RewardModal({
  offer,
  owned,
  cats = [],
  onChoose,
}: {
  offer: RewardOffer;
  owned: Partial<Record<SkillId, number>>;
  /** Cats currently on the battlefield (for the "On field" counts). */
  cats?: readonly Pick<CatUnit, 'type' | 'level'>[];
  roster?: CatId[];
  onChoose: (i: number) => void;
}) {
  useLang();
  const save = useSave();
  const [phase, setPhase] = useState<'opening' | 'choose'>('opening');
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    setPhase('opening');
    setPicked(false);
    const timer = window.setTimeout(() => setPhase('choose'), 850);
    return () => window.clearTimeout(timer);
  }, [offer]);

  const chest = CHESTS[offer.tier];
  return (
    <div className="overlay reward-overlay">
      <div className={`chest-anim tier-${offer.tier} ${phase}`}>
        <div className="chest-lid" />
        <div className="chest-box" />
        <div className="chest-rays" />
        <div className="chest-coins">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} style={{ '--i': i } as React.CSSProperties}>
              <CoinIcon size={18} />
            </span>
          ))}
        </div>
      </div>
      <div className="reward-title">
        {t(`chest.${offer.tier}.name`)}! <span className="coin-gain"><CoinIcon size={18} /> +{offer.coins}</span>
      </div>
      {phase === 'choose' && (
        <>
          <div className="muted small light">{chest.levelsPerPick > 1 ? t('reward.choosePlus', { n: chest.levelsPerPick }) : t('reward.choose')}</div>
          <div className="reward-cards">
            {offer.choices.map((c, i) => {
              const def = SKILLS[c.skillId];
              const cur = owned[c.skillId] ?? 0;
              const next = Math.min(def.maxLevel, cur + c.levels);
              return (
                <button
                  key={c.skillId}
                  className={`reward-card ${def.tier}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                  disabled={picked}
                  onClick={() => {
                    if (picked) return;
                    setPicked(true);
                    onChoose(i);
                  }}
                >
                  <span className="reward-icon">
                    <GameIcon name={c.skillId} size={46} />
                    <span className="reward-owner">
                      <SkillOwner id={c.skillId} loadout={save.equipped} size={26} />
                    </span>
                  </span>
                  <span className="reward-name">{t(`skill.${c.skillId}.name`)}</span>
                  <span className={`reward-level ${cur === 0 ? 'new' : ''}`}>
                    {cur === 0 ? t('reward.new') : t('reward.levelUp', { a: cur, b: next })}
                  </span>
                  <span className={`reward-for ${def.cat ? 'cat' : ''}`}>
                    {def.cat ? t('battle.skillFor', { cat: t(`cat.${def.cat}.name`) }) : t('battle.allCats')}
                  </span>
                  <OnField cats={def.cat ? cats.filter((x) => x.type === def.cat) : cats} all={!def.cat} />
                  <span className="reward-desc">{t(`skill.${c.skillId}.desc`, skillParams(c.skillId, next))}</span>
                  {c.levels > 1 && <span className="reward-bonus">{t('reward.bonus', { n: c.levels })}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** "On field: 3 · Lv.1 ×1 / Lv.2 ×2" — from the live battle state. */
export function OnField({ cats, all }: { cats: readonly Pick<CatUnit, 'level'>[]; all: boolean }) {
  const byLevel = new Map<number, number>();
  for (const c of cats) byLevel.set(c.level, (byLevel.get(c.level) ?? 0) + 1);
  const levels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]);
  return (
    <span className={`reward-field ${cats.length ? '' : 'none'}`}>
      <b>{all ? t('reward.allOnField', { n: cats.length }) : t('reward.onField', { n: cats.length })}</b>
      {levels.length > 0 && <span className="reward-levels">{levels.map(([lv, n]) => `Lv.${lv} ×${n}`).join(' / ')}</span>}
    </span>
  );
}
