import { useEffect, useState } from 'react';
import { CHESTS } from '../../config/enemies';
import { SKILLS, skillParams } from '../../config/skills';
import { t, useLang } from '../../i18n';
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
  useLang();
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
                  <span className="reward-icon">{def.icon}</span>
                  <span className="reward-name">{t(`skill.${c.skillId}.name`)}</span>
                  <span className="reward-level">{cur === 0 ? t('reward.new') : t('reward.levelUp', { a: cur, b: next })}</span>
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
