import { useRef, useState } from 'react';
import { LANGS, setLang, t, useLang } from '../../i18n';
import { THEMES, setTheme, useTheme } from '../../theme';
import { saveStore, useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { BrandEmblem, HomeScenery } from '../components/Brand';
import { GameIcon } from '../components/GameIcon';
import { CoinIcon } from '../components/Icons';
import { debugStore, useDebug } from '../debugStore';
import { ShopIntro } from '../components/ShopIntro';
import { SKIN_RULES } from '../../config/cosmetics';

/** Seen-id of the one-time Skin Shop introduction (Home → Replay tutorials shows it again). */
export const SHOP_INTRO_ID = 'tut:shop';

export const APP_VERSION = '1.7';

export function HomeScreen({
  go,
  blocked = false,
}: {
  go: (s: Screen) => void;
  /** Another popup is open (resume prompt, rewards). */ blocked?: boolean;
}) {
  const lang = useLang();
  const theme = useTheme();
  const save = useSave();
  const debug = useDebug();
  const cleared = Object.keys(save.cleared).length;
  const [note, setNote] = useState<string | null>(null);
  const taps = useRef<number[]>([]);
  // Skin Shop intro: once, after the first clear of Stage 1-3 (also for players already past it).
  const showShopIntro = !blocked && SKIN_RULES.shopIntroAfterStage in save.cleared && !save.seen.includes(SHOP_INTRO_ID);

  const flash = (m: string) => {
    setNote(m);
    window.setTimeout(() => setNote(null), 2200);
  };

  // Hidden developer toggle: tap the version label 5 times quickly.
  const onVersionTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((x) => now - x < 2000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      debugStore.setEnabled(!debugStore.get().enabled);
      flash(debugStore.get().enabled ? 'Debug tools ON' : 'Debug tools OFF');
    }
  };

  return (
    <div className="screen home">
      <HomeScenery />
      <div className="topbar">
        <div className="home-settings">
          <div className="lang-switch" role="group" aria-label={t('home.language')}>
            {LANGS.map((l) => (
              <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          {/* Visual theme only: never touches progress, stats or combat. */}
          <div className="theme-switch" role="group" aria-label={t('theme.label')}>
            {THEMES.map((th) => (
              <button key={th.id} className={theme === th.id ? 'on' : ''} onClick={() => setTheme(th.id)}>
                <GameIcon name={th.id === 'moonlit' ? 'moon' : 'sun'} size={14} /> {t(`theme.${th.id}`)}
              </button>
            ))}
          </div>
        </div>
        <span className="coin-pill" title={t('currency.coins')}>
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      <div className="home-hero">
        <BrandEmblem />
        <h1 className={`logo ${lang === 'zh-HK' ? 'zh' : ''}`}>
          <span>{t('logo.1')}</span>
          <span>{t('logo.2')}</span>
        </h1>
        <p className="tagline">{t('home.tagline')}</p>
        <div className="home-cats">
          {save.team.map((c) => (
            <CatPreview key={c} type={c} loadout={save.equipped} size={60} />
          ))}
        </div>
      </div>
      <div className={`home-menu ${showShopIntro ? 'intro-active' : ''}`}>
        <button className="btn btn-big btn-primary" onClick={() => go({ name: 'stages' })}>
          <GameIcon name="play" size={22} /> {t('home.play')}
        </button>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => go({ name: 'recruit' })}>
            <GameIcon name="recruit" size={22} /> {t('home.recruit')}
          </button>
          <button
            className={`btn btn-secondary ${showShopIntro ? 'spotlit' : ''}`}
            onClick={() => {
              if (showShopIntro) saveStore.markSeen(SHOP_INTRO_ID);
              go({ name: 'shop' });
            }}
          >
            <GameIcon name="shop" size={22} /> {t('home.shop')}
          </button>
          <button className="btn btn-secondary" onClick={() => go({ name: 'cats' })}>
            <GameIcon name="book" size={22} /> {t('home.cats')}
          </button>
        </div>
        <p className="muted small">{t('home.progress', { n: cleared })}</p>
        <div className="home-links">
          <button
            className="link-btn"
            onClick={() => {
              saveStore.resetTutorials();
              flash(t('home.replayDone'));
            }}
          >
            {t('home.replayTutorials')}
          </button>
          <button
            className="link-btn"
            onClick={() => {
              if (window.confirm(t('home.resetConfirm'))) saveStore.reset();
            }}
          >
            {t('home.reset')}
          </button>
        </div>
        <button className="version" onClick={onVersionTap}>
          v{APP_VERSION}
          {debug.enabled ? ' · debug' : ''}
        </button>
      </div>
      {showShopIntro && (
        <ShopIntro
          onClose={() => saveStore.markSeen(SHOP_INTRO_ID)}
          onGo={() => {
            saveStore.markSeen(SHOP_INTRO_ID);
            go({ name: 'shop' });
          }}
        />
      )}
      {note && <div className="toast-inline">{note}</div>}
    </div>
  );
}
