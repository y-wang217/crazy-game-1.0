import { useState } from 'react';
import { CATS } from '../../config/cats';
import { STARS, starCost } from '../../config/collection';
import { getCatStats } from '../../game/combat';
import type { CatId, CosmeticLoadout } from '../../game/types';
import { t, useLang } from '../../i18n';
import { saveStore, useSave } from '../../save/store';
import { CatPreview } from './CatPreview';
import { GameIcon } from './GameIcon';
import { CoinIcon } from './Icons';
import { Stars } from './Stars';

const pct = (a: number, b: number) => `+${Math.round((b / a - 1) * 1000) / 10}%`;

/**
 * Preview + confirm a permanent star upgrade: current → next star, exact stat changes
 * (Lv.1 values, no skills), new visual effects, Special/Ultimate unlocks and the exact cost.
 * Nothing is spent until "Upgrade" succeeds.
 */
export function StarUpgrade({ cat, loadout, onClose }: { cat: CatId; loadout: CosmeticLoadout; onClose: () => void }) {
  useLang();
  const save = useSave();
  const own = save.collection[cat];
  const [celebrate, setCelebrate] = useState<number | null>(null);
  if (!own) return null;
  const cur = celebrate ? celebrate - 1 : own.stars;
  const next = cur + 1;
  const cost = starCost(cur);
  const def = CATS[cat];
  const a = getCatStats(def, 1, undefined, cur);
  const b = getCatStats(def, 1, undefined, Math.min(STARS.max, next));
  const support = def.attack === 'aura' || def.attack === 'support';

  const rows: [string, string][] = [];
  if (def.damage > 0) rows.push([t('star.stat.damage'), `${a.damage.toFixed(1)} → ${b.damage.toFixed(1)} (${pct(a.damage, b.damage)})`]);
  rows.push([t('star.stat.speed'), `${(1 / a.interval).toFixed(2)}/s → ${(1 / b.interval).toFixed(2)}/s (${pct(1 / a.interval, 1 / b.interval)})`]);
  if (def.poisonDps) rows.push([t('info.poison'), `${a.poisonDps.toFixed(1)}/s → ${b.poisonDps.toFixed(1)}/s`]);
  if (support) {
    const sa = def.attack === 'aura' ? a.slowStrength : a.buffSpeed;
    const sb = def.attack === 'aura' ? b.slowStrength : b.buffSpeed;
    rows.push([t('star.stat.support'), `${Math.round(sa * 100)}% → ${Math.round(sb * 100)}%`]);
  }

  const lackFrag = cost ? Math.max(0, cost.fragments - own.fragments) : 0;
  const lackCoins = cost ? Math.max(0, cost.coins - save.fishCoins) : 0;

  const confirm = () => {
    const r = saveStore.upgradeStar(cat);
    if (r.ok) {
      setCelebrate(r.stars);
      window.setTimeout(() => {
        setCelebrate(null);
        onClose();
      }, 1700);
    }
  };

  return (
    <div className="overlay star-overlay" onPointerDown={(e) => e.target === e.currentTarget && !celebrate && onClose()}>
      <div className="panel star-panel" role="dialog" aria-label={t('star.preview')}>
        <div className="star-hero">
          <CatPreview type={cat} level={1} loadout={loadout} size={90} attackLoop />
          {celebrate && (
            <div className="star-burst" aria-hidden>
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} style={{ ['--a' as string]: `${i * 45}deg`, background: def.palette.body }} />
              ))}
            </div>
          )}
        </div>
        <h3>{celebrate ? t('star.done', { cat: t(`cat.${cat}.name`), n: celebrate }) : t('star.preview')}</h3>
        <div className={`star-line ${celebrate ? 'lit' : ''}`}>
          <Stars n={celebrate ?? cur} size={22} lit={celebrate ? celebrate - 1 : undefined} />
          {!celebrate && (
            <>
              <span className="star-arrow">→</span>
              <Stars n={next} size={22} />
            </>
          )}
        </div>
        {!celebrate && cost && (
          <>
            <table className="info-stats">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="star-unlock">
              <GameIcon name="star" size={16} /> {t(`starfx.${next}`)}
            </div>
            {next === STARS.specialAt && (
              <div className="star-unlock special">
                <GameIcon name="flag" size={16} /> {t('star.unlockSpecial', { name: t(`ability.${cat}.special.name`) })}
              </div>
            )}
            {next === STARS.ultimateAt && (
              <div className="star-unlock ult">
                <GameIcon name="ult" size={16} /> {t('star.unlockUlt', { name: t(`ability.${cat}.ult.name`) })}
              </div>
            )}
            <div className="star-cost">
              <span className={lackFrag ? 'bad' : ''}>
                <GameIcon name="fragment" size={16} /> {own.fragments}/{cost.fragments}
              </span>
              <span className={lackCoins ? 'bad' : ''}>
                <CoinIcon size={16} /> {save.fishCoins}/{cost.coins}
              </span>
            </div>
            {(lackFrag > 0 || lackCoins > 0) && (
              <div className="muted tiny">
                {lackFrag > 0 && t('star.needFrag', { n: lackFrag })} {lackCoins > 0 && t('star.needCoins', { n: lackCoins })}
              </div>
            )}
            <div className="star-actions">
              <button className="btn btn-secondary" onClick={onClose}>
                {t('star.cancel')}
              </button>
              <button className="btn btn-primary" disabled={lackFrag > 0 || lackCoins > 0} onClick={confirm}>
                {t('star.confirm', { c: cost.coins })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
