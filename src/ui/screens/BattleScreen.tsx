import { useCallback, useEffect, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { CATS } from '../../config/cats';
import { findStage } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { SKILLS, SKILL_ORDER, skillParams } from '../../config/skills';
import { Battle, type BattleEvent, type BattleStats } from '../../game/battle';
import { nextStageId } from '../../game/progression';
import type { CatId, SkillId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { Renderer, type DragView } from '../../render/renderer';
import { saveStore, useSave } from '../../save/store';
import { TutorialDirector, type ActiveStep, type TutAction } from '../../tutorial/director';
import { CatInfoPanel } from '../components/CatInfoPanel';
import { GameIcon } from '../components/GameIcon';
import { ResultPanel } from '../components/ResultPanel';
import { SkillOwner } from '../components/SkillOwner';
import { DebugPanel, StatsTable } from '../components/DebugPanel';
import { FishIcon, HeartIcon } from '../components/Icons';
import { ChapterCutscene } from '../components/ChapterCutscene';
import { ChapterReward } from '../components/ChapterReward';
import { RewardModal } from '../components/RewardModal';
import type { ChapterGrant } from '../../game/collection';
import { CatHead } from '../components/CatPreview';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { debugStore, useDebug } from '../debugStore';
import { loadSpeed, saveSpeed } from '../speedPref';

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
  preparing: boolean;
  prepLeft: number;
  /** 5★ ultimates: species → readiness (rounded to 5% so the HUD doesn't re-render every frame). */
  ults: [CatId, number][];
}

interface Result {
  victory: boolean;
  stars: number;
  coins: number;
  chestCoins: number;
  firstClear: boolean;
  chapterComplete: boolean;
  chapterId: string;
  chapterNumber: number;
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
    preparing: b.preparing,
    prepLeft: Math.ceil(b.prepRemaining),
    ults: (Object.keys(b.ultCharge) as CatId[]).map((id) => [id, Math.floor((b.ultReadiness(id) ?? 0) * 20) / 20]),
  };
}

const seenStore = { has: (id: string) => saveStore.hasSeen(id), mark: (id: string) => saveStore.markSeen(id) };
let toastId = 1;
/** Seen-id of the Chapter 1 → 2 story transition. */
export const CUTSCENE_ID = 'story:ch1-ch2';

export function BattleScreen({
  stageId,
  onExit,
  onPlay,
  onHome,
}: {
  stageId: string;
  onExit: () => void;
  onPlay: (id: string) => void;
  onHome: () => void;
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
  const newBattle = () => {
    const sv = saveStore.get();
    return new Battle(stage, map, {
      tuning: debugStore.get().enabled ? debugStore.get().tuning : undefined,
      // Tutorial stages keep their own cats; every other stage summons from the player's team.
      roster: stage.fixedRoster ? undefined : sv.team,
      stars: Object.fromEntries(Object.entries(sv.collection).map(([id, c]) => [id, c!.stars])),
    });
  };
  const battleRef = useRef<Battle>(null as unknown as Battle);
  if (!battleRef.current) battleRef.current = newBattle();
  const directorRef = useRef<TutorialDirector>(null as unknown as TutorialDirector);
  if (!directorRef.current) directorRef.current = new TutorialDirector(stage.id, seenStore);
  /** Speed multiplier relative to the baseline (BALANCE.speed.baseline). */
  const speedRef = useRef<number>(loadSpeed());
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragView | null>(null);
  const pressRef = useRef<{ uid: number; pointerId: number; sx: number; sy: number; dragging: boolean; long: boolean; timer: number | null } | null>(
    null,
  );
  /** Cat whose details panel is open (battle is paused meanwhile). */
  const [inspectUid, setInspectUid] = useState<number | null>(null);
  const inspectRef = useRef<number | null>(null);
  inspectRef.current = inspectUid;
  const resultLoggedRef = useRef<Battle | null>(null);
  const [grants, setGrants] = useState<ChapterGrant[]>([]);
  const [cutscene, setCutscene] = useState(false);

  const [hud, setHud] = useState<Hud>(() => hudOf(battleRef.current));
  const hudKeyRef = useRef('');
  const [step, setStep] = useState<ActiveStep | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [banner, setBanner] = useState<{ text: string; sub?: string; tone: 'wave' | 'final' | 'stage'; key: number } | null>(null);
  const [skillPop, setSkillPop] = useState<{ id: SkillId; level: number; isNew: boolean; key: number } | null>(null);
  const [costBump, setCostBump] = useState<{ n: number; key: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [speed, setSpeed] = useState<number>(speedRef.current);
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
            toast(t('battle.bossAppeared', { boss: t(`enemy.${e.enemy}.name`) }), 'warn');
            break;
          case 'bossDefeated':
            toast(t('battle.bossDefeated', { boss: t(`enemy.${e.enemy}.name`) }), 'good');
            break;
          case 'ultimate':
            toast(t('battle.ultFired', { cat: t(`cat.${e.cat}.name`), name: t(`ability.${e.cat}.ult.name`) }), 'good');
            break;
          case 'maxedChestFish':
            toast(t('battle.maxedChestFish', { n: e.fish }), 'good');
            break;
          case 'victory':
          case 'defeat': {
            if (resultLoggedRef.current === b) break;
            resultLoggedRef.current = b;
            const common = {
              chapterId: chapter.id,
              chapterNumber: chapter.number,
              chestCoins: b.chestCoins,
              baseHp: b.baseHp,
              maxHp: b.maxBaseHp,
              stats: { ...b.stats },
              duration: b.time,
            };
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
              // First clear of Chapter 1: the story transition plays first (once; replayable from
              // Stage Select), then the chapter reward cat is revealed. The reward is claimed
              // right now and saved, so nothing can award it twice.
              if (r.firstClear && chapter.id === 'ch1' && found.index === chapter.stages.length - 1 && !saveStore.hasSeen(CUTSCENE_ID)) setCutscene(true);
              const g = saveStore.claimChapterRewards();
              if (g.length) setGrants(g);
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
      if (b.running && inspectRef.current === null) {
        // Game speed scales the whole simulation (movement, cooldowns, projectiles, spawns, waves, slows).
        b.update(dt * BALANCE.speed.baseline * speedRef.current);
      } else {
        b.tickVisual(dt);
        // Preparation countdown runs in REAL seconds and pauses for lessons, details and pause.
        if (b.preparing && !active && inspectRef.current === null && !document.hidden) b.tickPrep(dt);
      }
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
    setInspectUid(null);
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
    saveSpeed(s);
  };
  /** Cycle 0.5× → 0.75× → 1× → 1.5× → 2× (1× = the faster V1.3 baseline). Remembered between battles. */
  const toggleSpeed = () => {
    if (!directorRef.current.allows('speed')) return;
    const opts = BALANCE.speed.options;
    const i = opts.indexOf(speedRef.current);
    setGameSpeed(opts[(i + 1) % opts.length] ?? BALANCE.speed.default);
    directorRef.current.onAction('speed', battleRef.current);
  };
  const onStartBattle = () => {
    if (directorRef.current.active) return;
    battleRef.current.startBattle(); // idempotent: only the first call starts combat
  };

  // ---- Pointer input: tap = cycle target, drag = move / swap / merge ----
  const tileAtWorld = (x: number, y: number): string | null => {
    const b = battleRef.current;
    const half = map.cell / 2;
    const tile = b.tiles.find((tl) => Math.abs(tl.x - x) <= half && Math.abs(tl.y - y) <= half);
    return tile ? tile.id : null;
  };

  const LONG_PRESS_MS = 500;

  const openInspect = (uid: number) => {
    const b = battleRef.current;
    if (directorRef.current.active) return; // no detail panels in the middle of a lesson
    if (b.status !== 'playing' && b.status !== 'paused') return;
    if (!b.catByUid(uid)) return;
    setInspectUid(uid);
  };

  const clearPressTimer = () => {
    const p = pressRef.current;
    if (p?.timer) window.clearTimeout(p.timer);
    if (p) p.timer = null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const b = battleRef.current;
    const r = rendererRef.current;
    if (!r || pressRef.current || inspectRef.current !== null) return;
    if (e.button === 2) return; // right-click is handled by onContextMenu
    if (b.status !== 'playing' && b.status !== 'paused') return;
    const w = r.toWorld(e.clientX, e.clientY);
    const tileId = tileAtWorld(w.x, w.y);
    const cat = tileId ? b.catAt(tileId) : undefined;
    if (!cat) {
      // Tap-to-focus: tap a mouse or chest (forgiving hit area for fingers) to focus it,
      // tap it again to cancel. Cats that can reach it attack it first.
      if (!directorRef.current.active) {
        let best: { uid: number; d: number } | null = null;
        for (const f of b.foes) {
          if (!f.alive) continue;
          const d = Math.hypot(f.x - w.x, f.y - (w.y + 3));
          if (d <= f.radius + 18 && (!best || d < best.d)) best = { uid: f.uid, d };
        }
        if (best) {
          const was = b.focusUid;
          const now = b.setFocus(best.uid);
          toast(now === null && was !== null ? t('battle.focusClear') : t('battle.focusSet'), 'info');
        }
      }
      return;
    }
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const press = { uid: cat.uid, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, dragging: false, long: false, timer: null as number | null };
    // Long press → details (only if the pointer hasn't started dragging).
    press.timer = window.setTimeout(() => {
      if (pressRef.current !== press || press.dragging) return;
      press.long = true;
      press.timer = null;
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
      openInspect(press.uid);
    }, LONG_PRESS_MS);
    pressRef.current = press;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pressRef.current;
    const r = rendererRef.current;
    if (!p || !r || p.pointerId !== e.pointerId || p.long) return;
    if (!p.dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > BALANCE.dragThresholdPx) {
      p.dragging = true;
      clearPressTimer();
    }
    if (p.dragging) {
      const w = r.toWorld(e.clientX, e.clientY);
      dragRef.current = { uid: p.uid, x: w.x, y: w.y, overTileId: tileAtWorld(w.x, w.y) };
    }
  };

  const endPress = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const p = pressRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    clearPressTimer();
    pressRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (cancelled || p.long) return; // a long press only opens details
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

  /** Desktop: right-click a cat for details. (Also swallows the mobile long-press menu.) */
  const onContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (pressRef.current) return; // touch long-press already handled by the timer
    const r = rendererRef.current;
    if (!r) return;
    const w = r.toWorld(e.clientX, e.clientY);
    const tileId = tileAtWorld(w.x, w.y);
    const cat = tileId ? battleRef.current.catAt(tileId) : undefined;
    if (cat) openInspect(cat.uid);
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
          <div className="hud-wave">{hud.preparing ? t('battle.prepShort') : t('battle.wave', { n: hud.wave, total: hud.totalWaves })}</div>
          <div className="wave-progress">
            <div style={{ width: `${(hud.wave / hud.totalWaves) * 100}%` }} />
          </div>
        </div>
        <div className="hud-pill fish" title={t('currency.fish')}>
          <FishIcon size={20} />{' '}
          <span key={hud.fish} className="fish-num">
            {hud.fish}
          </span>
        </div>
        <button ref={speedBtnRef} className={`hud-btn speed-btn ${speed !== 1 ? 'on' : ''}`} onClick={toggleSpeed} aria-label={t('battle.speed')}>
          {speed}×
        </button>
        <button className="hud-btn" onClick={togglePause} aria-label={t('pause.title')}>
          <GameIcon name={hud.status === 'paused' ? 'play' : 'pause'} size={16} />
        </button>
        {debug.enabled && (
          <button className="hud-btn" onClick={() => setShowDebug((v) => !v)} aria-label="debug">
            🛠
          </button>
        )}
      </div>

      {/* Battlefield */}
      <div className="field" ref={fieldRef}>
        {/* Compact 5★ ultimate readiness: one ring per species (fires automatically). */}
        {hud.ults.length > 0 && (
          <div className="ult-strip" aria-label={t('battle.ult')}>
            {hud.ults.map(([id, r]) => (
              <span key={id} className={`ult-chip ${r >= 1 ? 'ready' : ''}`} style={{ ['--p' as string]: `${Math.round(r * 100)}%` }} title={`${t(`ability.${id}.ult.name`)} · ${r >= 1 ? t('info.ultReady') : t('info.ultCharging', { p: Math.round(r * 100) })}`}>
                <CatHead type={id} loadout={save.equipped} size={22} />
              </span>
            ))}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="field-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endPress(e, false)}
          onPointerCancel={(e) => endPress(e, true)}
          onContextMenu={onContextMenu}
        />
        {banner && !step && (
          <div key={banner.key} className={`wave-banner ${banner.tone}`}>
            <span>{banner.text}</span>
          </div>
        )}
        {skillPop && (
          <div key={skillPop.key} className="skill-pop">
            <span className="skill-pop-icon">
              <GameIcon name={skillPop.id} size={52} />
            </span>
            <span className="skill-pop-name">
              {skillPop.isNew
                ? t('battle.newSkill', { name: t(`skill.${skillPop.id}.name`) })
                : t('battle.skillUp', { name: t(`skill.${skillPop.id}.name`), n: skillPop.level })}
            </span>
            <span className="skill-pop-for">
              <SkillOwner id={skillPop.id} loadout={save.equipped} size={26} label />
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
        {/* Preparation: countdown + Start Battle live below the board so no tile is covered. */}
        {hud.preparing && hud.status === 'playing' && !result ? (
          <div className="prep-bar">
            <div className="prep-timer">
              <span className="prep-label">{t('battle.prep')}</span>
              <span key={hud.prepLeft} className="prep-secs">
                {hud.prepLeft}
              </span>
            </div>
            <button ref={startBtnRef} className="btn btn-primary prep-start" onClick={onStartBattle}>
              <GameIcon name="flag" size={18} /> {t('battle.start')}
            </button>
          </div>
        ) : (
          <div className="skill-row">
            {hud.skills.length === 0 ? (
              <span className="muted tiny">{hud.skillUnlocked ? t('battle.noSkillsShop') : t('battle.noSkills')}</span>
            ) : (
              hud.skills.map(([id, lv]) => (
                <button
                  key={id}
                  className={`skill-chip ${skillPop?.id === id ? 'flash' : ''} ${SKILLS[id].cat ? 'cat' : ''}`}
                  style={SKILLS[id].cat ? { borderColor: CATS[SKILLS[id].cat!].palette.outline } : undefined}
                  onClick={() => toast(`${t(`skill.${id}.name`)} Lv.${lv}: ${t(`skill.${id}.desc`, skillParams(id, lv))}`)}
                >
                  <GameIcon name={id} size={18} />
                  <SkillOwner id={id} loadout={save.equipped} size={16} />
                  <b key={lv}>{lv}</b>
                </button>
              ))
            )}
          </div>
        )}
        <div className="action-row">
          <button
            ref={summonRef}
            className={`action-btn summon ${hud.fish < hud.summonCost || hud.boardFull ? 'disabled' : ''} ${shake === 'summon' ? 'shake' : ''}`}
            onClick={onSummon}
          >
            <span className="action-label">{hud.boardFull ? t('battle.boardFull') : t('battle.summon')}</span>
            <span className="action-cost">
              <FishIcon size={18} />{' '}
              <span key={hud.summonCost} className="cost-num">
                {hud.summonCost}
              </span>
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
              {!hud.skillUnlocked ? <GameIcon name="lock" size={14} /> : null}
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
          buttons={{ summon: summonRef, skill: skillRef, speed: speedBtnRef, start: startBtnRef }}
          loadout={save.equipped}
          onContinue={() => directorRef.current.complete(battleRef.current)}
        />
      )}

      {inspectUid !== null && battleRef.current.catByUid(inspectUid) && (
        <CatInfoPanel
          cat={battleRef.current.catByUid(inspectUid)!}
          battle={battleRef.current}
          loadout={save.equipped}
          onClose={() => setInspectUid(null)}
          canSell={battleRef.current.status === 'playing' && !directorRef.current.active}
          onSell={() => {
            const r = battleRef.current.sellCat(inspectUid);
            if (r.ok) {
              setInspectUid(null);
              toast(t('sell.done', { n: r.refund ?? 0 }), 'good');
            }
          }}
        />
      )}

      {offer && <RewardModal key={hud.rewardId} offer={offer} owned={b.skills} cats={b.cats} roster={b.roster} onChoose={(i) => battleRef.current.chooseReward(i)} />}
      {result && cutscene && (
        <ChapterCutscene
          cats={battleRef.current.roster}
          loadout={save.equipped}
          onDone={() => {
            saveStore.markSeen(CUTSCENE_ID);
            setCutscene(false);
          }}
        />
      )}
      {result && !cutscene && grants.length > 0 && (
        <ChapterReward key={grants[0].chapterId} grant={grants[0]} loadout={save.equipped} onClose={() => setGrants((g) => g.slice(1))} />
      )}

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
              <GameIcon name="replay" size={18} /> {t('pause.restart')}
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              <GameIcon name="list" size={18} /> {t('pause.stages')}
            </button>
          </div>
        </div>
      )}

      {result && (
        <ResultPanel
          result={result}
          roster={battleRef.current.roster}
          loadout={save.equipped}
          totalCoins={save.fishCoins}
          hasNext={!!next}
          onNext={() => next && onPlay(next)}
          onReplay={restart}
          onHome={onHome}
          onStages={onExit}
          extra={
            debug.enabled ? <StatsTable stats={result.stats} baseHp={result.baseHp} maxHp={result.maxHp} duration={result.duration} /> : undefined
          }
        />
      )}
    </div>
  );
}
