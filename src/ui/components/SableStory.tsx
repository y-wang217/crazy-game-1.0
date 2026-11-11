import { useEffect, useState } from 'react';
import type { CosmeticLoadout } from '../../game/types';
import { t, useLang } from '../../i18n';
import { CatPreview } from './CatPreview';

const LINES = ['story.sable.0', 'story.sable.1', 'story.sable.2', 'story.sable.3'];

/**
 * Sir Sable joins after Chapter 1: a short, character-driven introduction (he knows the
 * Mushroom Forest's paths and how to use them). Advances line by line; ends by finishing it or
 * by the visible Skip Tutorial button — never by tapping outside.
 */
export function SableStory({ loadout, onDone, onSkip, replay = false }: { loadout: CosmeticLoadout; onDone: () => void; onSkip: () => void; replay?: boolean }) {
  const lang = useLang();
  const [i, setI] = useState(0);
  const quote = (x: string) => (lang === 'zh-HK' ? `「${x}」` : `“${x}”`);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const id = window.setTimeout(() => setReady(true), 600); // no accidental tap-through
    return () => window.clearTimeout(id);
  }, [i]);
  const last = i === LINES.length - 1;
  return (
    <div className="shop-intro story-sable" role="dialog" aria-modal="true" aria-labelledby="sable-story-name">
      <div className="panel shop-intro-card story-card">
        <div className="intro-kicker gold">{t('story.sable.kicker')}</div>
        <div className="story-portrait">
          <CatPreview type="sable" level={i >= 2 ? 3 : 1} loadout={loadout} size={120} attackLoop={i === 2} />
        </div>
        <h2 id="sable-story-name">{t('cat.sable.name')}</h2>
        <p className={`story-line ${i === 0 ? 'narration' : ''}`} key={i}>
          {i === 0 ? t(LINES[i]) : quote(t(LINES[i]))}
        </p>
        <div className="story-dots" aria-hidden>
          {LINES.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="shop-intro-btns">
          <button className="btn btn-secondary story-skip" onClick={() => (replay || window.confirm(t('story.skipConfirm'))) && onSkip()}>
            {t(replay ? 'common.close' : 'teamTut.skip')}
          </button>
          <button className="btn btn-primary" disabled={!ready} onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
