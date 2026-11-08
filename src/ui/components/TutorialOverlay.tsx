import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CATS, TARGET_MODES, TARGET_MODE_INFO } from '../../config/cats';
import { CHESTS } from '../../config/enemies';
import type { Battle } from '../../game/battle';
import { t, useLang } from '../../i18n';
import type { Renderer } from '../../render/renderer';
import type { ActiveStep, Focus } from '../../tutorial/director';
import type { CosmeticLoadout } from '../../game/types';
import { CatPreview, FoePreview } from './CatPreview';
import { CoinIcon } from './Icons';
import { GameIcon, type IconName } from './GameIcon';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  round: number;
}

/**
 * Tutorial / introduction overlay: dims the screen with spotlight holes over
 * the focused things, animates a pointing hand, and shows the lesson panel.
 * Passive steps block input and wait for Continue; interactive steps let input
 * through (the director gates which action counts).
 */
export function TutorialOverlay({
  step,
  battle,
  renderer,
  appRef,
  buttons,
  loadout,
  onContinue,
}: {
  step: ActiveStep;
  battle: Battle;
  renderer: Renderer | null;
  appRef: React.RefObject<HTMLElement>;
  buttons: Record<'summon' | 'skill' | 'speed' | 'start', React.RefObject<HTMLElement>>;
  loadout: CosmeticLoadout;
  onContinue: () => void;
}) {
  useLang();
  const [rects, setRects] = useState<Rect[]>([]);
  const [hand, setHand] = useState<{ from: Rect; to?: Rect } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const keyRef = useRef('');

  // Track focus positions every frame (cheap; only re-renders on change).
  useEffect(() => {
    let raf = 0;
    const resolve = (f: Focus): Rect | null => {
      const app = appRef.current?.getBoundingClientRect();
      if (!app) return null;
      if (f.kind === 'button') {
        const r = buttons[f.id].current?.getBoundingClientRect();
        return r ? { x: r.left - app.left - 4, y: r.top - app.top - 4, w: r.width + 8, h: r.height + 8, round: 20 } : null;
      }
      if (!renderer) return null;
      let wx = 0;
      let wy = 0;
      let wr = 25;
      if (f.kind === 'cat') {
        const c = battle.catByUid(f.uid);
        if (!c) return null;
        wx = c.x;
        wy = c.y;
        wr = 26;
      } else if (f.kind === 'tile') {
        const tile = battle.tileById(f.id);
        if (!tile) return null;
        wx = tile.x;
        wy = tile.y;
        wr = 25;
      } else if (f.kind === 'foe') {
        const foe = battle.foes.find((x) => x.uid === f.uid);
        if (!foe) return null;
        wx = foe.x;
        wy = foe.y - 4;
        wr = foe.radius + 16;
      } else {
        wx = f.x;
        wy = f.y;
        wr = f.r;
      }
      const p = renderer.worldToClient(wx, wy);
      const r = wr * p.k;
      return { x: p.x - app.left - r, y: p.y - app.top - r, w: r * 2, h: r * 2, round: r };
    };
    const frame = () => {
      const app = appRef.current?.getBoundingClientRect();
      const rs = step.focus.map(resolve).filter((r): r is Rect => !!r);
      let h: { from: Rect; to?: Rect } | null = null;
      if (step.pointer?.type === 'tap') {
        const a = resolve(step.pointer.at);
        if (a) h = { from: a };
      } else if (step.pointer?.type === 'drag') {
        const a = resolve(step.pointer.from);
        const b = resolve(step.pointer.to);
        if (a && b) h = { from: a, to: b };
      }
      const k = JSON.stringify([rs, h, app?.width, app?.height]);
      if (k !== keyRef.current) {
        keyRef.current = k;
        setRects(rs);
        setHand(h);
        if (app) setBox({ w: app.width, h: app.height });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [step, battle, renderer, appRef, buttons]);

  const interactive = !!step.expect;
  // Put the panel on the half of the screen away from what we're pointing at.
  const focusY = rects.length ? rects.reduce((a, r) => a + r.y + r.h / 2, 0) / rects.length : 0;
  const panelAtTop = interactive && rects.length > 0 && focusY > box.h * 0.45;

  return (
    <div className={`tut-root ${interactive ? 'interactive' : 'passive'}`}>
      <svg className="tut-dim" width={box.w} height={box.h} aria-hidden>
        <defs>
          <mask id={`tut-mask-${step.key}`}>
            <rect x="0" y="0" width={box.w} height={box.h} fill="white" />
            {rects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.round} fill="black" />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width={box.w} height={box.h} style={{ fill: 'var(--dim)' }} mask={`url(#tut-mask-${step.key})`} />
        {rects.map((r, i) => (
          <rect key={i} className="tut-ring" x={r.x} y={r.y} width={r.w} height={r.h} rx={r.round} />
        ))}
      </svg>

      {hand && <Hand from={hand.from} to={hand.to} />}

      {interactive ? (
        <div className={`tut-bar ${panelAtTop ? 'top' : 'bottom'}`}>
          <div className="tut-bar-title">{t(step.panel.kind === 'text' ? step.panel.titleKey : '')}</div>
          {step.panel.kind === 'text' && <div className="tut-bar-body">{t(step.panel.bodyKey)}</div>}
          {step.hintKey && <div className="tut-hint"><GameIcon name="next" size={14} /> {t(step.hintKey)}</div>}
        </div>
      ) : (
        <div className="tut-card-wrap">
          <div className="tut-card" key={step.key}>
            <PanelBody step={step} loadout={loadout} />
            <button className="btn btn-primary tut-continue" onClick={onContinue}>
              {step.panel.kind === 'text' ? t('tut.continue') : t('tut.gotIt')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Hand({ from, to }: { from: Rect; to?: Rect }) {
  const cx = (r: Rect) => r.x + r.w / 2;
  const cy = (r: Rect) => r.y + r.h / 2;
  const style = {
    '--fx': `${cx(from)}px`,
    '--fy': `${cy(from)}px`,
    '--tx': `${to ? cx(to) : cx(from)}px`,
    '--ty': `${to ? cy(to) : cy(from)}px`,
  } as CSSProperties;
  return (
    <div className={`tut-hand ${to ? 'drag' : 'tap'}`} style={style} aria-hidden>
      <GameIcon name="tap" size={40} />
    </div>
  );
}

function PanelBody({ step, loadout }: { step: ActiveStep; loadout: CosmeticLoadout }) {
  const p = step.panel;
  if (p.kind === 'cat') {
    const id = p.cat;
    return (
      <div className="intro">
        <div className="intro-kicker">{t('intro.newCat')}</div>
        <div className="intro-art">
          <CatPreview type={id} level={1} loadout={loadout} size={120} attackLoop />
        </div>
        <h2 className="intro-name">{t(`cat.${id}.name`)}</h2>
        <div className="intro-sub">{t(`cat.${id}.title`)}</div>
        <p className="intro-quote">“{t(`cat.${id}.personality`)}”</p>
        <dl className="intro-facts">
          <dt>{t('intro.role')}</dt>
          <dd>{t(`cat.${id}.role`)}</dd>
          <dt>{t('intro.attack')}</dt>
          <dd>{t(`cat.${id}.attack`)}</dd>
          <dt className="good">{t('intro.strengths')}</dt>
          <dd>{t(`cat.${id}.strengths`)}</dd>
          <dt className="bad">{t('intro.weaknesses')}</dt>
          <dd>{t(`cat.${id}.weaknesses`)}</dd>
        </dl>
        <StatBars cat={id} />
      </div>
    );
  }
  if (p.kind === 'enemy') {
    const id = p.enemy;
    return (
      <div className="intro">
        <div className="intro-kicker bad">{t('intro.newEnemy')}</div>
        <div className="intro-art">
          <FoePreview enemy={id} size={110} />
        </div>
        <h2 className="intro-name">{t(`enemy.${id}.name`)}</h2>
        <dl className="intro-facts">
          <dt className="bad">{t('intro.watchOut')}</dt>
          <dd>{t(`enemy.${id}.strength`)}</dd>
          <dt>{t('intro.behavior')}</dt>
          <dd>{t(`enemy.${id}.behavior`)}</dd>
          <dt className="good">{t('intro.tip')}</dt>
          <dd>{t(`enemy.${id}.tip`)}</dd>
        </dl>
      </div>
    );
  }
  if (p.kind === 'chest') {
    const def = CHESTS[p.tier];
    return (
      <div className="intro">
        <div className="intro-kicker gold">{t('intro.newChest')}</div>
        <div className="intro-art">
          <FoePreview chest={p.tier} size={110} />
        </div>
        <h2 className="intro-name">{t(`chest.${p.tier}.name`)}</h2>
        <div className="intro-sub">{t(`chest.${p.tier}.desc`)}</div>
        <ul className="intro-list">
          <li><GameIcon name="gift" size={16} /> {t('intro.chestSkills')}</li>
          <li>
            <CoinIcon size={16} /> {t('intro.chestCoins', { min: def.coins[0], max: def.coins[1] })}
          </li>
          <li><GameIcon name="speed" size={16} /> {t('intro.chestTip')}</li>
        </ul>
      </div>
    );
  }
  // Plain lesson
  return (
    <div className="intro">
      <h2 className="intro-name">{t(p.titleKey)}</h2>
      <p className="intro-body">{t(p.bodyKey)}</p>
      {p.extra === 'modes' && (
        <ul className="mode-list">
          {TARGET_MODES.map((m) => (
            <li key={m}>
              <span className="mode-dot" style={{ background: TARGET_MODE_INFO[m].color }}>
                {t(`mode.${m}.short`)}
              </span>
              <b>{t(`mode.${m}`)}</b> <span className="muted">{t(`mode.${m}.desc`)}</span>
            </li>
          ))}
        </ul>
      )}
      {p.extra === 'targetTips' && (
        <ul className="mode-list">
          {(['first', 'strongest', 'weakest', 'nearest', 'treasure'] as const).map((m) => (
            <li key={m}>
              <span className="mode-dot" style={{ background: TARGET_MODE_INFO[m].color }}>
                {t(`mode.${m}.short`)}
              </span>
              <b>{t(`mode.${m}`)}</b> <span className="muted">{t(`tut.targetTips.${m}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Simple relative stat bars so cats are easy to compare at a glance. */
function StatBars({ cat }: { cat: keyof typeof CATS }) {
  const d = CATS[cat];
  const hits = d.comboHits ?? 1;
  const dps = (d.damage * hits) / d.interval;
  const rows: [IconName, number][] = [
    ['damage', Math.min(1, (d.damage * hits) / 46)],
    ['speed', Math.min(1, 0.75 / d.interval)],
    ['range', Math.min(1, d.range / 150)],
  ];
  if (d.attack === 'aura') rows[0] = ['charm', 0.8];
  return (
    <div className="stat-bars" title={`DPS ${dps.toFixed(0)}`}>
      {rows.map(([icon, v]) => (
        <div key={icon} className="stat-row">
          <GameIcon name={icon} size={16} />
          <div className="stat-track">
            <div className="stat-fill" style={{ width: `${Math.round(v * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
