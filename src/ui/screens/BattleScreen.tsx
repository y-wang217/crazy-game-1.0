import { useCallback, useEffect, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { CATS } from '../../config/cats';
import { findStage } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { SKILLS, SKILL_ORDER, skillParams } from '../../config/skills';
import { Battle, type BattleEvent, type BattleStats } from '../../game/battle';
import { nextStageId } from '../../game/progression';
import { tutorialBlocking } from '../../tutorial/gate';
import type { CatId, SkillId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { Renderer, type DragView } from '../../render/renderer';
import { saveStore, useSave } from '../../save/store';
import { TutorialDirector, type ActiveStep, type SeenStore, type TutAction } from '../../tutorial/director';
import { teamTutorialCat } from '../../tutorial/teamTutorial';
import { rollCanMonster } from '../../config/canRewards';
import { isFeatureUnlocked } from '../../config/unlocks';
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
import { feature } from '../../config/features';
import { skinBonusesFor } from '../../config/cosmetics';
import { computeStars } from '../../game/progression';
import { newRunId, recovery, RECOVERY_VERSION, type RecoveryRecord } from '../../save/battleRecovery';
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
  /** Whole seconds until the next wave (between waves only). */
  nextWave: number | null;
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
  cans?: number;
  bonusCoins?: number;
}

/**
 * One planned attempt per run id (React StrictMode may build the battle twice): records the
 * attempt once and decides once whether the secret Living Cat Food Can joins it.
 */
const attemptPlans = new Map<string, { canMonster: boolean }>();
function planAttempt(stageId: string, runId: string): { canMonster: boolean } {
  let p = attemptPlans.get(runId);
  if (!p) {
    const before = saveStore.recordAttempt(stageId);
    p = { canMonster: rollCanMonster(stageId, before) };
    attemptPlans.set(runId, p);
  }
  return p;
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
    nextWave: b.nextWaveIn === null ? null : Math.ceil(b.nextWaveIn),
  };
}

const seenStore: SeenStore = { has: (id: string) => saveStore.hasSeen(id), mark: (id: string) => saveStore.markSeen(id) };
/** Tutorial replay: lessons are tracked only in memory, so every one shows again and the save is never touched. */
const memorySeen = (preset: string[] = []): SeenStore => {
  const s = new Set<string>(preset);
  return { has: (id) => s.has(id), mark: (id) => void s.add(id) };
};
let toastId = 1;
/** Seen-id of the Chapter 1 → 2 story transition. */
export const CUTSCENE_ID = 'story:ch1-ch2';

/** Horizontal px kept free on each side of the board (away from edge Back gestures). */
const EDGE_GUTTER = 14;
/** Periodic checkpoint while combat (or the prep countdown) is running, in ms. */
const CHECKPOINT_MS = 2000;
/** Browser-history guard entries currently owned by battle screens (StrictMode-safe). */
let guardOwners = 0;
const isGuard = () => !!(window.history.state as { cdBattleGuard?: boolean } | null)?.cdBattleGuard;

export function BattleScreen({
  stageId,
  resume,
  onExit,
  onPlay,
  onHome,
  onPracticeTeam,
  onLessonEnd,
  run,
}: {
  stageId: string;
  /** The App's entry stamp for this visit (one stage attempt per entry). */
  run?: number;
  /** Scripted lessons: finished (all steps) or deliberately skipped. */
  onLessonEnd?: (outcome: 'done' | 'skipped') => void;
  /** Tutorial replay (practice stage) only: continue with the Edit Team practice. */
  onPracticeTeam?: () => void;
  /** A saved battle to continue (battle recovery); restored paused. */
  resume?: RecoveryRecord | null;
  onExit: () => void;
  onPlay: (id: string) => void;
  onHome: () => void;
}) {
  useLang();
  const found = findStage(stageId)!;
  const { stage, chapter } = found;
  /** Tutorial replay: a temporary session — no saves, coins, checkpoints or lesson marks. */
  const practice = !!stage.practice;
  /** A scripted lesson (Sir Sable's piercing lesson): his intro and the mice need no first-time cards. */
  const lessonPreset = stage.lesson ? ['cat:sable', 'enemy:normal'] : [];
  const seenRef = useRef<SeenStore>(practice ? memorySeen(lessonPreset) : seenStore);
  const lessonEndRef = useRef(false);
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
  // ---- Battle recovery bookkeeping ----
  /** This attempt's id (restored battles keep theirs; Restart makes a new one). */
  const runIdRef = useRef<string>(resume?.runId ?? newRunId());
  /**
   * One attempt per entry into the stage (the App's `run` stamp): stable even if React builds this
   * screen twice, so an attempt is never counted twice. Restart starts a new attempt.
   */
  const attemptKeyRef = useRef<string>(`${stageId}:${run ?? runIdRef.current}`);
  /** This browser tab (if another tab resumes the same run, this one stops). */
  const tabId = useRef(newRunId()).current;
  const lastSaveRef = useRef(0);
  const dirtyRef = useRef(true);
  const saveOkRef = useRef(true);
  const staleRef = useRef(false);
  const [stale, setStale] = useState(false);
  const restoredRef = useRef(false);
  /** Resuming a saved battle takes it over: the first checkpoint claims it for this tab. */
  const claimRef = useRef(!!resume);
  const newBattle = (fromSave = false) => {
    if (fromSave && resume) {
      const r = Battle.restore(stage, map, resume.snapshot, true);
      if (r) {
        restoredRef.current = true;
        return r;
      }
      runIdRef.current = newRunId(); // unusable save: start fresh
    }
    const sv = saveStore.get();
    // Practice uses the new-player setup: tutorial cats at 1★, no skin bonuses.
    if (practice) return new Battle(stage, map, { sandbox: !!stage.lesson });
    return new Battle(stage, map, {
      // Attempts are counted per stage; on 2-6 / 2-9 / 2-15 / 2-18 this also decides the secret can.
      canMonster: planAttempt(stage.id, attemptKeyRef.current).canMonster,
      tuning: debugStore.get().enabled ? debugStore.get().tuning : undefined,
      // Tutorial stages keep their own cats; every other stage summons from the player's team.
      roster: stage.fixedRoster ? undefined : sv.team,
      stars: Object.fromEntries(Object.entries(sv.collection).map(([id, c]) => [id, c!.stars])),
      // Equipped special skins (one per species, a few percent each).
      skinBonus: skinBonusesFor(sv.equipped),
    });
  };
  const battleRef = useRef<Battle>(null as unknown as Battle);
  if (!battleRef.current) battleRef.current = newBattle(true);
  const directorRef = useRef<TutorialDirector>(null as unknown as TutorialDirector);
  if (!directorRef.current) directorRef.current = new TutorialDirector(stage.id, seenRef.current);
  /** Speed multiplier relative to the baseline (BALANCE.speed.baseline). */
  const speedRef = useRef<number>(resume && BALANCE.speed.options.includes(resume.speed) ? resume.speed : loadSpeed());
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const tpauseBtnRef = useRef<HTMLButtonElement>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  /** Experimental tap-to-focus (feature flag, read once per battle screen). */
  const focusEnabled = useRef(feature('focusTargeting')).current;
  /** Pause menu (Resume / Restart / Stage select / Home). Tactical Pause has no menu. */
  const [menuOpen, setMenuOpen] = useState(false);
  /** "Nice!" confirmation after a tutorial action succeeds. */
  const [success, setSuccess] = useState(0);
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
  const [practiceEnd, setPracticeEnd] = useState<'victory' | 'defeat' | null>(null);
  /** Permanent extras earned during this attempt (already saved the moment they happened). */
  const earnedRef = useRef({ cans: 0, coins: 0 });

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

  /**
   * Save the battle so it can be recovered (refresh, Back gesture, closed tab, app switch).
   * Cheap (~10–30 KB JSON); runs on every player action, wave/chest events, every few seconds
   * of combat and whenever the page is hidden. Never after the battle has ended.
   */
  const checkpoint = useCallback(() => {
    const b = battleRef.current;
    if (practice || staleRef.current || b.sandbox || resultLoggedRef.current === b) return;
    if (b.status === 'victory' || b.status === 'defeat') return;
    const cur = claimRef.current ? null : recovery.storedOwner();
    claimRef.current = false;
    if (cur && cur.runId === runIdRef.current && cur.owner !== tabId) {
      // Another tab resumed this same battle: stop here so it can't be played (or rewarded) twice.
      staleRef.current = true;
      b.pause();
      setStale(true);
      return;
    }
    dirtyRef.current = false;
    lastSaveRef.current = performance.now();
    saveOkRef.current = recovery.save({
      version: RECOVERY_VERSION,
      runId: runIdRef.current,
      owner: tabId,
      stageId: stage.id,
      savedAt: Date.now(),
      speed: speedRef.current,
      wave: Math.max(0, b.waveIndex + 1),
      totalWaves: b.totalWaves,
      baseHp: b.baseHp,
      maxHp: b.maxBaseHp,
      preparing: b.preparing,
      snapshot: b.snapshot(),
    });
  }, [stage.id, tabId, practice]);
  const checkpointRef = useRef(checkpoint);
  checkpointRef.current = checkpoint;
  /** Something changed: save on the next frame. */
  const dirty = () => {
    dirtyRef.current = true;
  };

  const showStageBanner = useCallback(() => {
    setBanner({
      text: stage.lesson ? t('pierce.badge') : practice ? t('practice.banner') : t('battle.stageBanner', { id: stage.id, name: t(`stage.${stage.id}`) }),
      sub: practice ? t('practice.safe') : undefined,
      tone: 'stage',
      key: Date.now(),
    });
  }, [stage.id, stage.lesson, practice]);
  useEffect(showStageBanner, [showStageBanner]);

  // ---- Battle events → UI / persistence ----
  const handleEvents = useCallback(
    (events: BattleEvent[]) => {
      const b = battleRef.current;
      for (const e of events) {
        switch (e.type) {
          case 'coins':
            if (practice) {
              toast(t('practice.noCoins'), 'good'); // practice chests pay nothing permanent
              break;
            }
            if (staleRef.current) break;
            // Gold Chest: 4% bonus Cat Food Can after 2-5, at most once per stage (saved at once).
            if (e.tier === 'gold') {
              const can = saveStore.rollGoldChestCan(stage.id);
              if (can) {
                earnedRef.current.cans += can;
                toast(t('battle.goldCan', { n: can }), 'good');
              }
            }
            saveStore.addCoins(e.amount); // chest coins are kept even if the stage is lost
            // Checkpoint right away: an older save (chest still alive) could otherwise pay twice.
            checkpointRef.current();
            toast(t('battle.chestCoins', { n: e.amount }), 'good');
            break;
          case 'skill':
            setSkillPop({ id: e.skillId, level: e.level, isNew: e.isNew, key: Date.now() });
            break;
          case 'wave':
            dirtyRef.current = true;
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
          case 'bossPhase':
            toast(t('battle.bossPhase', { boss: t(`enemy.${e.enemy}.name`) }), 'warn');
            break;
          case 'eliteAppeared':
            toast(t('battle.eliteAppeared', { name: t(`enemy.${e.enemy}.name`) }), 'warn');
            break;
          case 'bossDefeated':
            toast(t('battle.bossDefeated', { boss: t(`enemy.${e.enemy}.name`) }), 'good');
            break;
          case 'ultimate':
            toast(t('battle.ultFired', { cat: t(`cat.${e.cat}.name`), name: t(`ability.${e.cat}.ult.name`) }), 'good');
            break;
          case 'canMonsterDefeated': {
            if (practice || staleRef.current) break;
            const r = saveStore.claimCanMonster(stage.id); // 1 can the first time per stage, coins after
            earnedRef.current.cans += r.cans;
            earnedRef.current.coins += r.coins;
            toast(r.cans ? t('battle.canMonsterCan', { n: r.cans }) : t('battle.canMonsterCoins', { n: r.coins }), 'good');
            checkpointRef.current();
            break;
          }
          case 'canMonsterLooped':
            toast(t('battle.canMonsterLooped'), 'warn');
            break;
          case 'maxedChestFish':
            toast(t('battle.maxedChestFish', { n: e.fish }), 'good');
            break;
          case 'victory':
          case 'defeat': {
            if (resultLoggedRef.current === b) break;
            resultLoggedRef.current = b;
            if (practice) {
              setPracticeEnd(e.type);
              break;
            }
            // The run is over: remember it (so no copy of it can be rewarded again) and drop the checkpoint.
            const already = staleRef.current || recovery.isFinished(runIdRef.current);
            recovery.markFinished(runIdRef.current);
            recovery.clear(runIdRef.current);
            const common = {
              chapterId: chapter.id,
              chapterNumber: chapter.number,
              chestCoins: b.chestCoins,
              bonusCoins: earnedRef.current.coins,
              baseHp: b.baseHp,
              maxHp: b.maxBaseHp,
              stats: { ...b.stats },
              duration: b.time,
            };
            if (e.type === 'victory') {
              const r = already
                ? { stars: computeStars(b.baseHp, b.maxBaseHp), coins: 0, firstClear: false }
                : saveStore.completeStage(stage.id, b.baseHp, b.maxBaseHp);
              setResult({
                ...common,
                cans: earnedRef.current.cans + ('cans' in r ? r.cans : 0),
                victory: true,
                stars: r.stars,
                coins: r.coins,
                firstClear: r.firstClear,
                chapterComplete: !!stage.isBoss && found.index === chapter.stages.length - 1,
              });
              // First clear of Chapter 1: the story transition plays first (once; replayable from
              // Stage Select), then the chapter reward cat is revealed. The reward is claimed
              // right now and saved, so nothing can award it twice.
              if (r.firstClear && chapter.id === 'ch1' && found.index === chapter.stages.length - 1 && !saveStore.hasSeen(CUTSCENE_ID))
                setCutscene(true);
              const g = saveStore.claimChapterRewards();
              if (g.length) setGrants(g);
            } else {
              setResult({ ...common, cans: earnedRef.current.cans, victory: false, stars: 0, coins: 0, firstClear: false, chapterComplete: false });
            }
            break;
          }
        }
      }
    },
    [toast, stage, chapter, found.index, practice],
  );
  const handleEventsRef = useRef(handleEvents);
  handleEventsRef.current = handleEvents;

  // ---- Single render/simulation loop for the lifetime of this screen ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const field = fieldRef.current!;
    const renderer = new Renderer(canvas, map);
    rendererRef.current = renderer;
    // Keep a gutter at the left/right screen edges so no cat has to be grabbed inside the
    // Android/iOS edge Back-gesture zone (only matters when the board is width-limited).
    const fit = () => renderer.resize(field.clientWidth - 2 * EDGE_GUTTER, field.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(field);

    let raf = 0;
    let last = performance.now();
    let alive = true;
    let stepKey = -1;
    let successSeen = directorRef.current.successCount;
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const b = battleRef.current;
      const active = directorRef.current.update(b); // freezes the battle while a lesson is shown
      // A scripted lesson ends after its last step (its own completion panel follows).
      if (stage.lesson && !lessonEndRef.current && seenRef.current.has('pierce:done')) {
        lessonEndRef.current = true;
        setPracticeEnd('victory');
      }
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
      if (dirtyRef.current || ((b.running || (b.preparing && b.status === 'playing')) && now - lastSaveRef.current > CHECKPOINT_MS))
        checkpointRef.current();
      const focusUids = active ? active.focus.flatMap((f) => (f.kind === 'cat' ? [f.uid] : [])) : undefined;
      renderer.draw(b, dragRef.current, loadoutRef.current, { focusUids });
      if (directorRef.current.successCount !== successSeen) {
        successSeen = directorRef.current.successCount;
        setSuccess((n) => n + 1);
      }
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
      // Leaving the app: freeze the battle, save it, and show the menu when the player returns.
      if (!document.hidden) return;
      if (battleRef.current.pause()) setMenuOpen(true);
      checkpointRef.current();
    };
    // The page may be discarded after this (tab closed, OS reclaims memory): save now.
    const onHide = () => checkpointRef.current();
    // Limited fallback only: ask the browser to confirm leaving if the checkpoint could NOT be
    // saved (storage blocked/full). Normally recovery makes this prompt unnecessary.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      checkpointRef.current();
      const b = battleRef.current;
      const live = (b.status === 'playing' || b.status === 'paused' || b.status === 'reward') && !b.sandbox;
      if (live && !saveOkRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [map]);

  // A recovered battle: say so once (it starts paused; Resume when ready).
  useEffect(() => {
    if (!restoredRef.current) return;
    restoredRef.current = false; // once (StrictMode runs effects twice in development)
    toast(t('recover.restored'), 'good');
  }, [toast]);

  // ---- Back gesture / browser Back: ask before leaving an active battle ----
  // One guard history entry while the battle screen is open. Back consumes it and opens the
  // "Leave battle?" sheet; "Continue" puts the single entry back. A second Back while the sheet
  // is open leaves normally (no trap) — and the checkpoint still allows recovery.
  const [leaveAsk, setLeaveAsk] = useState(false);
  const leaveResumeRef = useRef(false);
  const resultRef = useRef<Result | null>(null);
  useEffect(() => {
    guardOwners++;
    if (!isGuard()) window.history.pushState({ cdBattleGuard: true }, '');
    const onPop = () => {
      if (isGuard()) return;
      if (resultRef.current) {
        onExitRef.current(); // battle already over: Back = back to stage select
        return;
      }
      const b = battleRef.current;
      leaveResumeRef.current = b.pause();
      checkpointRef.current();
      setInspectUid(null);
      setLeaveAsk(true);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      guardOwners--;
      // Leaving the battle screen through the UI: drop our guard entry (after any StrictMode remount).
      window.setTimeout(() => {
        if (guardOwners === 0 && isGuard()) window.history.back();
      }, 0);
    };
  }, []);
  const continueBattle = () => {
    setLeaveAsk(false);
    if (!isGuard()) window.history.pushState({ cdBattleGuard: true }, '');
    if (leaveResumeRef.current) battleRef.current.resume();
    leaveResumeRef.current = false;
    dirty();
  };
  /** Deliberately leaving an unfinished battle: it is abandoned (no recovery offer). */
  const abandon = (then: () => void) => {
    staleRef.current = true; // no further checkpoints from this screen
    recovery.clear(runIdRef.current);
    then();
  };
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // Summon cost feedback: show "+N" when the price goes up.
  const prevCost = useRef(hud.summonCost);
  useEffect(() => {
    if (hud.summonCost > prevCost.current) setCostBump({ n: hud.summonCost - prevCost.current, key: Date.now() });
    prevCost.current = hud.summonCost;
  }, [hud.summonCost]);

  // ---- Actions ----
  const restart = () => {
    runIdRef.current = newRunId(); // a new attempt (overwrites the old checkpoint)
    attemptKeyRef.current = runIdRef.current; // …and a new attempt record
    staleRef.current = false;
    dirtyRef.current = true;
    battleRef.current = newBattle();
    earnedRef.current = { cans: 0, coins: 0 };
    if (practice) seenRef.current = memorySeen(lessonPreset); // a restarted practice starts the lessons again
    lessonEndRef.current = false;
    directorRef.current = new TutorialDirector(stage.id, seenRef.current);
    setPracticeEnd(null);
    setInspectUid(null);
    setMenuOpen(false);
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
    dirty();
    if (!gate('summon')) return;
    const b = battleRef.current;
    const r = b.summon();
    if (!r.ok) {
      // A full board is never a dead end: merging or selling always frees a tile.
      toast(r.reason === 'boardFull' ? t('battle.boardFullHint') : errText(r.reason), 'warn');
      bump('summon');
    } else directorRef.current.onAction('summon', b);
  };
  const onSkill = () => {
    dirty();
    if (!gate('skill')) return;
    const b = battleRef.current;
    const r = b.buySkill();
    if (!r.ok) {
      toast(errText(r.reason), 'warn');
      bump('skill');
    } else directorRef.current.onAction('skill', b);
  };
  /**
   * Tactical Pause: freezes the whole battle (no menu) so the formation can be reorganised —
   * move / swap / merge / targeting / details / sell all keep working. Summon and skills wait.
   */
  const onTacticalPause = () => {
    dirty();
    const b = battleRef.current;
    if (b.preparing || result) return;
    if (!gate('pause')) return;
    if (b.pause(true)) directorRef.current.onAction('pause', b);
  };
  const onResume = () => {
    dirty();
    const b = battleRef.current;
    if (b.status !== 'paused') return;
    if (!gate('resume')) return;
    b.resume();
    directorRef.current.onAction('resume', b);
  };
  const openMenu = () => {
    dirty();
    const b = battleRef.current;
    if (result) return;
    b.pause();
    if (b.status === 'paused') setMenuOpen(true);
  };
  /** Menu "Resume": close the menu and continue the battle. */
  const menuResume = () => {
    dirty();
    setMenuOpen(false);
    battleRef.current.resume();
  };
  const setGameSpeed = (s: number) => {
    dirty();
    speedRef.current = s;
    setSpeed(s);
    if (!practice) saveSpeed(s); // practice never changes saved preferences
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
    dirty();
    if (directorRef.current.active) return;
    battleRef.current.startBattle(); // idempotent: only the first call starts combat
  };

  // Desktop shortcuts: Space / P = Tactical Pause ↔ Resume, Esc = menu.
  const keysRef = useRef({ onTacticalPause, onResume, openMenu, menuResume, menuOpen });
  keysRef.current = { onTacticalPause, onResume, openMenu, menuResume, menuOpen };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore auto-repeat, text fields and focused buttons (Space would also click them).
      if (e.repeat || e.target instanceof HTMLInputElement || (e.key === ' ' && e.target instanceof HTMLButtonElement)) return;
      const k = keysRef.current;
      if (e.key === 'Escape') {
        if (k.menuOpen) k.menuResume();
        else k.openMenu();
      } else if ((e.key === ' ' || e.key === 'p' || e.key === 'P') && !k.menuOpen) {
        e.preventDefault();
        if (battleRef.current.status === 'paused') k.onResume();
        else k.onTacticalPause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      if (focusEnabled && !directorRef.current.active) {
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
    dirty();
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
  resultRef.current = result;
  const b = battleRef.current;
  const offer = hud.status === 'reward' ? b.currentReward : null;
  const next = nextStageId(stage.id);
  const hpPct = hud.baseHp / hud.maxHp;
  const skillDisabled = !hud.skillUnlocked || hud.fish < hud.skillCost || hud.skillsMaxed;
  /** Tactical Pause is on: battle frozen, formation editable, no menu. */
  const tactical = hud.status === 'paused' && !menuOpen && !result && !hud.preparing;
  const canTacticalPause = hud.status === 'playing' && !hud.preparing && !result;

  return (
    <div className={`screen battle ${stage.lesson ? 'lesson' : ''}`} ref={rootRef}>
      {/* Top HUD */}
      <div className="hud">
        <div className={`hud-pill hp ${hpPct <= 0.3 ? 'danger' : ''}`}>
          <HeartIcon size={18} /> {hud.baseHp}
        </div>
        <div className="hud-center">
          <div className="hud-stage">
            {stage.lesson ? t('pierce.badge') : practice ? t('practice.badge') : `${t('battle.stage', { id: stage.id })} · ${t(`stage.${stage.id}`)}`}
          </div>
          <div className={`hud-wave ${hud.nextWave !== null ? 'countdown' : ''}`}>
            {hud.preparing
              ? t('battle.prepShort')
              : hud.nextWave !== null
                ? t('battle.nextWaveIn', { n: hud.wave + 1, s: hud.nextWave })
                : t('battle.wave', { n: hud.wave, total: hud.totalWaves })}
          </div>
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
        <button className="hud-btn menu-btn" onClick={openMenu} aria-label={t('pause.menu')}>
          <GameIcon name="list" size={16} />
        </button>
        {debug.enabled && (
          <button className="hud-btn" onClick={() => setShowDebug((v) => !v)} aria-label="debug">
            🛠
          </button>
        )}
      </div>

      {/* Battlefield */}
      <div className={`field ${tactical ? 'tactical' : ''}`} ref={fieldRef}>
        {tactical && (
          <div className="tactical-badge" role="status">
            <GameIcon name="pause" size={14} /> {t('tpause.on')}
          </div>
        )}
        {success > 0 && (
          <div key={success} className="tut-success" aria-live="polite">
            {t('tut.nice')}
          </div>
        )}
        {/* Compact 5★ ultimate readiness: one ring per species (fires automatically). */}
        {hud.ults.length > 0 && (
          <div className="ult-strip" aria-label={t('battle.ult')}>
            {hud.ults.map(([id, r]) => (
              <span
                key={id}
                className={`ult-chip ${r >= 1 ? 'ready' : ''}`}
                style={{ ['--p' as string]: `${Math.round(r * 100)}%` }}
                title={`${t(`ability.${id}.ult.name`)} · ${r >= 1 ? t('info.ultReady') : t('info.ultCharging', { p: Math.round(r * 100) })}`}
              >
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
        ) : tactical ? (
          <div className="skill-row tactical-hint">{t('tpause.hint')}</div>
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
        {tactical ? (
          <div className="action-row">
            <button ref={resumeBtnRef} className="action-btn resume-btn" onClick={onResume}>
              <span className="action-label">
                <GameIcon name="play" size={18} /> {t('tpause.resume')}
              </span>
            </button>
          </div>
        ) : (
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
            {!hud.preparing && (
              <button
                ref={tpauseBtnRef}
                className={`action-btn tpause-btn ${canTacticalPause ? '' : 'disabled'}`}
                onClick={onTacticalPause}
                aria-label={t('tpause.button')}
              >
                <GameIcon name="pause" size={20} />
                <span className="tpause-label">{t('tpause.button')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Overlays */}
      {step && (hud.status === 'playing' || hud.status === 'paused') && !menuOpen && !result && (
        <TutorialOverlay
          key={step.key}
          step={step}
          battle={b}
          renderer={rendererRef.current}
          appRef={rootRef}
          buttons={{ summon: summonRef, skill: skillRef, speed: speedBtnRef, start: startBtnRef, tpause: tpauseBtnRef, resume: resumeBtnRef }}
          loadout={save.equipped}
          onContinue={() => directorRef.current.complete(battleRef.current)}
          onSkip={
            stage.lesson
              ? () => (onLessonEnd ? onLessonEnd('skipped') : onExit()) // a deliberate Skip Tutorial ends the lesson
              : directorRef.current.isLesson
                ? () => directorRef.current.skipAll(battleRef.current)
                : undefined
          }
        />
      )}

      {inspectUid !== null && battleRef.current.catByUid(inspectUid) && (
        <CatInfoPanel
          cat={battleRef.current.catByUid(inspectUid)!}
          battle={battleRef.current}
          loadout={save.equipped}
          onClose={() => setInspectUid(null)}
          canSell={(battleRef.current.status === 'playing' || battleRef.current.status === 'paused') && !directorRef.current.active}
          onSell={() => {
            const r = battleRef.current.sellCat(inspectUid);
            dirty();
            if (r.ok) {
              setInspectUid(null);
              toast(t('sell.done', { n: r.refund ?? 0 }), 'good');
            }
          }}
        />
      )}

      {offer && (
        <RewardModal
          key={hud.rewardId}
          offer={offer}
          owned={b.skills}
          cats={b.cats}
          roster={b.roster}
          onChoose={(i) => {
            battleRef.current.chooseReward(i);
            dirty();
          }}
        />
      )}
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
        <ChapterReward
          key={grants[0].chapterId}
          grant={grants[0]}
          loadout={save.equipped}
          onClose={() => {
            const rest = grants.slice(1);
            setGrants(rest);
            // Chapter 1 reward (Sir Sable) unlocks Edit Team: its tutorial starts right away on Home.
            const sv = saveStore.get();
            if (!rest.length && isFeatureUnlocked(sv, 'team') && teamTutorialCat(sv)) onHome();
          }}
        />
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

      {(menuOpen || hud.preparing) && hud.status === 'paused' && !result && !leaveAsk && !stale && (
        <div className="overlay">
          <div className="panel">
            <h2>{t('pause.title')}</h2>
            <button className="btn btn-primary" onClick={menuResume}>
              <GameIcon name="play" size={18} /> {t('pause.resume')}
            </button>
            <button className="btn btn-secondary" onClick={restart}>
              <GameIcon name="replay" size={18} /> {t('pause.restart')}
            </button>
            {practice ? (
              <button className="btn btn-secondary" onClick={() => abandon(onExit)}>
                <GameIcon name="home" size={18} /> {t('practice.exit')}
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => abandon(onExit)}>
                  <GameIcon name="list" size={18} /> {t('pause.stages')}
                </button>
                <button className="btn btn-secondary" onClick={() => abandon(onHome)}>
                  <GameIcon name="home" size={18} /> {t('pause.home')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Back gesture / browser Back during a battle */}
      {leaveAsk && !result && (
        <div className="overlay leave-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="panel">
            <h2 id="leave-title">{t('leave.title')}</h2>
            <p className="muted">{t('leave.body')}</p>
            <button className="btn btn-primary" onClick={continueBattle}>
              <GameIcon name="play" size={18} /> {t('leave.stay')}
            </button>
            <button className="btn btn-secondary" onClick={() => abandon(onHome)}>
              <GameIcon name="home" size={18} /> {t('leave.home')}
            </button>
          </div>
        </div>
      )}

      {/* The same battle was resumed in another tab */}
      {stale && !result && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="panel">
            <h2>{t('recover.staleTitle')}</h2>
            <p className="muted">{t('recover.staleBody')}</p>
            <button className="btn btn-primary" onClick={onHome}>
              <GameIcon name="home" size={18} /> {t('pause.home')}
            </button>
          </div>
        </div>
      )}

      {practiceEnd && stage.lesson && (
        <div className="overlay practice-end" role="dialog" aria-modal="true">
          <div className="panel">
            <h2>{t('pierce.doneTitle')}</h2>
            <p className="muted">{t('pierce.doneBody')}</p>
            <button className="btn btn-primary" onClick={() => (onLessonEnd ? onLessonEnd('done') : onExit())}>
              <GameIcon name="home" size={18} /> {t('tut.continue')}
            </button>
            <button className="btn btn-secondary" onClick={restart}>
              <GameIcon name="replay" size={18} /> {t('practice.again')}
            </button>
          </div>
        </div>
      )}
      {practiceEnd && !stage.lesson && (
        <div className="overlay practice-end" role="dialog" aria-modal="true">
          <div className="panel">
            <h2>{t(practiceEnd === 'victory' ? 'practice.doneTitle' : 'practice.lostTitle')}</h2>
            <p className="muted">{t('practice.doneBody')}</p>
            {onPracticeTeam && (
              <button className="btn btn-primary" onClick={onPracticeTeam}>
                <GameIcon name="team" size={18} /> {t('practice.team')}
              </button>
            )}
            <button className="btn btn-secondary" onClick={restart}>
              <GameIcon name="replay" size={18} /> {t('practice.again')}
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              <GameIcon name="home" size={18} /> {t('practice.exit')}
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
          tutorialWaiting={!practice && !!next && tutorialBlocking(save, next) !== null}
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
