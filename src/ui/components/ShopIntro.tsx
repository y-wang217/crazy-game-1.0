import { useEffect, useState } from 'react';
import { t, useLang } from '../../i18n';
import type { CosmeticLoadout } from '../../game/types';
import { CatPreview } from './CatPreview';
import { GameIcon } from './GameIcon';
import { CoinIcon } from './Icons';

/** The looks the intro shows off, in a loop: default → regular skin → special skin. */
const LOOKS: CosmeticLoadout[] = [
  { hat: null, skins: {} },
  { hat: null, skins: { kitten: 'skin_calico' } },
  { hat: 'hat_bow', skins: { kitten: 'skin_kitten_star' } },
];

/**
 * Skin Shop introduction: a cat's short line, a live preview of a cat changing outfits, and the
 * two skin types. On Home (first time, after 1-3) the Shop button is spotlighted underneath and
 * "Take a look" opens it; from the Shop it's the "About skins" refresher. Never forces a purchase.
 */
export function ShopIntro({ onClose, onGo }: { onClose: () => void; onGo?: () => void }) {
  useLang();
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => (x + 1) % LOOKS.length), 1500);
    const r = window.setTimeout(() => setReady(true), 700); // no accidental tap-through
    return () => {
      window.clearInterval(id);
      window.clearTimeout(r);
    };
  }, []);
  return (
    <div className={`shop-intro ${onGo ? 'spot' : ''}`} role="dialog" aria-modal="true" aria-labelledby="shop-intro-title">
      <div className="panel shop-intro-card">
        <div className="intro-kicker gold">{t('shopIntro.kicker')}</div>
        <h2 id="shop-intro-title">{t('shop.title')}</h2>
        <div className="shop-intro-stage">
          <div className="shop-intro-cat" key={i} style={{ width: onGo ? 84 : 104, minWidth: onGo ? 84 : 104 }}>
            <CatPreview type="kitten" loadout={LOOKS[i]} size={onGo ? 84 : 104} attackLoop={i === 2} />
          </div>
          <div className="shop-intro-bubble">
            <b>{t('cat.kitten.name')}</b> {t('shopIntro.line')}
          </div>
        </div>
        <ul className="shop-intro-list">
          <li>
            <CoinIcon size={15} /> {t('shopIntro.p1')}
          </li>
          <li>
            <span className="skin-kind regular">{t('shop.tabRegular')}</span> {t('skin.regular')}
          </li>
          <li>
            <span className="skin-kind special">{t('shop.tabSpecial')}</span> {t('shopIntro.p3')}
          </li>
        </ul>
        <p className="muted tiny">{t('shopIntro.optional')}</p>
        {onGo ? (
          <div className="shop-intro-btns">
            <button className="btn btn-secondary" disabled={!ready} onClick={onClose}>
              {t('shopIntro.later')}
            </button>
            <button className="btn btn-primary" disabled={!ready} onClick={onGo}>
              <GameIcon name="shop" size={18} /> {t('shopIntro.go')}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" disabled={!ready} onClick={onClose}>
            {t('shopIntro.gotIt')}
          </button>
        )}
      </div>
    </div>
  );
}
