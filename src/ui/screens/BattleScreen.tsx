import { useCallback, useEffect, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { findStage } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { SKILLS, SKILL_ORDER, skillParams } from '../../config/skills';
import { Battle, type BattleEvent, type BattleStats } from '../../game/battle';
import { nextStageId } from '../../game/progression';
import type { SkillId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { Renderer, type DragView } from '../../render/renderer';
import { saveStore, useSave } from '../../save/store';
import { TutorialDirector, type ActiveStep, type TutAction } from '../../tutorial/director';
import { CatPreview } from '../components/CatPreview';
import { DebugPanel, StatsTable } from '../components/DebugPanel';
import { CoinIcon, FishIcon, HeartIcon } from '../components/Icons';
import { RewardModal } from '../components/RewardModal';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { debugStore, useDebug } from '../debugStore';

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
  frozen: boolean;
  summonCost: number;
  skillCost: number;
  skillUnlocked: boolean;
  boardFull: boolean;
  skillsMaxed: boolean;
  skills: [SkillId, number][];
  rewardId: number;
}

interface Result {
  victory: boolean;
  stars: number;
  coins: number;
  chestCoins: number;
  firstClear: boolean;
  chapterComplete: boolean;
  baseHp: number;
  maxHp: number;
  stats: BattleStats;
  duration: number;
}

function hudOf(b: Battle): Hud {
  return {
    fish: b.fish,
    baseHp: b.baseHp,
    maxHp: b.maxBaseHp,
    wave: Math.max(0, b.waveIndex + 1),
    totalWaves: b.totalWaves,
    status: b.status,
    frozen: b.frozen,
    summonCost: b.summonCost,
    skillCost: b.skillCost,
    skillUnlocked: b.skillShopUnlocked,
    boardFull: b.emptyTiles().length === 0,
    skillsMaxed: b.availableSkills().length === 0,
    skills: SKILL_ORDER.filter((id) => (b.skills[id] ?? 0) > 0).map((id) => [id, b.skills[id]!]),
    rewardId: b.currentReward?.id ?? 0,
  };
}

const seenStore = { has: (id: string) => saveStore.hasSeen(id), mark: (id: string) => saveStore.markSeen(id) };
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
  useLang();
  const found = findStage(stageId)!;
  const { stage, chapter } = found;
  const map = MAPS[chapter.mapId];
  const save = useSave();
  const debug = useDebug();
  const loadoutRef = useRef(save.equipped);
  loadoutRef.current = save.equipped;

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const summonRef = useRef<HTMLButtonElement>(null);
  const skillRef = useRef<HTMLButtonElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const newBattle = () => new Battle(stage, map, { tuning: debugStore.get().enabled ? debugStore.get().tuning : undefined });
  const battleRef = useRef<Battle>(null as unknown as Battle);
  if (!battleRef.current) battleRef.current = newBattle();
  const directorRef = useRef<TutorialDirector>(null as unknown as TutorialDirector);
  if (!directorRef.current) directorRef.current = new TutorialDirector(stage.id, seenStore);
  const speedRef = useRef(1);
  const dragRef = useRef<DragView | null>(null);
  const pressRef = useRef<{ uid: number; pointerId: number; sx: number; sy: number; dragging: boolean } | null>(null);
  const resultLoggedRef = useRef<Battle | null>(null);

  const [hud, setHud] = useState<Hud>(() => hudOf(battleRef.current));
  const hudKeyRef = useRef('');
  const [step, setStep] = useState<ActiveStep | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [banner, setBanner] = useState<{ text: string; sub?: string; tone: 'wave' | 'final' | 'stage'; key: number } | null>(null);
  const [skillPop, setSkillPop] = useState<{ id: SkillId; level: number; isNew: boolean; key: number } | null>(null);
  const [costBump, setCostBump] = useState<{ n: number; key: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [speed, setSpeed] = useState(1);
  const [shake, setShake] = useState<'summon' | 'skill' | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = toastId++;
    setToasts((ts) => [...ts.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 2000);
  }, []);

  const showStageBanner = useCallback(() => {
    setBanner({ text: t('battle.stageBanner', { id: stage.id, name: t(`stage.${stage.id}`) }), tone: 'stage', key: Date.now() });
  }, [stage.id]);
  useEffect(showStageBanner, [showStageBanner]);

  // ---- Battle events → UI / persistence ----
  const handleEvents = useCallback(
    (events: BattleEvent[]) => {
      const b = battleRef.current;
      for (const e of events) {
        switch (e.type) {
          case 'coins':
            saveStore.addCoins(e.amount); // chest coins are kept even if the stage is lost
            toast(t('battle.chestCoins', { n: e.amount }), 'good');
            break;
          case 'skill':
            setSkillPop({ id: e.skillId, level: e.level, isNew: e.isNew, key: Date.now() });
            break;
          case 'wave':
            setBanner(
              e.wave === e.total
                ? { text: t('battle.finalWave'), tone: 'final', key: Date.now() }
                : { text: t('battle.waveBanner', { n: e.wave }), sub: `${e.wave} / ${e.total}`, tone: 'wave', key: Date.now() },
            );
            break;
          case 'waveCleared':
            toast(t('battle.waveCleared', { n: e.wave, bonus: e.bonus }), 'good');
            break;
          case 'chestAppeared':
            toast(t('battle.chestAppeared', { chest: t(`chest.${e.tier}.name`) }), 'good');
            break;
          case 'chestEscaped':
            toast(t('battle.chestEscaped'), 'warn');
            break;
          case 'bossAppeared':
            toast(t('battle.bossAppeared', { boss: t('enemy.boss.name') }), 'warn');
            break;
          case 'bossDefeated':
            toast(t('battle.bossDefeated', { boss: t('enemy.boss.name') }), 'good');
            break;
          case 'maxedChestFish':
            toast(t('battle.maxedChestFish', { n: e.fish }), 'good');
            break;
          case 'victory':
          case 'defeat': {
            if (resultLoggedRef.current === b) break;
            resultLoggedRef.current = b;
            const common = { chestCoins: b.chestCoins, baseHp: b.baseHp, maxHp: b.maxBaseHp, stats: { ...b.stats }, duration: b.time };
            if (e.type === 'victory') {
              const r = saveStore.completeStage(stage.id, b.baseHp, b.maxBaseHp);
              setResult({
                ...common,
                victory: true,
                stars: r.stars,
                coins: r.coins,
                firstClear: r.firstClear,
                chapterComplete: !!stage.isBoss && found.index === chapter.stages.length - 1,
              });
            } else {
              setResult({ ...common, victory: false, stars: 0, coins: 0, firstClear: false, chapterComplete: false });
            }
            break;
          }
        }
      }
    },
    [toast, stage, chapter, found.index],
  );
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
    let stepKey = -1;
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const b = battleRef.current;
      const active = directorRef.current.update(b); // freezes the battle while a lesson is shown
      if (b.running) b.update(dt * speedRef.current);
      else b.tickVisual(dt);
      if (import.meta.env.DEV) (window as unknown as { __cd: unknown }).__cd = { battle: b, renderer, director: directorRef.current };
      const ev = b.drainEvents();
      if (ev.length) handleEventsRef.current(ev);
      const focusUids = active ? active.focus.flatMap((f) => (f.kind === 'cat' ? [f.uid] : [])) : undefined;
      renderer.draw(b, dragRef.current, loadoutRef.current, { focusUids });
      const k = active?.key ?? 0;
      if (k !== stepKey) {
        stepKey = k;
        setStep(active);
      }
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

  // Summon cost feedback: show "+N" when the price goes up.
  const prevCost = useRef(hud.summonCost);
  useEffect(() => {
    if (hud.summonCost > prevCost.current) setCostBump({ n: hud.summonCost - prevCost.current, key: Date.now() });
    prevCost.current = hud.summonCost;
  }, [hud.summonCost]);

  // ---- Actions ----
  const restart = () => {
    battleRef.current = newBattle();
    directorRef.current = new TutorialDirector(stage.id, seenStore);
    dragRef.current = null;
    pressRef.current = null;
    resultLoggedRef.current = null;
    prevCost.current = battleRef.current.summonCost;
    setResult(null);
    setToasts([]);
    setSkillPop(null);
    setCostBump(null);
    showStageBanner();
  };

  const bump = (which: 'summon' | 'skill') => {
    setShake(which);
    window.setTimeout(() => setShake(null), 350);
  };

  const gate = (action: TutAction): boolean => {
    const d = directorRef.current;
    if (d.allows(action)) return true;
    if (d.active?.hintKey) toast(t(d.active.hintKey), 'info');
    return false;
  };

  const errText = (reason: string) => t(`err.${reason}`, { n: BALANCE.unlocks.skillShopFromStage });

  const onSummon = () => {
    if (!gate('summon')) return;
    const b = battleRef.current;
    const r = b.summon();
    if (!r.ok) {
      toast(errText(r.reason), 'warn');
      bump('summon');
    } else directorRef.current.onAction('summon', b);
  };
  const onSkill = () => {
    if (!gate('skill')) return;
    const b = battleRef.current;
    const r = b.buySkill();
    if (!r.ok) {
      toast(errText(r.reason), 'warn');
      bump('skill');
    } else directorRef.current.onAction('skill', b);
  };
  const togglePause = () => {
    const b = battleRef.current;
    if (b.status === 'playing') b.pause();
    else if (b.status === 'paused') b.resume();
  };
  const setGameSpeed = (s: number) => {
    speedRef.current = s;
    setSpeed(s);
  };
  const toggleSpeed = () => setGameSpeed(speedRef.current === 1 ? 2 : 1);

  // ---- Pointer input: tap = cycle target, drag = move / swap / merge ----
  const tileAtWorld = (x: number, y: number): string | null => {
    const b = battleRef.current;
    const half = map.cell / 2;
    const tile = b.tiles.find((tl) => Math.abs(tl.x - x) <= half && Math.abs(tl.y - y) <= half);
    return tile ? tile.id : null;
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
    const d = directorRef.current;
    if (p.dragging) {
      const target = drag?.overTileId ?? null;
      const preview = b.previewDrop(p.uid, target);
      if (preview.result === 'cancel') {
        if (preview.reason) toast(errText(preview.reason), 'warn');
        return;
      }
      if (!gate(preview.result)) return;
      const res = b.dropCat(p.uid, target);
      if (res.result !== 'cancel') d.onAction(res.result, b);
    } else {
      if (!gate('tap')) return;
      if (b.cycleTarget(p.uid)) d.onAction('tap', b);
    }
  };

  // ---- Render ----
  const b = battleRef.current;
  const offer = hud.status === 'reward' ? b.currentReward : null;
  const next = nextStageId(stage.id);
  const hpPct = hud.baseHp / hud.maxHp;
  const skillDisabled = !hud.skillUnlocked || hud.fish < hud.skillCost || hud.skillsMaxed;

  return (
    <div className="screen battle" ref={rootRef}>
      {/* Top HUD */}
      <div className="hud">
        <div className={`hud-pill hp ${hpPct <= 0.3 ? 'danger' : ''}`}>
          <HeartIcon size={18} /> {hud.baseHp}
        </div>
        <div className="hud-center">
          <div className="hud-stage">
            {t('battle.stage', { id: stage.id })} · {t(`stage.${stage.id}`)}
          </div>
          <div className="hud-wave">{hud.wave === 0 ? t('battle.getReady') : t('battle.wave', { n: hud.wave, total: hud.totalWaves })}</div>
          <div className="wave-progress">
            <div style={{ width: `${(hud.wave / hud.totalWaves) * 100}%` }} />
          </div>
        </div>
        <div className="hud-pill fish" title={t('currency.fish')}>
          <FishIcon size={20} /> <span key={hud.fish} className="fish-num">{hud.fish}</span>
        </div>
        <button className="hud-btn" onClick={toggleSpeed} aria-label="speed">
          {speed}×
        </button>
        <button className="hud-btn" onClick={togglePause} aria-label="pause">
          {hud.status === 'paused' ? '▶' : 'Ⅱ'}
        </button>
        {debug.enabled && (
          <button className="hud-btn" onClick={() => setShowDebug((v) => !v)} aria-label="debug">
            🛠
          </button>
        )}
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
        {banner && !step && (
          <div key={banner.key} className={`wave-banner ${banner.tone}`}>
            <span>{banner.text}</span>
          </div>
        )}
        {skillPop && (
          <div key={skillPop.key} className="skill-pop">
            <span className="skill-pop-icon">{SKILLS[skillPop.id].icon}</span>
            <span className="skill-pop-name">
              {skillPop.isNew
                ? t('battle.newSkill', { name: t(`skill.${skillPop.id}.name`) })
                : t('battle.skillUp', { name: t(`skill.${skillPop.id}.name`), n: skillPop.level })}
            </span>
          </div>
        )}
        <div className="toasts">
          {toasts.map((x) => (
            <div key={x.id} className={`toast ${x.tone}`}>
              {x.text}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="controls">
        <div className="skill-row">
          {hud.skills.length === 0 ? (
            <span className="muted tiny">{hud.skillUnlocked ? t('battle.noSkillsShop') : t('battle.noSkills')}</span>
          ) : (
            hud.skills.map(([id, lv]) => (
              <button
                key={id}
                className={`skill-chip ${skillPop?.id === id ? 'flash' : ''}`}
                onClick={() => toast(`${SKILLS[id].icon} ${t(`skill.${id}.name`)} Lv.${lv}: ${t(`skill.${id}.desc`, skillParams(id, lv))}`)}
              >
                <span>{SKILLS[id].icon}</span>
                <b key={lv}>{lv}</b>
              </button>
            ))
          )}
        </div>
        <div className="action-row">
          <button
            ref={summonRef}
            className={`action-btn summon ${hud.fish < hud.summonCost || hud.boardFull ? 'disabled' : ''} ${shake === 'summon' ? 'shake' : ''}`}
            onClick={onSummon}
          >
            <span className="action-label">{hud.boardFull ? t('battle.boardFull') : t('battle.summon')}</span>
            <span className="action-cost">
              <FishIcon size={18} /> <span key={hud.summonCost} className="cost-num">{hud.summonCost}</span>
              {costBump && (
                <span key={costBump.key} className="cost-bump">
                  {t('battle.costUp', { n: costBump.n })}
                </span>
              )}
            </span>
          </button>
          <button
            ref={skillRef}
            className={`action-btn skill ${skillDisabled ? 'disabled' : ''} ${!hud.skillUnlocked ? 'locked' : ''} ${shake === 'skill' ? 'shake' : ''}`}
            onClick={onSkill}
          >
            <span className="action-label">
              {!hud.skillUnlocked ? '🔒 ' : ''}
              {hud.skillsMaxed ? t('battle.skillsMaxed') : t('battle.skill')}
            </span>
            <span className="action-cost">
              {hud.skillUnlocked ? (
                <>
                  <FishIcon size={18} /> {hud.skillCost}
                </>
              ) : (
                <span className="tiny">{t('battle.skillLocked', { n: BALANCE.unlocks.skillShopFromStage })}</span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Overlays */}
      {step && hud.status === 'playing' && !result && (
        <TutorialOverlay
          key={step.key}
          step={step}
          battle={b}
          renderer={rendererRef.current}
          appRef={rootRef}
          buttons={{ summon: summonRef, skill: skillRef }}
          loadout={save.equipped}
          onContinue={() => directorRef.current.complete(battleRef.current)}
        />
      )}

      {offer && <RewardModal key={hud.rewardId} offer={offer} owned={b.skills} onChoose={(i) => battleRef.current.chooseReward(i)} />}

      {showDebug && debug.enabled && (
        <DebugPanel
          speed={speed}
          onSpeed={setGameSpeed}
          onRestart={() => {
            setShowDebug(false);
            restart();
          }}
          onClose={() => setShowDebug(false)}
          extraFish={(n) => {
            battleRef.current.fish += n;
          }}
        />
      )}

      {hud.status === 'paused' && !result && (
        <div className="overlay">
          <div className="panel">
            <h2>{t('pause.title')}</h2>
            <button className="btn btn-primary" onClick={togglePause}>
              ▶ {t('pause.resume')}
            </button>
            <button className="btn btn-secondary" onClick={restart}>
              ↻ {t('pause.restart')}
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              ☰ {t('pause.stages')}
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
                <h2>{t('result.chapter')}</h2>
                <p className="small">{t('result.chapterText')}</p>
              </>
            ) : result.victory ? (
              <>
                <div className="victory-cats">
                  {stage.roster.map((c, i) => (
                    <div key={c} className="dance" style={{ animationDelay: `${i * 0.12}s` }}>
                      <CatPreview type={c} level={Math.min(5, 1 + i)} loadout={save.equipped} size={52} />
                    </div>
                  ))}
                </div>
                <h2>{result.baseHp <= 3 ? t('result.close') : t('result.victory')}</h2>
              </>
            ) : (
              <>
                <div className="result-emoji">🙀</div>
                <h2>{t('result.defeat')}</h2>
                <p className="small">{t('result.defeatTip')}</p>
              </>
            )}
            {result.victory && (
              <div className="big-stars">
                {[1, 2, 3].map((k) => (
                  <span key={k} className={k <= result.stars ? 'on' : ''} style={{ animationDelay: `${0.2 + k * 0.25}s` }}>
                    ★
                  </span>
                ))}
              </div>
            )}
            <div className="result-rewards">
              {result.victory && (
                <div className="reward-line">
                  <CoinIcon size={20} /> {result.firstClear ? t('result.firstClear', { n: result.coins }) : t('result.stageReward', { n: result.coins })}
                </div>
              )}
              {result.chestCoins > 0 && (
                <div className="reward-line">
                  <CoinIcon size={20} /> {t('result.fromChests', { n: result.chestCoins })}
                </div>
              )}
              <div className="muted small">{t('result.total', { n: save.fishCoins })}</div>
            </div>
            {debug.enabled && <StatsTable stats={result.stats} baseHp={result.baseHp} maxHp={result.maxHp} duration={result.duration} />}
            {result.victory && next && (
              <button className="btn btn-primary" onClick={() => onPlay(next)}>
                {t('result.next')} ▶
              </button>
            )}
            <button className={`btn ${result.victory ? 'btn-secondary' : 'btn-primary'}`} onClick={restart}>
              ↻ {result.victory ? t('result.replay') : t('result.retry')}
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              ☰ {t('result.stages')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => i);
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
