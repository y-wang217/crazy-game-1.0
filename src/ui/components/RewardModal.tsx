import { useEffect, useState } from 'react';
import { CHESTS } from '../../config/enemies';
import { SKILLS } from '../../config/skills';
import type { RewardOffer } from '../../game/battle';
import type { SkillId } from '../../game/types';
import { CoinIcon } from './Icons';

/** Chest-opening animation followed by a 3-choice skill pick. Combat is paused meanwhile. */
export function RewardModal({
  offer,
  owned,
  onChoose,
}: {
  offer: RewardOffer;
  owned: Partial<Record<SkillId, number>>;
  onChoose: (i: number) => void;
}) {
  const [phase, setPhase] = useState<'opening' | 'choose'>('opening');
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    setPhase('opening');
    setPicked(false);
    const t = window.setTimeout(() => setPhase('choose'), 750);
    return () => window.clearTimeout(t);
  }, [offer]);

  const chest = CHESTS[offer.tier];
  return (
    <div className="overlay reward-overlay">
      <div className={`chest-anim tier-${offer.tier} ${phase}`}>
        <div className="chest-lid" />
        <div className="chest-box" />
        <div className="chest-rays" />
      </div>
      <div className="reward-title">
        {chest.name}! <span className="coin-gain"><CoinIcon size={18} /> +{offer.coins}</span>
      </div>
      {phase === 'choose' && (
        <>
          <div className="muted small light">Choose one skill{chest.levelsPerPick > 1 ? ` (+${chest.levelsPerPick} levels!)` : ''}</div>
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
                  <span className="reward-icon">{def.icon}</span>
                  <span className="reward-name">{def.name}</span>
                  <span className="reward-level">{cur === 0 ? 'NEW!' : `Lv.${cur} → Lv.${next}`}</span>
                  <span className="reward-desc">{def.describe(next)}</span>
                  {c.levels > 1 && <span className="reward-bonus">+{c.levels} Lv</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
