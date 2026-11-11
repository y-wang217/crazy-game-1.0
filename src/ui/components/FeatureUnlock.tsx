import { useEffect, useState, type ReactNode } from 'react';
import { CANS, FEATURE_UNLOCKS, type FeatureId } from '../../config/unlocks';
import { t, useLang } from '../../i18n';
import { GameIcon, type IconName } from './GameIcon';
import { CanIcon } from './Icons';

const ICON: Record<FeatureId, IconName> = { shop: 'shop', encyclopedia: 'book', team: 'team', recruit: 'recruit' };

/**
 * A menu button that respects the feature gates: while locked it stays visible but dimmed and
 * desaturated, shows a lock + "Clear 1-4", and never navigates (it only explains the lock).
 */
export function FeatureButton({
  feature,
  unlocked,
  label,
  onOpen,
  onLocked,
  className = 'btn btn-secondary',
  iconSize = 22,
}: {
  feature: FeatureId;
  unlocked: boolean;
  label: string;
  onOpen: () => void;
  onLocked: (msg: string) => void;
  className?: string;
  iconSize?: number;
}) {
  useLang();
  if (unlocked)
    return (
      <button className={className} data-feature={feature} onClick={onOpen}>
        <GameIcon name={ICON[feature]} size={iconSize} /> {label}
      </button>
    );
  const req = t('lock.after', { stage: FEATURE_UNLOCKS[feature] });
  return (
    <button
      className={`${className} feature-locked`}
      data-feature={feature}
      data-locked="1"
      aria-disabled="true"
      aria-label={`${label} · ${req}`}
      onClick={() => onLocked(t('lock.toast', { feature: label, stage: FEATURE_UNLOCKS[feature] }))}
    >
      <span className="feature-locked-main">
        <GameIcon name={ICON[feature]} size={iconSize} /> {label}
      </span>
      <span className="feature-lock-req">
        <GameIcon name="lock" size={12} /> {req}
      </span>
    </button>
  );
}

/**
 * Short one-time unlock card on Home (no forced purchase, no chain of popups). The unlocked
 * buttons underneath are spotlit. Buttons are inert for a moment so a tap from the previous
 * screen can't dismiss it by accident.
 */
export function FeatureUnlockCard({
  kind,
  onClose,
  actions,
}: {
  kind: 'shopCats' | 'recruit';
  onClose: () => void;
  actions: { label: string; icon: IconName; onClick: () => void }[];
}) {
  useLang();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = window.setTimeout(() => setReady(true), 700);
    return () => window.clearTimeout(r);
  }, []);
  const rows: { icon: ReactNode; title: string; body: string }[] =
    kind === 'shopCats'
      ? [
          { icon: <GameIcon name="shop" size={28} />, title: t('unlock.shop.title'), body: t('unlock.shop.body') },
          { icon: <GameIcon name="book" size={28} />, title: t('unlock.cats.title'), body: t('unlock.cats.body') },
        ]
      : [
          { icon: <GameIcon name="recruit" size={28} />, title: t('unlock.recruit.title'), body: t('unlock.recruit.body') },
          { icon: <CanIcon size={28} />, title: t('unlock.cans.title'), body: t('unlock.cans.body', { n: CANS.introGift }) },
        ];
  return (
    <div className="shop-intro spot feature-unlock" data-unlock={kind} role="dialog" aria-modal="true" aria-labelledby="unlock-title">
      <div className="panel shop-intro-card feature-unlock-card">
        <div className="intro-kicker gold">{t('unlock.kicker')}</div>
        <h2 id="unlock-title">{t(kind === 'shopCats' ? 'unlock.shopCats.title' : 'unlock.recruitCans.title')}</h2>
        {kind === 'recruit' && (
          <div className="unlock-cans" aria-hidden>
            {Array.from({ length: CANS.introGift }, (_, i) => (
              <span key={i} style={{ animationDelay: `${0.15 + i * 0.2}s` }}>
                <CanIcon size={44} />
              </span>
            ))}
          </div>
        )}
        <ul className="feature-unlock-list">
          {rows.map((r) => (
            <li key={r.title}>
              <span className="feature-unlock-icon">{r.icon}</span>
              <span>
                <b>{r.title}</b>
                <span>{r.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="shop-intro-btns">
          <button className="btn btn-secondary" disabled={!ready} onClick={onClose}>
            {t('unlock.later')}
          </button>
          {actions.map((a) => (
            <button key={a.label} className="btn btn-primary" disabled={!ready} onClick={a.onClick}>
              <GameIcon name={a.icon} size={18} /> {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
