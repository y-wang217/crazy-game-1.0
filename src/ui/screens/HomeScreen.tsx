import { CAT_ORDER } from '../../config/cats';
import { saveStore, useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { CoinIcon } from '../components/Icons';

export function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const save = useSave();
  const cleared = Object.keys(save.cleared).length;

  return (
    <div className="screen home">
      <div className="topbar">
        <span />
        <span className="coin-pill">
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      <div className="home-hero">
        <h1 className="logo">
          <span>CAT</span>
          <span>DEFENSE</span>
        </h1>
        <p className="tagline">Summon. Merge. Protect the fish!</p>
        <div className="home-cats">
          {CAT_ORDER.map((c) => (
            <CatPreview key={c} type={c} loadout={save.equipped} size={60} />
          ))}
        </div>
      </div>
      <div className="home-menu">
        <button className="btn btn-big btn-primary" onClick={() => go({ name: 'stages' })}>
          ▶ Play
        </button>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => go({ name: 'shop' })}>
            🛍️ Shop
          </button>
          <button className="btn btn-secondary" onClick={() => go({ name: 'cats' })}>
            🐾 Cats
          </button>
        </div>
        <p className="muted small">Chapter 1 progress: {cleared}/10 stages cleared</p>
        <button
          className="link-btn"
          onClick={() => {
            if (window.confirm('Reset all progress, coins and cosmetics?')) saveStore.reset();
          }}
        >
          Reset progress
        </button>
      </div>
    </div>
  );
}
