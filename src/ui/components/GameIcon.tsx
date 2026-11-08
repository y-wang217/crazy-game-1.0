import type { ReactNode } from 'react';
import type { SkillId } from '../../game/types';

// One small, consistent icon set for the whole game (no emoji mixing):
// 24×24 grid, rounded shapes, a shared outline (var(--icon-line)) and soft fills.
// Skill icons show the EFFECT; the cat a skill belongs to is shown separately (CatBadge).

export type IconName =
  | SkillId
  | 'shop'
  | 'book'
  | 'team'
  | 'home'
  | 'replay'
  | 'next'
  | 'list'
  | 'lock'
  | 'star'
  | 'heart'
  | 'trophy'
  | 'gift'
  | 'damage'
  | 'speed'
  | 'range'
  | 'charm'
  | 'sun'
  | 'moon'
  | 'play'
  | 'pause'
  | 'flag'
  | 'tap';

const L = 'var(--icon-line)';
const W = 1.6;

const P = (d: string, fill: string, extra: Record<string, unknown> = {}) => (
  <path d={d} fill={fill} stroke={L} strokeWidth={W} strokeLinejoin="round" strokeLinecap="round" {...extra} />
);
const C = (cx: number, cy: number, r: number, fill: string) => <circle cx={cx} cy={cy} r={r} fill={fill} stroke={L} strokeWidth={W} />;
const LINE = (d: string, color = L, w = W) => <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;

const paw = (x: number, y: number, s: number, fill: string) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {P('M-4 2.5c0-2.4 1.8-4 4-4s4 1.6 4 4c0 1.8-1.6 2.6-4 2.6s-4-.8-4-2.6z', fill)}
    {C(-4.6, -2.6, 1.6, fill)}
    {C(-1.6, -4.6, 1.6, fill)}
    {C(1.6, -4.6, 1.6, fill)}
    {C(4.6, -2.6, 1.6, fill)}
  </g>
);

const ICONS: Record<IconName, ReactNode> = {
  // ---------- Skills ----------
  sharpClaws: (
    <>
      {LINE('M6 18 L11 6', '#c06040', 2.6)}
      {LINE('M10.5 19 L15 7', '#c06040', 2.6)}
      {LINE('M15 20 L19 9', '#c06040', 2.6)}
    </>
  ),
  catnipRush: (
    <>
      {P('M5 19c0-8 5-13 14-14-1 9-6 14-14 14z', '#7cc05a')}
      {LINE('M5 19 L14 10')}
    </>
  ),
  armorBreak: (
    <>
      {P('M4 7h9v5H4z', '#9aa0b0')}
      {P('M12 9.5 L20 18', 'none')}
      {LINE('M12 9.5 L20 18', '#8a5a32', 3)}
      {LINE('M15 4 l1.5 2.5 M18 5.5 l-.5 2.6 M20 8.5 l-2.4.3', '#e0a020', 1.4)}
    </>
  ),
  fishyFortune: (
    <>
      {P('M3 12c3-5 9-5 13 0-4 5-10 5-13 0z', '#e8a858')}
      {P('M16 12l5-4v8z', '#e8a858')}
      {C(7, 11, 0.9, L)}
    </>
  ),
  bravePaws: paw(12, 13, 1.25, '#f4c98f'),
  explorerEyes: (
    <>
      {P('M2.5 12c4-6 15-6 19 0-4 6-15 6-19 0z', '#ffffff')}
      {C(12, 12, 3.4, '#4a8ad8')}
      {C(12.8, 11, 1, '#ffffff')}
    </>
  ),
  zoomies: (
    <>
      {LINE('M3 8h9 M2 12h12 M4 16h8', '#7aa8d8', 2.2)}
      {C(17, 12, 4, '#f4c98f')}
    </>
  ),
  flurryPaws: (
    <>
      {C(15, 12, 5, '#e89a9a')}
      {LINE('M3 9h5 M2 12.5h6 M3 16h5', '#e0a020', 2)}
    </>
  ),
  quickJabs: P('M13 2 4 14h7l-2 8 10-13h-7l1-7z', '#ffd040'),
  championPunch: (
    <>
      {P('M6 9c0-3 3-5 7-5s7 2 7 6v4c0 3-2 5-5 5H9c-2 0-3-1-3-3z', '#e04848')}
      {P('M6 16h9v4H6z', '#ffffff')}
    </>
  ),
  bigBelly: (
    <>
      <circle cx={12} cy={12} r={9.5} fill="none" stroke="#e0883a" strokeWidth={1.6} strokeDasharray="3 2.5" />
      {C(12, 12, 5.5, '#f29b4b')}
    </>
  ),
  bellySlam: P('M12 2l2.4 5.6 6-1.4-3.6 5 4.2 4.4-6 .6L13 22l-2-5.6-6 1 3.2-5.2L4 7.6l6 .4z', '#ffb03a'),
  aftershock: (
    <>
      {LINE('M3 15c2-3 4-3 6 0s4 3 6 0 4-3 6 0', '#5aa0d8', 2.2)}
      {LINE('M5 10c1.6-2.2 3.2-2.2 4.8 0s3.2 2.2 4.8 0 3.2-2.2 4.8 0', '#8ac0e8', 1.8)}
    </>
  ),
  steadyAim: (
    <>
      {C(12, 12, 7.5, 'none')}
      {LINE('M12 2v5 M12 17v5 M2 12h5 M17 12h5', '#d8504a', 2)}
      {C(12, 12, 1.6, '#d8504a')}
    </>
  ),
  deadeye: (
    <>
      {P('M4 13h11l5-1-5-1H4z', '#c8a030')}
      {P('M12 4l1.5 3.5 3.5.5-2.6 2.4.7 3.6L12 12l-3.1 2 .7-3.6L7 8l3.5-.5z', '#fff2a0')}
    </>
  ),
  longScope: (
    <>
      {P('M3 10h12v4H3z', '#6a6a78')}
      {C(18, 12, 4, '#8ad8ff')}
      {C(18, 12, 1.4, '#ffffff')}
    </>
  ),
  dazzlingGrace: (
    <>
      {P('M12 20C4 14 3 9 6 6.5c2.4-2 5-1 6 1 1-2 3.6-3 6-1 3 2.5 2 7.5-6 13.5z', '#ff8fb8')}
      {P('M18.5 3l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z', '#ffffff')}
    </>
  ),
  lingeringCharm: (
    <>
      {P('M6 3h12M6 21h12', 'none')}
      {LINE('M6 3h12 M6 21h12')}
      {P('M7 3.5c0 5 10 5 10 8.5S7 15.5 7 20.5h10c0-5-10-5-10-8.5S17 8.5 17 3.5z', '#f8c8d8')}
    </>
  ),
  radiantBeauty: P('M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z', '#ffe066'),

  // ---------- UI ----------
  shop: (
    <>
      {P('M4 8h16l-1.4 12.5H5.4z', '#ff9f43')}
      {LINE('M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8')}
      {P('M8 14c1.8-2.4 5-2.4 7 0-2 2.4-5.2 2.4-7 0z', '#ffd040')}
      {P('M15 14l2-1.6v3.2z', '#ffd040')}
    </>
  ),
  book: (
    <>
      {P('M4 4.5h7a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4z', '#a68bc4')}
      {P('M20 4.5h-7a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h7z', '#c9b4e8')}
      {paw(16.4, 11.6, 0.5, '#ffffff')}
    </>
  ),
  team: (
    <>
      {paw(6.5, 15, 0.62, '#f4c98f')}
      {paw(12, 9, 0.62, '#c9a27a')}
      {paw(17.5, 15, 0.62, '#f29b4b')}
    </>
  ),
  home: (
    <>
      {P('M4 11 L7 4.5 L9.5 8 L12 6 L14.5 8 L17 4.5 L20 11 V20 H4 Z', '#ff9f43')}
      {P('M10 20v-5h4v5', '#fff4dc')}
    </>
  ),
  replay: (
    <>
      {LINE('M19 12a7 7 0 1 1-2.1-5', L, 2.2)}
      {P('M14 4.5h4.6V9z', L)}
    </>
  ),
  next: P('M7 4.5 19 12 7 19.5z', '#ffffff'),
  play: P('M7 4.5 19 12 7 19.5z', '#ffffff'),
  pause: (
    <>
      {P('M6.5 5h4v14h-4z', '#ffffff')}
      {P('M13.5 5h4v14h-4z', '#ffffff')}
    </>
  ),
  list: (
    <>
      {LINE('M8 7h12 M8 12h12 M8 17h12', L, 2)}
      {C(4.5, 7, 1.2, L)}
      {C(4.5, 12, 1.2, L)}
      {C(4.5, 17, 1.2, L)}
    </>
  ),
  lock: (
    <>
      {LINE('M8 10V7.5a4 4 0 0 1 8 0V10', L, 2)}
      {P('M5.5 10h13v10h-13z', '#d9ad72')}
    </>
  ),
  star: P('M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z', '#ffd040'),
  heart: P('M12 20C4 14 3 9 6 6.5c2.4-2 5-1 6 1 1-2 3.6-3 6-1 3 2.5 2 7.5-6 13.5z', '#ff6b7a'),
  trophy: (
    <>
      {P('M7 4h10v5a5 5 0 0 1-10 0z', '#ffd040')}
      {LINE('M7 6H4.5a3 3 0 0 0 3 4 M17 6h2.5a3 3 0 0 1-3 4')}
      {P('M10 14h4v3h-4z', '#e0a020')}
      {P('M7.5 17h9v3h-9z', '#c08a10')}
    </>
  ),
  gift: (
    <>
      {P('M4 9h16v4H4z', '#ff8fb8')}
      {P('M5.5 13h13v7h-13z', '#ffb3d1')}
      {LINE('M12 9v11')}
      {P('M12 9c-2-4-6-4-5.5-1.5S10 9 12 9c2 0 5 .6 5.5-1.5S14 5 12 9z', '#ffd040')}
    </>
  ),
  damage: (
    <>
      {LINE('M5 19 L17 7', '#9aa0b0', 3)}
      {P('M15 4l5 5-2.5 1-3.5-3.5z', '#c8ccd8')}
      {LINE('M6 14l4 4', '#8a5a32', 2.4)}
    </>
  ),
  speed: P('M13 2 4 14h7l-2 8 10-13h-7l1-7z', '#ffd040'),
  range: (
    <>
      {C(12, 12, 8, '#ffffff')}
      {C(12, 12, 4.5, '#ff8f8f')}
      {C(12, 12, 1.6, '#ffffff')}
    </>
  ),
  charm: P('M12 20C4 14 3 9 6 6.5c2.4-2 5-1 6 1 1-2 3.6-3 6-1 3 2.5 2 7.5-6 13.5z', '#ff8fb8'),
  sun: (
    <>
      {LINE('M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1 7 17 M17 7l2.1-2.1', '#f0a030', 2)}
      {C(12, 12, 4.6, '#ffd040')}
    </>
  ),
  moon: P('M15.5 3.5A8.5 8.5 0 1 0 20.5 15 7 7 0 0 1 15.5 3.5z', '#f5e9d5'),
  tap: (
    <>
      {P('M9.5 4a1.9 1.9 0 0 1 3.8 0v6.6l4.4 1a2.1 2.1 0 0 1 1.6 2.3l-.7 5A3 3 0 0 1 15.6 21.5h-4.4a3 3 0 0 1-2.4-1.2l-3.6-4.8a1.7 1.7 0 0 1 2.6-2.2l1.7 1.8z', '#fff1e0')}
    </>
  ),
  flag: (
    <>
      {LINE('M6 21V3', L, 2)}
      {P('M6 4h11l-2.5 4 2.5 4H6z', '#ff8f6a')}
    </>
  ),
};

export function GameIcon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`game-icon ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
