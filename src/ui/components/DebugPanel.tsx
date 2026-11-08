import type { Tuning } from '../../config/debug';
import type { BattleStats } from '../../game/battle';
import { debugStore, useDebug } from '../debugStore';

// Developer-only balancing panel (English only, never shown to normal players).

const FIELDS: { key: keyof Tuning; label: string; min: number; max: number; step: number }[] = [
  { key: 'summonCostMult', label: 'Summon cost ×', min: 0.25, max: 3, step: 0.05 },
  { key: 'enemyHpMult', label: 'Enemy HP ×', min: 0.25, max: 4, step: 0.05 },
  { key: 'enemySpeedMult', label: 'Enemy speed ×', min: 0.5, max: 2, step: 0.05 },
  { key: 'enemyCountMult', label: 'Enemies per wave ×', min: 0.25, max: 3, step: 0.05 },
  { key: 'waveIntervalMult', label: 'Wave/spawn interval ×', min: 0.25, max: 3, step: 0.05 },
  { key: 'catDamageMult', label: 'Cat damage ×', min: 0.25, max: 4, step: 0.05 },
];

export function DebugPanel({
  speed,
  onSpeed,
  onRestart,
  onClose,
  extraFish,
}: {
  speed: number;
  onSpeed: (s: number) => void;
  onRestart: () => void;
  onClose: () => void;
  extraFish: (n: number) => void;
}) {
  const { tuning } = useDebug();
  return (
    <div className="debug-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="debug-head">
        <b>🛠 Balance debug</b>
        <button onClick={onClose}>✕</button>
      </div>
      <label className="debug-row">
        <span>Start fish (blank = stage)</span>
        <input
          type="number"
          min={0}
          value={tuning.startFish ?? ''}
          onChange={(e) => debugStore.setTuning({ startFish: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
        />
      </label>
      {FIELDS.map((f) => (
        <label key={f.key} className="debug-row">
          <span>
            {f.label} <b>{(tuning[f.key] as number).toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={tuning[f.key] as number}
            onChange={(e) => debugStore.setTuning({ [f.key]: Number(e.target.value) } as Partial<Tuning>)}
          />
        </label>
      ))}
      <div className="debug-row">
        <span>Game speed</span>
        <div className="debug-btns">
          {[0.5, 1, 2, 4, 8].map((s) => (
            <button key={s} className={s === speed ? 'on' : ''} onClick={() => onSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="debug-btns wide">
        <button onClick={() => extraFish(50)}>+50 fish</button>
        <button onClick={() => debugStore.resetTuning()}>Reset</button>
        <button className="on" onClick={onRestart}>
          Apply &amp; restart
        </button>
      </div>
      <p className="debug-note">Tuning applies to new battles (Apply &amp; restart).</p>
    </div>
  );
}

export function StatsTable({ stats, baseHp, maxHp, duration }: { stats: BattleStats; baseHp: number; maxHp: number; duration: number }) {
  const m = Math.floor(duration / 60);
  const s = Math.round(duration % 60);
  const rows: [string, string | number][] = [
    ['Duration', `${m}:${String(s).padStart(2, '0')}`],
    ['Base HP left', `${baseHp}/${maxHp}`],
    ['Cats summoned', stats.summons],
    ['Merges', stats.merges],
    ['Moves / swaps', `${stats.moves} / ${stats.swaps}`],
    ['Target changes', stats.targetChanges],
    ['Skills (shop / chest)', `${stats.skillsBought} / ${stats.skillsFromChests}`],
    ['Fish earned / spent', `${stats.fishEarned} / ${stats.fishSpent}`],
    ['Enemies defeated / escaped', `${stats.kills} / ${stats.escaped}`],
    ['Chests opened / missed', `${stats.chestsOpened} / ${stats.chestsMissed}`],
  ];
  return (
    <table className="stats-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
