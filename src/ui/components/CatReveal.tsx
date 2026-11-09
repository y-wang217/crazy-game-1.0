import { useEffect, useState, type ReactNode } from 'react';
import { CATS } from '../../config/cats';
import type { CatId, CosmeticLoadout } from '../../game/types';
import { t, useLang } from '../../i18n';
import { CatPreview } from './CatPreview';
import { GameIcon, type IconName } from './GameIcon';

/**
 * First-time cat reveal: (1) a short entrance — spotlight, the cat drops in with a
 * sparkle burst, its name and signature line — then (2) the biography / stats card.
 * Used for the first summon in battle (the battle stays paused), recruitment and
 * chapter rewards. The entrance auto-advances after ~2.4 s or on tap.
 */
export function CatReveal({
  cat,
  loadout,
  kicker,
  extra,
  closeLabel,
  onClose,
}: {
  cat: CatId;
  loadout: CosmeticLoadout;
  kicker?: string;
  extra?: ReactNode;
  closeLabel?: string;
  onClose: () => void;
}) {
  useLang();
  const [phase, setPhase] = useState<'entrance' | 'card'>('entrance');
  useEffect(() => {
    setPhase('entrance');
    const id = window.setTimeout(() => setPhase('card'), 2400);
    return () => window.clearTimeout(id);
  }, [cat]);

  if (phase === 'entrance') {
    return (
      <div className="cat-entrance" onClick={() => setPhase('card')} role="button" aria-label={t('intro.tapSkip')}>
        <div className="entrance-spot" />
        <div className="entrance-burst" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} style={{ ['--a' as string]: `${i * 36}deg` }} />
          ))}
        </div>
        <div className="entrance-cat">
          <CatPreview type={cat} level={1} loadout={loadout} size={170} attackLoop />
        </div>
        <div className="entrance-kicker">{kicker ?? t('intro.arrives', { cat: t(`cat.${cat}.name`) })}</div>
        <div className="entrance-name">{t(`cat.${cat}.name`)}</div>
        <div className="entrance-line">「{t(`cat.${cat}.line`)}」</div>
        <div className="entrance-skip">{t('intro.tapSkip')}</div>
      </div>
    );
  }
  return (
    <div className="tut-card-wrap">
      <div className="tut-card reveal-card" key={cat}>
        <CatIntroCard cat={cat} loadout={loadout} />
        {extra}
        <button className="btn btn-primary tut-continue" onClick={onClose}>
          {closeLabel ?? t('tut.gotIt')}
        </button>
      </div>
    </div>
  );
}

/** Biography + role + mechanics + strengths/weaknesses + relative stat bars. */
export function CatIntroCard({ cat, loadout }: { cat: CatId; loadout: CosmeticLoadout }) {
  return (
    <div className="intro">
      <div className="intro-kicker">{t('intro.newCat')}</div>
      <div className="intro-art">
        <CatPreview type={cat} level={1} loadout={loadout} size={120} attackLoop />
      </div>
      <h2 className="intro-name">{t(`cat.${cat}.name`)}</h2>
      <div className="intro-sub">{t(`cat.${cat}.title`)}</div>
      <p className="intro-quote">“{t(`cat.${cat}.personality`)}”</p>
      <dl className="intro-facts">
        <dt>{t('intro.role')}</dt>
        <dd>{t(`cat.${cat}.role`)}</dd>
        <dt>{t('intro.attack')}</dt>
        <dd>{t(`cat.${cat}.attack`)}</dd>
        <dt className="good">{t('intro.strengths')}</dt>
        <dd>{t(`cat.${cat}.strengths`)}</dd>
        <dt className="bad">{t('intro.weaknesses')}</dt>
        <dd>{t(`cat.${cat}.weaknesses`)}</dd>
      </dl>
      <StatBars cat={cat} />
    </div>
  );
}

/** Simple relative stat bars so cats are easy to compare at a glance. */
export function StatBars({ cat }: { cat: CatId }) {
  const d = CATS[cat];
  const hits = d.comboHits ?? 1;
  const support = d.attack === 'aura' || d.attack === 'support';
  const rows: [IconName, number][] = [
    [support ? 'charm' : 'damage', support ? 0.8 : Math.min(1, ((d.damage + (d.poisonDps ?? 0) * d.interval) * hits) / 46)],
    ['speed', Math.min(1, 0.75 / d.interval)],
    ['range', Math.min(1, d.range / 150)],
  ];
  return (
    <div className="stat-bars">
      {rows.map(([icon, v]) => (
        <div key={icon} className="stat-row">
          <GameIcon name={icon} size={16} />
          <div className="stat-track">
            <div className="stat-fill" style={{ width: `${Math.round(v * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
