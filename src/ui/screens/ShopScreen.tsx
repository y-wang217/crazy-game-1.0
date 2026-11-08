import { useState } from 'react';
import { COSMETICS } from '../../config/cosmetics';
import { t, useLang } from '../../i18n';
import { saveStore, useSave } from '../../save/store';
import type { CosmeticDef, CosmeticLoadout } from '../../game/types';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { CoinIcon } from '../components/Icons';

export function ShopScreen({ go }: { go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  const [tab, setTab] = useState<'hat' | 'skin'>('hat');
  const [msg, setMsg] = useState<string | null>(null);
  const items = COSMETICS.filter((c) => c.slot === tab);

  const preview = (item: CosmeticDef): { loadout: CosmeticLoadout; cat: NonNullable<CosmeticDef['cat']> } => {
    if (item.slot === 'hat') return { loadout: { hat: item.id, skins: save.equipped.skins }, cat: 'kitten' };
    return { loadout: { hat: save.equipped.hat, skins: { [item.cat!]: item.id } }, cat: item.cat! };
  };

  const isEquipped = (item: CosmeticDef) =>
    item.slot === 'hat' ? save.equipped.hat === item.id : save.equipped.skins[item.cat!] === item.id;

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 1500);
  };

  return (
    <div className="screen shop">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          {t('common.home')}
        </button>
        <span className="coin-pill" title={t('currency.coins')}>
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      <h2 className="center">{t('shop.title')}</h2>
      <p className="muted small center">{t('shop.subtitle')}</p>
      <div className="tabs">
        <button className={tab === 'hat' ? 'active' : ''} onClick={() => setTab('hat')}>
          {t('shop.tabHats')}
        </button>
        <button className={tab === 'skin' ? 'active' : ''} onClick={() => setTab('skin')}>
          {t('shop.tabSkins')}
        </button>
      </div>
      <div className="shop-grid">
        {items.map((item) => {
          const owned = save.owned.includes(item.id);
          const equipped = isEquipped(item);
          const p = preview(item);
          return (
            <div key={item.id} className={`shop-card ${equipped ? 'equipped' : ''}`}>
              <CatPreview type={p.cat} loadout={p.loadout} size={68} />
              <div className="shop-name">{t(`cosmetic.${item.id}.name`)}</div>
              <div className="muted tiny">{item.cat ? t(`cat.${item.cat}.name`) : t('shop.allCats')}</div>
              <div className="muted tiny">{t(`cosmetic.${item.id}.desc`)}</div>
              {owned ? (
                <button className={`btn btn-small ${equipped ? 'btn-secondary' : 'btn-primary'}`} onClick={() => saveStore.toggleEquip(item.id)}>
                  {equipped ? t('shop.equipped') : t('shop.equip')}
                </button>
              ) : (
                <button
                  className={`btn btn-small btn-buy ${save.fishCoins < item.price ? 'disabled' : ''}`}
                  onClick={() => {
                    const r = saveStore.buyCosmetic(item.id);
                    if (!r.ok) flash(t('shop.noCoins'));
                    else {
                      saveStore.toggleEquip(item.id);
                      flash(t('shop.bought', { name: t(`cosmetic.${item.id}.name`) }));
                    }
                  }}
                >
                  <CoinIcon size={14} /> {item.price}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {msg && <div className="toast-inline">{msg}</div>}
    </div>
  );
}
