import { useEffect, useState } from 'react';
import { STARTER_CATS } from '../../config/cats';
import type { CatId, CosmeticLoadout } from '../../game/types';
import { t, useLang } from '../../i18n';
import { HomeScenery } from './Brand';
import { CatPreview } from './CatPreview';

/** Scene start times (ms) and total length — ~11 s storybook transition. */
const SCENES = [0, 3800, 7600];
const LENGTH = 11400;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Chapter 1 → Chapter 2 transition: (1) the cats celebrate in the moonlit forest,
 * (2) a mysterious glow appears beyond the trees, (3) the Chapter 2 title reveal
 * (Moonlit Mushroom Forest). Pure DOM/SVG/CSS, lightweight; reduced motion keeps only
 * gentle fades. Blocks all input underneath except the Skip button.
 */
export function ChapterCutscene({ cats, loadout, onDone }: { cats?: CatId[]; loadout: CosmeticLoadout; onDone: () => void }) {
  useLang();
  const [scene, setScene] = useState(0);
  const reduced = prefersReducedMotion();
  useEffect(() => {
    const timers = SCENES.slice(1).map((ms, i) => window.setTimeout(() => setScene(i + 1), ms));
    timers.push(window.setTimeout(onDone, LENGTH));
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const squad = (cats?.length ? cats : STARTER_CATS).slice(0, 5);

  return (
    <div className={`cutscene ${reduced ? 'reduced' : ''}`} role="dialog" aria-label={t('story.title')} onPointerDown={(e) => e.stopPropagation()}>
      {/* Scene 1 — celebration in the moonlit Beginner Forest */}
      <div className={`cs-scene cs-forest ${scene === 0 ? 'on' : ''}`}>
        <div className="cs-sky">
          <HomeScenery />
        </div>
        <div className="cs-kicker">{t('result.chapter', { n: 1 })}</div>
        <div className="cs-cats">
          {squad.map((c, i) => (
            <div key={c} className="cs-cat" style={{ animationDelay: `${i * 0.15}s` }}>
              <CatPreview type={c} level={Math.min(5, 2 + i)} loadout={loadout} size={58} animate={!reduced} />
            </div>
          ))}
        </div>
        <div className="cs-sparkles" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.3}s` }} />
          ))}
        </div>
        <div className="cs-bubble left" style={{ animationDelay: '0.5s' }}>
          <b>{t('cat.kitten.name')}</b> {t('story.s1.a')}
        </div>
        <div className="cs-bubble right" style={{ animationDelay: '1.9s' }}>
          <b>{t('cat.orange.name')}</b> {t('story.s1.b')}
        </div>
      </div>

      {/* Scene 2 — something glows beyond the trees */}
      <div className={`cs-scene cs-threat ${scene === 1 ? 'on' : ''}`}>
        <div className="cs-layer cs-far" />
        <div className="cs-glow" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} style={{ left: `${12 + i * 12}%`, animationDelay: `${i * 0.25}s` }} />
          ))}
        </div>
        <svg className="cs-king" viewBox="0 0 120 90" aria-hidden>
          <path d="M8 50 Q60 -8 112 50 Q60 40 8 50z" fill="#3a2a52" />
          <circle cx="40" cy="30" r="4" fill="#5a4a72" />
          <circle cx="74" cy="24" r="5" fill="#5a4a72" />
          <ellipse cx="60" cy="66" rx="26" ry="20" fill="#1a1626" />
          <circle className="cs-eye" cx="50" cy="62" r="3.2" fill="#9ff0d8" />
          <circle className="cs-eye" cx="70" cy="62" r="3.2" fill="#9ff0d8" />
        </svg>
        <div className="cs-layer cs-near" />
        <div className="cs-bubble left" style={{ animationDelay: '0.6s' }}>
          <b>{t('cat.black.name')}</b> {t('story.s2.a')}
        </div>
        <div className="cs-bubble right" style={{ animationDelay: '2s' }}>
          <b>{t('cat.white.name')}</b> {t('story.s2.b')}
        </div>
      </div>

      {/* Scene 3 — Chapter 2 reveal */}
      <div className={`cs-scene cs-reveal ${scene === 2 ? 'on' : ''}`}>
        <svg className="cs-mushrooms" viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" aria-hidden>
          {[
            [40, 150, 1.2, '#b58ad6'],
            [120, 170, 0.8, '#7fc8c0'],
            [250, 160, 1.4, '#e08aa8'],
            [320, 175, 0.9, '#d9ad72'],
          ].map(([x, y, s, c], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <rect x="-5" y="-6" width="10" height="26" rx="4" fill="#e8dcc8" />
              <path d="M-26 -4 Q0 -40 26 -4z" fill={c as string} />
              <circle cx="-9" cy="-16" r="3" fill="#fff" opacity="0.85" />
              <circle cx="7" cy="-20" r="3.6" fill="#fff" opacity="0.85" />
            </g>
          ))}
          <rect x="0" y="190" width="360" height="10" fill="#1f2730" />
        </svg>
        <div className="cs-spores" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 29) % 100}%`, animationDelay: `${(i % 6) * 0.45}s` }} />
          ))}
        </div>
        <div className="cs-title">
          <div className="cs-chapter">{t('stages.chapterN', { n: 2 })}</div>
          <div className="cs-name">{t('chapter.ch2')}</div>
          <div className="cs-sub">{t('story.s3.sub')}</div>
        </div>
      </div>

      <button className="btn btn-small cs-skip" onClick={onDone}>
        {t('story.skip')}
      </button>
      <div className="cs-dots" aria-hidden>
        {SCENES.map((_, i) => (
          <span key={i} className={i === scene ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
