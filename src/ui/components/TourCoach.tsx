import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t, useLang } from '../../i18n';
import { saveStore } from '../../save/store';
import { TOURS, rewindStep, tourStore, useTour, type TourScreen } from '../../tutorial/tours';

type Box = { x: number; y: number; w: number; h: number };

/** First visible element for a selector (a tour target). */
function findTarget(sel: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * The guided-tour coach (Shop + Encyclopedia, Recruitment). It spotlights the real element of the
 * current step and blocks everything around it (the spotlight stays tappable). A 'tap' step moves
 * on only when that element is tapped. The visible Skip Tutorial button (with confirmation) is
 * the only other way out — tapping the dimmed area does nothing.
 */
export function TourCoach({ screen }: { screen: string }) {
  useLang();
  const tour = useTour();
  const [box, setBox] = useState<Box | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  /** Another popup (e.g. a recruit reveal) is open: the coach waits until it closes. */
  const [paused, setPaused] = useState(false);
  const step = tour ? TOURS[tour.id][tour.step] : null;
  const onScreen = !!step && step.screen === (screen as TourScreen);
  const targetRef = useRef<HTMLElement | null>(null);

  // Track the target's position (screens scroll / animate / resize).
  useLayoutEffect(() => {
    if (!onScreen || !step) {
      setBox(null);
      return;
    }
    let raf = 0;
    let scrolled = false;
    const tick = () => {
      setPaused(!!document.querySelector('.reveal-overlay, .overlay:not(.practice-menu)'));
      const el = findTarget(step.target);
      targetRef.current = el;
      if (el) {
        if (!scrolled) {
          el.scrollIntoView?.({ block: 'center' });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        setBox((b) => (b && Math.abs(b.x - r.left) < 0.5 && Math.abs(b.y - r.top) < 0.5 && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { x: r.left, y: r.top, w: r.width, h: r.height }));
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [onScreen, step]);

  // Look-only steps: the spotlit area still scrolls, but taps inside it do nothing (e.g. no
  // purchase can happen during the Shop step).
  useEffect(() => {
    if (!onScreen || !step?.viewOnly) return;
    const swallow = (e: MouseEvent) => {
      const el = targetRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', swallow, true);
    return () => document.removeEventListener('click', swallow, true);
  }, [onScreen, step]);

  // 'tap' steps: advance after the player taps the spotlit element (the tap itself still works).
  useEffect(() => {
    if (!onScreen || !step || step.action !== 'tap') return;
    const onClick = (e: MouseEvent) => {
      const el = targetRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) window.setTimeout(() => tourStore.next(), 0);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [onScreen, step]);

  useEffect(() => setConfirmSkip(false), [tour?.step, tour?.id]);

  // Leaving the tour's path (Back gesture, a menu button…) never ends or completes the tour: once
  // the player is on a screen the tour visits, it resumes from that screen's latest step. The
  // short delay lets a 'tap' step's own navigation settle first.
  useEffect(() => {
    if (!tour || onScreen) return;
    const r = window.setTimeout(() => {
      const cur = tourStore.get();
      if (!cur || TOURS[cur.id][cur.step].screen === screen) return;
      const back = rewindStep(cur.id, cur.step, screen);
      if (back !== null) tourStore.start(cur.id, cur.mode, back);
    }, 450);
    return () => window.clearTimeout(r);
  }, [tour, onScreen, screen]);

  if (!tour || !step || !onScreen || paused) return null;
  const finish = () => {
    if (tour.mode === 'onboarding') saveStore.setTutorial(tour.id, 'done');
    tourStore.stop();
  };
  const skip = () => {
    if (tour.mode === 'onboarding') saveStore.setTutorial(tour.id, 'skipped');
    tourStore.stop();
  };
  const pad = 6;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  // The spotlight is clipped to the screen (a tall target such as the Shop grid may overflow it).
  const hole = box
    ? (() => {
        const x = Math.max(0, box.x - pad);
        const y = Math.max(0, box.y - pad);
        return { x, y, w: Math.min(vw, box.x + box.w + pad) - x, h: Math.min(vh, box.y + box.h + pad) - y };
      })()
    : null;
  // Bubble: below the spotlight if there is room, else above, else pinned to the bottom edge.
  const BUBBLE = 190;
  const roomBelow = hole ? vh - (hole.y + hole.h) : vh;
  const roomAbove = hole ? hole.y : 0;
  const place: 'below' | 'above' | 'pinned' = roomBelow >= BUBBLE ? 'below' : roomAbove >= BUBBLE ? 'above' : 'pinned';
  const bubbleStyle =
    place === 'below' ? { top: (hole ? hole.y + hole.h : 80) + 12 } : place === 'above' ? { bottom: vh - (hole?.y ?? vh) + 12 } : { bottom: 12 };
  const total = TOURS[tour.id].length;
  return (
    <div className="tour" data-tour={tour.id} data-step={tour.step}>
      {hole ? (
        <>
          {/* Four blockers around the spotlight: only the spotlit element can be tapped. */}
          <div className="tour-block" style={{ left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }} />
          <div className="tour-block" style={{ left: 0, top: hole.y + hole.h, right: 0, bottom: 0 }} />
          <div className="tour-block" style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
          <div className="tour-block" style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
          <div className="tour-ring" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
        </>
      ) : (
        <div className="tour-block" style={{ inset: 0 }} />
      )}
      <div className={`tour-bubble ${place}`} style={bubbleStyle} role="dialog" aria-live="polite">
        <div className="tour-kicker">
          {t(`tour.${tour.id}.kicker`)} · {tour.step + 1}/{total}
        </div>
        <p>{t(step.textKey)}</p>
        <div className="tour-actions">
          {confirmSkip ? (
            <>
              <span className="tiny">{t('tour.skipConfirm')}</span>
              <button className="btn btn-small btn-secondary" onClick={() => setConfirmSkip(false)}>
                {t('tour.keepGoing')}
              </button>
              <button className="btn btn-small" onClick={skip}>
                {t('teamTut.skip')}
              </button>
            </>
          ) : (
            <>
              <button className="link-btn tiny tour-skip" onClick={() => setConfirmSkip(true)}>
                {t('teamTut.skip')}
              </button>
              {step.action === 'next' && (
                <button className="btn btn-small btn-primary tour-next" onClick={() => tourStore.next()}>
                  {t('tour.next')}
                </button>
              )}
              {step.action === 'finish' && (
                <button className="btn btn-small btn-primary tour-finish" onClick={finish}>
                  {t('tour.finish')}
                </button>
              )}
              {step.action === 'tap' && <span className="tiny muted">{t('tour.tapHint')}</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
