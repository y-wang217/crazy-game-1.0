import { useState } from 'react';
import { CAT_ORDER } from '../../config/cats';
import { COSMETICS, skinKind } from '../../config/cosmetics';
import { t, useLang } from '../../i18n';
import { saveStore, useSave } from '../../save/store';
import type { CatId, CosmeticDef, CosmeticLoadout } from '../../game/types';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { GameIcon } from '../components/GameIcon';
import { CoinIcon } from '../components/Icons';
import { ShopIntro } from '../components/ShopIntro';
import { skinBonusText } from '../components/statText';

type Tab = 'hat' | 'regular' | 'special';
type Status = 'equipped' | 'owned' | 'locked' | 'buy';

/**
 * Skin Shop. Hats (every cat) and regular skins (普通造型) change looks only; special skins
 * (特殊造型) also give that cat one small, exact bonus. Every item can be previewed first.
 */
export function ShopScreen({ go }: { go: (s: Screen) => void }) {
  useLang();
  const save = useSave();
  const [tab, setTab] = useState<Tab>('special');
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<CosmeticDef | null>(null);
  const [intro, setIntro] = useState(false);

  const order = (c: CosmeticDef) => (c.cat ? CAT_ORDER.indexOf(c.cat) : -1);
  const items = COSMETICS.filter((c) => (tab === 'hat' ? c.slot === 'hat' : c.slot === 'skin' && skinKind(c) === tab)).sort(
    (a, b) => order(a) - order(b),
  );

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 1600);
  };
  const status = (item: CosmeticDef): Status => {
    const owned = save.owned.includes(item.id);
    if (owned) return (item.slot === 'hat' ? save.equipped.hat === item.id : save.equipped.skins[item.cat!] === item.id) ? 'equipped' : 'owned';
    if (item.slot === 'skin' && item.cat && !save.collection[item.cat]) return 'locked';
    return 'buy';
  };
  const buy = (item: CosmeticDef) => {
    const r = saveStore.buyCosmetic(item.id);
    if (!r.ok) {
      flash(r.reason === 'locked' ? t('shop.lockedHint', { cat: t(`cat.${item.cat}.name`) }) : t('shop.noCoins'));
      return;
    }
    saveStore.toggleEquip(item.id); // wear it right away (one skin per cat: replaces the old one)
    flash(t('shop.bought', { name: t(`cosmetic.${item.id}.name`) }));
  };

  return (
    <div className="screen shop">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          {t('common.home')}
        </button>
        <button className="btn btn-small shop-help" onClick={() => setIntro(true)}>
          {t('shop.introBtn')}
        </button>
        <span className="coin-pill" title={t('currency.coins')}>
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      <h2 className="center">{t('shop.title')}</h2>
      <p className="muted small center">{t('shop.subtitle')}</p>
      <div className="tabs shop-tabs" role="tablist">
        {(['special', 'regular', 'hat'] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {t(k === 'hat' ? 'shop.tabHats' : k === 'regular' ? 'shop.tabRegular' : 'shop.tabSpecial')}
          </button>
        ))}
      </div>
      <p className={`shop-kind-note ${tab === 'special' ? 'special' : ''}`}>{tab === 'special' ? t('shop.specialNote') : t('skin.regular')}</p>
      <div className="shop-grid">
        {items.map((item) => (
          <ShopCard key={item.id} item={item} status={status(item)} loadout={save.equipped} coins={save.fishCoins} onOpen={() => setPreview(item)} />
        ))}
      </div>
      {preview && (
        <PreviewSheet
          item={preview}
          status={status(preview)}
          loadout={save.equipped}
          coins={save.fishCoins}
          onBuy={() => buy(preview)}
          onEquip={() => saveStore.toggleEquip(preview.id)}
          onClose={() => setPreview(null)}
        />
      )}
      {intro && <ShopIntro onClose={() => setIntro(false)} />}
      {msg && <div className="toast-inline">{msg}</div>}
    </div>
  );
}

/** The loadout used to show an item: current loadout with this one item put on. */
function tryOn(item: CosmeticDef, loadout: CosmeticLoadout): { cat: CatId; loadout: CosmeticLoadout } {
  if (item.slot === 'hat') return { cat: 'kitten', loadout: { hat: item.id, skins: loadout.skins } };
  return { cat: item.cat!, loadout: { hat: loadout.hat, skins: { ...loadout.skins, [item.cat!]: item.id } } };
}

function KindLabel({ item }: { item: CosmeticDef }) {
  const special = skinKind(item) === 'special';
  return <span className={`skin-kind ${special ? 'special' : 'regular'}`}>{special ? t('skin.special') : t('skin.regular')}</span>;
}

/** Corner chip for Locked (Owned / Equipped show in the card's bottom label instead). */
function StatusChip({ status }: { status: Status }) {
  if (status !== 'locked') return null;
  return (
    <span className={`skin-status ${status}`}>
      {status === 'locked' && <GameIcon name="lock" size={11} />} {t(`shop.status.${status}`)}
    </span>
  );
}

function ShopCard({
  item,
  status,
  loadout,
  coins,
  onOpen,
}: {
  item: CosmeticDef;
  status: Status;
  loadout: CosmeticLoadout;
  coins: number;
  onOpen: () => void;
}) {
  const p = tryOn(item, loadout);
  return (
    <button
      className={`shop-card ${status} ${skinKind(item)}`}
      onClick={onOpen}
      aria-label={`${t(`cosmetic.${item.id}.name`)} — ${t('shop.preview')}`}
    >
      <StatusChip status={status} />
      <CatPreview type={p.cat} loadout={p.loadout} size={68} />
      <div className="shop-name">{t(`cosmetic.${item.id}.name`)}</div>
      <div className="muted tiny">{item.cat ? t('skin.forCat', { cat: t(`cat.${item.cat}.name`) }) : t('shop.allCats')}</div>
      <KindLabel item={item} />
      {item.bonus && <div className="skin-bonus">{skinBonusText(item.bonus)}</div>}
      {status === 'buy' || status === 'locked' ? (
        <span className={`shop-price ${coins < item.price || status === 'locked' ? 'short' : ''}`}>
          <CoinIcon size={14} /> {item.price}
        </span>
      ) : (
        <span className={`shop-price owned ${status}`}>{status === 'equipped' ? t('shop.equipped') : t('shop.status.owned')}</span>
      )}
    </button>
  );
}

function PreviewSheet({
  item,
  status,
  loadout,
  coins,
  onBuy,
  onEquip,
  onClose,
}: {
  item: CosmeticDef;
  status: Status;
  loadout: CosmeticLoadout;
  coins: number;
  onBuy: () => void;
  onEquip: () => void;
  onClose: () => void;
}) {
  useLang();
  const p = tryOn(item, loadout);
  // "Now": without this item (skins: the cat's default look; hats: no hat).
  const now: CosmeticLoadout =
    item.slot === 'hat'
      ? { hat: null, skins: loadout.skins }
      : { hat: loadout.hat, skins: { ...loadout.skins, [item.cat!]: undefined } as CosmeticLoadout['skins'] };
  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel skin-preview" role="dialog" aria-label={t(`cosmetic.${item.id}.name`)}>
        <button className="info-x" onClick={onClose} aria-label={t('shop.close')}>
          ✕
        </button>
        <div className="skin-compare">
          <div>
            <CatPreview type={p.cat} loadout={now} size={70} />
            <div className="muted tiny">{t('shop.before')}</div>
          </div>
          <GameIcon name="next" size={18} />
          <div className="skin-after">
            <CatPreview type={p.cat} loadout={p.loadout} size={124} attackLoop />
            <div className="tiny">{t('shop.after')}</div>
          </div>
        </div>
        <h2 className="skin-title">{t(`cosmetic.${item.id}.name`)}</h2>
        <div className="muted small">{item.cat ? t('skin.forCat', { cat: t(`cat.${item.cat}.name`) }) : t('shop.allCats')}</div>
        <div>
          <KindLabel item={item} />
        </div>
        {item.bonus && <div className="skin-bonus big">{t('skin.bonusLine', { bonus: skinBonusText(item.bonus) })}</div>}
        <p className="small skin-desc">{t(`cosmetic.${item.id}.desc`)}</p>
        {item.bonus && <p className="muted tiny">{t('shop.specialNote')}</p>}
        {status === 'locked' ? (
          <div className="skin-locked">
            <GameIcon name="lock" size={14} /> {t('shop.lockedHint', { cat: t(`cat.${item.cat}.name`) })}
          </div>
        ) : status === 'buy' ? (
          <button className={`btn btn-primary ${coins < item.price ? 'disabled' : ''}`} onClick={onBuy}>
            {t('shop.buy')} · <CoinIcon size={16} /> {item.price}
          </button>
        ) : (
          <button className={`btn ${status === 'equipped' ? 'btn-secondary' : 'btn-primary'}`} onClick={onEquip}>
            {status === 'equipped' ? t('shop.unequip') : t('shop.equip')}
          </button>
        )}
      </div>
    </div>
  );
}
