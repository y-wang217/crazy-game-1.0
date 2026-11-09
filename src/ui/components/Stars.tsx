import { STARS } from '../../config/collection';
import { t } from '../../i18n';

/** Permanent star rank (★) — always drawn as stars, never as a number like in-battle Lv. */
export function Stars({ n, size = 14, lit }: { n: number; size?: number; lit?: number }) {
  return (
    <span className="star-rank" aria-label={t('info.star', { n })} style={{ fontSize: size }}>
      {Array.from({ length: STARS.max }, (_, i) => (
        <span key={i} className={i < n ? 'on' : ''} style={lit !== undefined && i === lit ? { animationDelay: '0.1s' } : undefined}>
          ★
        </span>
      ))}
    </span>
  );
}
