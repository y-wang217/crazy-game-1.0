import { useRef, useState } from 'react';
import { CAT_ORDER } from '../../config/cats';
import { LANGS, setLang, t, useLang } from '../../i18n';
import { THEMES, setTheme, useTheme } from '../../theme';
import { saveStore, useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { CoinIcon } from '../components/Icons';
import { debugStore, useDebug } from '../debugStore';

export const APP_VERSION = '1.2';

export function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const lang = useLang();
  const theme = useTheme();
  const save = useSave();
  const debug = useDebug();
  const cleared = Object.keys(save.cleared).length;
  const [note, setNote] = useState<string | null>(null);
  const taps = useRef<number[]>([]);

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
                {th.icon} {t(`theme.${th.id}`)}
              </button>
            ))}
          </div>
        </div>
        <span className="coin-pill" title={t('currency.coins')}>
          <CoinIcon /> {save.fishCoins}
        </span>
      </div>
      <div className="home-hero">
        <h1 className={`logo ${lang === 'zh-TW' ? 'zh' : ''}`}>
          <span>{t('logo.1')}</span>
          <span>{t('logo.2')}</span>
        </h1>
        <p className="tagline">{t('home.tagline')}</p>
        <div className="home-cats">
          {CAT_ORDER.map((c) => (
            <CatPreview key={c} type={c} loadout={save.equipped} size={60} />
          ))}
        </div>
      </div>
      <div className="home-menu">
        <button className="btn btn-big btn-primary" onClick={() => go({ name: 'stages' })}>
          ▶ {t('home.play')}
        </button>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => go({ name: 'shop' })}>
            🛍️ {t('home.shop')}
          </button>
          <button className="btn btn-secondary" onClick={() => go({ name: 'cats' })}>
            🐾 {t('home.cats')}
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
      {note && <div className="toast-inline">{note}</div>}
    </div>
  );
}
