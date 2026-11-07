import { useState } from 'react';
import { CATS } from '../../config/cats';
import { COSMETICS } from '../../config/cosmetics';
import { saveStore, useSave } from '../../save/store';
import type { CosmeticDef, CosmeticLoadout } from '../../game/types';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { CoinIcon } from '../components/Icons';

export function ShopScreen({ go }: { go: (s: Screen) => void }) {
  const save = useSave();
  const [tab, setTab] = useState<'hat' | 'skin'>('hat');
  const [msg, setMsg] = useState<string | null>(null);
  const items = COSMETICS.filter((c) => c.slot === tab);

  const preview = (item: CosmeticDef): { loadout: CosmeticLoadout; cat: CosmeticDef['cat'] } => {
    if (item.slot === 'hat') return { loadout: { hat: item.id, skins: save.equipped.skins }, cat: 'kitten' };
    return { loadout: { hat: save.equipped.hat, skins: { [item.cat!]: item.id } }, cat: item.cat };
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
          ← Home
        </button>
        <span className="coin-pill">
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      <h2 className="center">Cosmetic Shop</h2>
      <p className="muted small center">Purely for looks — no combat bonuses. Earn fish coins from stages & chests.</p>
      <div className="tabs">
        <button className={tab === 'hat' ? 'active' : ''} onClick={() => setTab('hat')}>
          Hats (all cats)
        </button>
        <button className={tab === 'skin' ? 'active' : ''} onClick={() => setTab('skin')}>
          Fur skins
        </button>
      </div>
      <div className="shop-grid">
        {items.map((item) => {
          const owned = save.owned.includes(item.id);
          const equipped = isEquipped(item);
          const p = preview(item);
          return (
            <div key={item.id} className={`shop-card ${equipped ? 'equipped' : ''}`}>
              <CatPreview type={p.cat!} loadout={p.loadout} size={68} />
              <div className="shop-name">{item.name}</div>
              <div className="muted tiny">{item.cat ? CATS[item.cat].name : 'Worn by every cat'}</div>
              <div className="muted tiny">{item.description}</div>
              {owned ? (
                <button className={`btn btn-small ${equipped ? 'btn-secondary' : 'btn-primary'}`} onClick={() => saveStore.toggleEquip(item.id)}>
                  {equipped ? '✓ Equipped' : 'Equip'}
                </button>
              ) : (
                <button
                  className={`btn btn-small btn-buy ${save.fishCoins < item.price ? 'disabled' : ''}`}
                  onClick={() => {
                    const r = saveStore.buyCosmetic(item.id);
                    if (!r.ok) flash(r.reason ?? 'Cannot buy');
                    else {
                      saveStore.toggleEquip(item.id);
                      flash(`${item.name} purchased!`);
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
