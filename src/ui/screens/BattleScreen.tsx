import { useCallback, useEffect, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { findStage } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { SKILLS, SKILL_ORDER } from '../../config/skills';
import { Battle, type BattleEvent } from '../../game/battle';
import { nextStageId } from '../../game/progression';
import type { SkillId } from '../../game/types';
import { Renderer, type DragView } from '../../render/renderer';
import { saveStore, useSave } from '../../save/store';
import { CoinIcon, FishIcon, HeartIcon } from '../components/Icons';
import { RewardModal } from '../components/RewardModal';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'good';
}

interface Hud {
  fish: number;
  baseHp: number;
  maxHp: number;
  wave: number;
  totalWaves: number;
  status: Battle['status'];
  summonCost: number;
  skillCost: number;
  boardFull: boolean;
  skillsMaxed: boolean;
  skills: [SkillId, number][];
  rewardKey: number;
}

interface Result {
  victory: boolean;
  stars: number;
  coins: number;
  chestCoins: number;
  firstClear: boolean;
  chapterComplete: boolean;
}

function hudOf(b: Battle): Hud {
  return {
    fish: b.fish,
    baseHp: b.baseHp,
    maxHp: b.maxBaseHp,
    wave: Math.max(0, b.waveIndex + 1),
    totalWaves: b.totalWaves,
    status: b.status,
    summonCost: b.summonCost,
    skillCost: b.skillCost,
    boardFull: b.emptyTiles().length === 0,
    skillsMaxed: b.availableSkills().length === 0,
    skills: SKILL_ORDER.filter((id) => (b.skills[id] ?? 0) > 0).map((id) => [id, b.skills[id]!]),
    rewardKey: b.rewardQueue.length ? b.rewardQueue.length * 1000 + Math.round(b.time * 10) : 0,
  };
}

let toastId = 1;

export function BattleScreen({
  stageId,
  onExit,
  onPlay,
}: {
  stageId: string;
  onExit: () => void;
  onPlay: (id: string) => void;
}) {
  const found = findStage(stageId)!;
  const { stage, chapter } = found;
  const map = MAPS[chapter.mapId];
  const save = useSave();
  const loadoutRef = useRef(save.equipped);
  loadoutRef.current = save.equipped;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const battleRef = useRef<Battle>(null as unknown as Battle);
  if (!battleRef.current) battleRef.current = new Battle(stage, map);
  const speedRef = useRef(1);
  const dragRef = useRef<DragView | null>(null);
  const pressRef = useRef<{ uid: number; pointerId: number; sx: number; sy: number; dragging: boolean } | null>(null);
  const resultLoggedRef = useRef<Battle | null>(null);

  const [hud, setHud] = useState<Hud>(() => hudOf(battleRef.current));
  const hudKeyRef = useRef('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [waveBanner, setWaveBanner] = useState<{ text: string; key: number } | null>(null);
  const [introKey, setIntroKey] = useState(1);
  const [showIntro, setShowIntro] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [speed, setSpeed] = useState(1);
  const [shake, setShake] = useState<'summon' | 'skill' | null>(null);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1900);
  }, []);

  // ---- Battle events → UI / persistence ----
  const handleEvents = useCallback(
    (events: BattleEvent[]) => {
      const b = battleRef.current;
      for (const e of events) {
        switch (e.type) {
          case 'toast':
            toast(e.text, e.tone);
            break;
          case 'coins':
            saveStore.addCoins(e.amount); // chest coins are kept even if the stage is lost
            break;
          case 'skill': {
            const def = SKILLS[e.skillId];
            toast(e.isNew ? `${def.icon} New skill: ${def.name}!` : `${def.icon} ${def.name} → Lv.${e.level}`, 'good');
            break;
          }
          case 'wave':
            setWaveBanner({ text: e.wave === e.total ? `Final wave!` : `Wave ${e.wave} / ${e.total}`, key: Date.now() });
            break;
          case 'victory':
          case 'defeat': {
            if (resultLoggedRef.current === b) break;
            resultLoggedRef.current = b;
            if (e.type === 'victory') {
              const r = saveStore.completeStage(stage.id, b.baseHp, b.maxBaseHp);
              setResult({
                victory: true,
                stars: r.stars,
                coins: r.coins,
                chestCoins: b.chestCoins,
                firstClear: r.firstClear,
                chapterComplete: !!stage.isBoss && found.index === chapter.stages.length - 1,
              });
            } else {
              setResult({ victory: false, stars: 0, coins: 0, chestCoins: b.chestCoins, firstClear: false, chapterComplete: false });
            }
            break;
          }
        }
      }
    },
    [toast, stage, chapter, found.index],
  );

  // Stage intro card: auto-hides, tap to dismiss early
  useEffect(() => {
    setShowIntro(true);
    const t = window.setTimeout(() => setShowIntro(false), 5200);
    return () => window.clearTimeout(t);
  }, [introKey]);

  const handleEventsRef = useRef(handleEvents);
  handleEventsRef.current = handleEvents;

  // ---- Single render/simulation loop for the lifetime of this screen ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const field = fieldRef.current!;
    const renderer = new Renderer(canvas, map);
    rendererRef.current = renderer;
    const fit = () => renderer.resize(field.clientWidth, field.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(field);

    let raf = 0;
    let last = performance.now();
    let alive = true;
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const b = battleRef.current;
      b.update(dt * speedRef.current);
      if (import.meta.env.DEV) (window as unknown as { __cd: unknown }).__cd = { battle: b, renderer };
      const ev = b.drainEvents();
      if (ev.length) handleEventsRef.current(ev);
      renderer.draw(b, dragRef.current, loadoutRef.current);
      const h = hudOf(b);
      const key = JSON.stringify(h);
      if (key !== hudKeyRef.current) {
        hudKeyRef.current = key;
        setHud(h);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.hidden) battleRef.current.pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [map]);

  // ---- Actions ----
  const restart = () => {
    battleRef.current = new Battle(stage, map);
    dragRef.current = null;
    pressRef.current = null;
    setResult(null);
    setToasts([]);
    setWaveBanner(null);
    setIntroKey((k) => k + 1);
  };

  const bump = (which: 'summon' | 'skill') => {
    setShake(which);
    window.setTimeout(() => setShake(null), 350);
  };

  const onSummon = () => {
    const r = battleRef.current.summon();
    if (!r.ok) {
      toast(r.reason, 'warn');
      bump('summon');
    }
  };
  const onSkill = () => {
    const r = battleRef.current.buySkill();
    if (!r.ok) {
      toast(r.reason, 'warn');
      bump('skill');
    }
  };
  const togglePause = () => {
    const b = battleRef.current;
    if (b.status === 'playing') b.pause();
    else if (b.status === 'paused') b.resume();
  };
  const toggleSpeed = () => {
    const s = speedRef.current === 1 ? 2 : 1;
    speedRef.current = s;
    setSpeed(s);
  };

  // ---- Pointer input: tap = cycle target, drag = move / merge ----
  const tileAtWorld = (x: number, y: number): string | null => {
    const b = battleRef.current;
    const half = map.cell / 2;
    const t = b.tiles.find((t) => Math.abs(t.x - x) <= half && Math.abs(t.y - y) <= half);
    return t ? t.id : null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const b = battleRef.current;
    const r = rendererRef.current;
    if (!r || pressRef.current) return;
    if (b.status !== 'playing' && b.status !== 'paused') return;
    const w = r.toWorld(e.clientX, e.clientY);
    const tileId = tileAtWorld(w.x, w.y);
    const cat = tileId ? b.catAt(tileId) : undefined;
    if (!cat) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pressRef.current = { uid: cat.uid, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, dragging: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pressRef.current;
    const r = rendererRef.current;
    if (!p || !r || p.pointerId !== e.pointerId) return;
    if (!p.dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > BALANCE.dragThresholdPx) p.dragging = true;
    if (p.dragging) {
      const w = r.toWorld(e.clientX, e.clientY);
      dragRef.current = { uid: p.uid, x: w.x, y: w.y, overTileId: tileAtWorld(w.x, w.y) };
    }
  };

  const endPress = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const p = pressRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    pressRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (cancelled) return;
    const b = battleRef.current;
    if (p.dragging) {
      const res = b.dropCat(p.uid, drag?.overTileId ?? null);
      if (res.result === 'cancel' && res.reason) toast(res.reason, 'warn');
    } else {
      b.cycleTarget(p.uid);
    }
  };

  // ---- Render ----
  const b = battleRef.current;
  const offer = hud.status === 'reward' ? b.currentReward : null;
  const next = nextStageId(stage.id);
  const hpPct = hud.baseHp / hud.maxHp;

  return (
    <div className="screen battle">
      {/* Top HUD */}
      <div className="hud">
        <div className={`hud-pill hp ${hpPct <= 0.3 ? 'danger' : ''}`}>
          <HeartIcon size={18} /> {hud.baseHp}
        </div>
        <div className="hud-center">
          <div className="hud-stage">Stage {stage.id}</div>
          <div className="hud-wave">{hud.wave === 0 ? 'Get ready' : `Wave ${hud.wave}/${hud.totalWaves}`}</div>
        </div>
        <div className="hud-pill fish">
          <FishIcon size={20} /> {hud.fish}
        </div>
        <button className="hud-btn" onClick={toggleSpeed} aria-label="Game speed">
          {speed}×
        </button>
        <button className="hud-btn" onClick={togglePause} aria-label="Pause">
          {hud.status === 'paused' ? '▶' : 'Ⅱ'}
        </button>
      </div>

      {/* Battlefield */}
      <div className="field" ref={fieldRef}>
        <canvas
          ref={canvasRef}
          className="field-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endPress(e, false)}
          onPointerCancel={(e) => endPress(e, true)}
          onContextMenu={(e) => e.preventDefault()}
        />
        {showIntro && (
        <div key={introKey} className="intro-card" onClick={() => setShowIntro(false)}>
          <div className="intro-title">
            {stage.number}. {stage.name}
          </div>
          {stage.intro.map((l) => (
            <div key={l} className="intro-line">
              {l}
            </div>
          ))}
        </div>
        )}
        {waveBanner && (
          <div key={waveBanner.key} className="wave-banner">
            {waveBanner.text}
          </div>
        )}
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.tone}`}>
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="controls">
        <div className="skill-row">
          {hud.skills.length === 0 ? (
            <span className="muted tiny light">No skills yet — buy one or break a chest!</span>
          ) : (
            hud.skills.map(([id, lv]) => (
              <button
                key={id}
                className="skill-chip"
                onClick={() => toast(`${SKILLS[id].icon} ${SKILLS[id].name} Lv.${lv}: ${SKILLS[id].describe(lv)}`)}
              >
                <span>{SKILLS[id].icon}</span>
                <b>{lv}</b>
              </button>
            ))
          )}
        </div>
        <div className="action-row">
          <button
            className={`action-btn summon ${hud.fish < hud.summonCost || hud.boardFull ? 'disabled' : ''} ${shake === 'summon' ? 'shake' : ''}`}
            onClick={onSummon}
          >
            <span className="action-label">{hud.boardFull ? 'Board full' : 'Summon Cat'}</span>
            <span className="action-cost">
              <FishIcon size={18} /> {hud.summonCost}
            </span>
          </button>
          <button
            className={`action-btn skill ${hud.fish < hud.skillCost || hud.skillsMaxed ? 'disabled' : ''} ${shake === 'skill' ? 'shake' : ''}`}
            onClick={onSkill}
          >
            <span className="action-label">{hud.skillsMaxed ? 'Skills maxed' : 'Random Skill'}</span>
            <span className="action-cost">
              <FishIcon size={18} /> {hud.skillCost}
            </span>
          </button>
        </div>
      </div>

      {/* Overlays */}
      {offer && (
        <RewardModal
          key={hud.rewardKey}
          offer={offer}
          owned={b.skills}
          onChoose={(i) => {
            battleRef.current.chooseReward(i);
          }}
        />
      )}

      {hud.status === 'paused' && !result && (
        <div className="overlay">
          <div className="panel">
            <h2>Paused</h2>
            <button className="btn btn-primary" onClick={togglePause}>
              ▶ Resume
            </button>
            <button className="btn btn-secondary" onClick={restart}>
              ↻ Restart stage
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              ☰ Stage select
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`overlay result ${result.victory ? 'win' : 'lose'}`}>
          {result.victory && <Confetti />}
          <div className="panel">
            {result.chapterComplete ? (
              <>
                <div className="result-emoji">🏆</div>
                <h2>Chapter Complete!</h2>
                <p className="small">The Big Cheese King is defeated and the Beginner Forest is safe. Your cats are napping proudly.</p>
              </>
            ) : result.victory ? (
              <>
                <div className="result-emoji">🎉</div>
                <h2>Victory!</h2>
              </>
            ) : (
              <>
                <div className="result-emoji">🙀</div>
                <h2>The mice got through…</h2>
                <p className="small">Try merging earlier, moving cats to cover more road, or using different targeting.</p>
              </>
            )}
            {result.victory && (
              <div className="big-stars">
                {[1, 2, 3].map((k) => (
                  <span key={k} className={k <= result.stars ? 'on' : ''} style={{ animationDelay: `${k * 150}ms` }}>
                    ★
                  </span>
                ))}
              </div>
            )}
            <div className="result-rewards">
              {result.victory && (
                <div>
                  <CoinIcon size={20} /> +{result.coins} {result.firstClear ? 'first clear!' : 'stage reward'}
                </div>
              )}
              {result.chestCoins > 0 && (
                <div>
                  <CoinIcon size={20} /> +{result.chestCoins} from chests
                </div>
              )}
              <div className="muted small">Total fish coins: {save.fishCoins}</div>
            </div>
            {result.victory && next && (
              <button className="btn btn-primary" onClick={() => onPlay(next)}>
                Next stage ▶
              </button>
            )}
            <button className={`btn ${result.victory ? 'btn-secondary' : 'btn-primary'}`} onClick={restart}>
              ↻ {result.victory ? 'Replay' : 'Retry'}
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              ☰ Stage select
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => i);
  const colors = ['#ff9f43', '#ffd84a', '#ff8fb8', '#6ac0f0', '#7cd07a'];
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 12) * 0.08}s`,
            animationDuration: `${1.6 + (i % 5) * 0.25}s`,
          }}
        />
      ))}
    </div>
  );
}
