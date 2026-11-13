import { useEffect, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { rewardSummary } from '../../game/progression';
import type { CatId, CosmeticLoadout } from '../../game/types';
import { t } from '../../i18n';
import { CatPreview } from './CatPreview';
import { GameIcon } from './GameIcon';
import { CanIcon, CoinIcon } from './Icons';

export interface BattleResult {
  victory: boolean;
  stars: number;
  coins: number;
  chestCoins: number;
  firstClear: boolean;
  chapterComplete: boolean;
  chapterId: string;
  chapterNumber: number;
  baseHp: number;
  maxHp: number;
  /** Cat Food Cans earned this battle (milestone, Living Cat Food Can, Gold Chest bonus). */
  cans?: number;
  /** Fish coins from defeating an already-rewarded Living Cat Food Can. */
  bonusCoins?: number;
}

/** Victory / defeat panel: staggered stars with the reason for each, this battle's rewards, navigation. */
export function ResultPanel({
  result,
  roster,
  loadout,
  totalCoins,
  hasNext,
  onNext,
  onReplay,
  onHome,
  onStages,
  extra,
  tutorialWaiting = false,
}: {
  result: BattleResult;
  roster: CatId[];
  loadout: CosmeticLoadout;
  totalCoins: number;
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onHome: () => void;
  onStages: () => void;
  extra?: React.ReactNode;
  /** A new unlock tutorial is waiting: the way on is Home (the next stage is gated). */
  tutorialWaiting?: boolean;
}) {
  const summary = rewardSummary(result);
  // Count the battle total up for a small "ka-ching".
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!summary.total) return;
    let n = 0;
    const step = Math.max(1, Math.ceil(summary.total / 20));
    const id = window.setInterval(() => {
      n = Math.min(summary.total, n + step);
      setShown(n);
      if (n >= summary.total) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [summary.total]);

  const pct = (f: number) => ({ pct: Math.round(f * 100) });
  const starReasons = [t('result.star1'), t('result.star2', pct(BALANCE.stars.two)), t('result.star3', pct(BALANCE.stars.three))];

  return (
    <div className={`overlay result ${result.victory ? 'win' : 'lose'}`}>
      {result.victory && <Confetti />}
      <div className="panel result-panel">
        {result.victory ? (
          <>
            <div className="victory-cats">
              {roster.map((c, i) => (
                <div key={c} className="dance" style={{ animationDelay: `${i * 0.12}s` }}>
                  <CatPreview type={c} level={Math.min(5, 1 + i)} loadout={loadout} size={50} />
                </div>
              ))}
            </div>
            <h2 className="result-title">
              {result.chapterComplete ? (
                <>
                  <GameIcon name="trophy" size={28} /> {t('result.chapter', { n: result.chapterNumber })}
                </>
              ) : result.baseHp <= 3 ? (
                t('result.close')
              ) : (
                t('result.victory')
              )}
            </h2>
            {result.chapterComplete && <p className="small">{t(`result.chapterText.${result.chapterId}`)}</p>}
            <div className="big-stars" aria-label={`${result.stars}/3`}>
              {[1, 2, 3].map((k) => (
                <span key={k} className={`big-star ${k <= result.stars ? 'on' : ''}`} style={{ animationDelay: `${0.25 + k * 0.35}s` }}>
                  <GameIcon name="star" size={46} />
                </span>
              ))}
            </div>
            <ul className="star-reasons">
              {starReasons.map((r, i) => (
                <li key={r} className={i < result.stars ? 'got' : ''}>
                  <span>{i < result.stars ? '✓' : '·'}</span> {r}
                </li>
              ))}
              <li className="hearts-kept">
                <GameIcon name="heart" size={14} /> {t('result.heartsKept', { n: result.baseHp, max: result.maxHp })}
              </li>
            </ul>
          </>
        ) : (
          <>
            <h2 className="result-title">{t('result.defeat')}</h2>
            <p className="small">{t('result.defeatTip')}</p>
          </>
        )}

        {summary.lines.length > 0 && (
          <div className="result-rewards">
            <div className="reward-head">{t('result.earned')}</div>
            {summary.lines.map((l) => (
              <div key={l.key} className="reward-row">
                <span>{t(`result.line.${l.key}`)}</span>
                <span className="reward-amt">
                  <CoinIcon size={16} /> +{l.amount}
                </span>
              </div>
            ))}
            <div className="reward-row total">
              <span>{t('result.battleTotal')}</span>
              <span className="reward-amt">
                <CoinIcon size={18} /> +{shown || summary.total}
              </span>
            </div>
          </div>
        )}
        {(result.cans ?? 0) > 0 && (
          <div className="result-rewards result-cans">
            <div className="reward-row">
              <span>{t('result.cans')}</span>
              <span className="reward-amt">
                <CanIcon size={18} /> +{result.cans}
              </span>
            </div>
          </div>
        )}
        <div className="balance-line">
          {t('result.balance')} <CoinIcon size={16} /> <b>{totalCoins}</b>
        </div>
        {extra}

        {result.victory && tutorialWaiting ? (
          <>
            <p className="gate-hint">{t('gate.resultHint')}</p>
            <button className="btn btn-primary gate-home" onClick={onHome}>
              <GameIcon name="home" size={18} /> {t('gate.resultHome')}
            </button>
            <button className="btn btn-secondary" onClick={onReplay}>
              <GameIcon name="replay" size={18} /> {t('result.replay')}
            </button>
          </>
        ) : result.victory ? (
          <>
            {hasNext && (
              <button className="btn btn-primary" onClick={onNext}>
                {t('result.next')} <GameIcon name="next" size={18} />
              </button>
            )}
            <button className={`btn ${hasNext ? 'btn-secondary' : 'btn-primary'}`} onClick={onReplay}>
              <GameIcon name="replay" size={18} /> {t('result.replay')}
            </button>
            <button className="btn btn-secondary" onClick={onHome}>
              <GameIcon name="home" size={18} /> {t('result.home')}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={onReplay}>
              <GameIcon name="replay" size={18} /> {t('result.retry')}
            </button>
            <button className="btn btn-secondary" onClick={onStages}>
              <GameIcon name="list" size={18} /> {t('result.stages')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  const colors = ['var(--accent)', '#ffd84a', 'var(--accent2)', '#6ac0f0', '#7cd07a'];
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 12) * 0.09}s`,
            animationDuration: `${1.8 + (i % 5) * 0.25}s`,
            animationIterationCount: 2,
          }}
        />
      ))}
    </div>
  );
}
