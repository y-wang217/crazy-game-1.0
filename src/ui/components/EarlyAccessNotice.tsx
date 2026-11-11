import { useEffect, useRef } from 'react';
import { versionLabel } from '../../config/version';
import { LANGS, setLang, t, useLang } from '../../i18n';
import { THEMES, setTheme, useTheme } from '../../theme';
import { BrandEmblem } from './Brand';
import { GameIcon } from './GameIcon';

const KEY = 'catdefense.noticeSeen';

/** Shown once per browser session (sessionStorage); never touches the save. */
export function noticeSeenThisSession(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
export function markNoticeSeen(): void {
  try {
    globalThis.sessionStorage?.setItem(KEY, '1');
  } catch {
    /* storage blocked: it simply shows again next load */
  }
}

/**
 * Early Access / development notice before the main menu. Its language and theme switches are
 * the SAME shared preferences as the rest of the game (settings/preferences.ts), and the card
 * itself is drawn in the selected theme, so what the player picks here is what every screen uses.
 * The version comes from config/version.ts.
 */
export function EarlyAccessNotice({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const theme = useTheme();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div className="ea-notice" role="dialog" aria-modal="true" aria-labelledby="ea-title" aria-describedby="ea-body">
      <div className="ea-sky" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 92}%`, animationDelay: `${(i % 5) * 0.5}s` }} />
        ))}
      </div>
      <div className="ea-card">
        <div className="ea-settings">
          <div className="ea-lang" role="group" aria-label={t('home.language')}>
            {LANGS.map((l) => (
              <button key={l.id} className={lang === l.id ? 'on' : ''} aria-pressed={lang === l.id} data-lang={l.id} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="ea-lang ea-theme" role="group" aria-label={t('theme.label')}>
            {THEMES.map((th) => (
              <button key={th.id} className={theme === th.id ? 'on' : ''} aria-pressed={theme === th.id} data-theme-id={th.id} onClick={() => setTheme(th.id)}>
                <GameIcon name={th.id === 'moonlit' ? 'moon' : 'sun'} size={13} /> {t(`theme.${th.id}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="ea-emblem">
          <BrandEmblem />
        </div>
        <h2 id="ea-title" className="ea-title">
          {t('ea.title')}
        </h2>
        <div id="ea-body" className="ea-body">
          <p className="ea-thanks">{t('ea.thanks')}</p>
          <p>{t('ea.body')}</p>
          <p className="ea-version">{t('ea.version', { v: versionLabel() })}</p>
          <p className="ea-closing">{t('ea.closing')}</p>
        </div>
        <button
          ref={btn}
          className="btn btn-primary btn-big ea-ok"
          onClick={() => {
            markNoticeSeen();
            onClose();
          }}
        >
          {t('ea.ok')}
        </button>
      </div>
    </div>
  );
}
