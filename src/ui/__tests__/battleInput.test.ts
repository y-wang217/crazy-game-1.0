import { CHAPTERS, stageMap } from '../../config/chapters';
import { Battle } from '../../game/battle';
import { DragController, boardBlocked } from '../battleInput';

// Regression (V1.6.2): a popup / interruption appearing while a cat is held used to leave the press
// stuck — the cat stayed drawn mid-air and every later touch was ignored (seen on 1-5 and during
// Tactical Pause). These tests drive the real input state machine against a real battle.
const stage = CHAPTERS[0].stages.find((s) => s.id === '1-5')!;

function setup(paused: boolean) {
  const b = new Battle(stage, stageMap(stage), { seed: 3 });
  const t = b.tiles.filter((x) => x.unlocked);
  const a = b.placeCat('kitten', 1, t[0].id)!;
  const c = b.placeCat('orange', 1, t[1].id)!;
  b.startBattle();
  if (paused) expect(b.pause(true)).toBe(true);
  const released: number[] = [];
  const timers: number[] = [];
  const input = new DragController({ release: (id) => released.push(id), clearTimer: (id) => timers.push(id) });
  const snapshot = () => b.cats.map((x) => `${x.uid}@${x.tileId}:${x.type}${x.level}`).join();
  return { b, a, c, input, released, timers, snapshot, empty: () => b.emptyTiles()[0].id };
}

/** Same handling as BattleScreen: act on a finished press only while the board is playable. */
function act(b: Battle, end: ReturnType<DragController['end']>) {
  if (end.kind === 'drop' && (b.status === 'playing' || b.status === 'paused')) return b.dropCat(end.uid, end.target).result;
  return end.kind;
}

const popup = (b: Battle) => boardBlocked({ step: { expect: undefined }, status: b.status, inspecting: false, menuOpen: false, result: false, hidden: false });

for (const paused of [false, true]) {
  describe(`drag interrupted by a popup (${paused ? 'Tactical Pause' : 'normal battle'})`, () => {
    it('cancels the held cat with no move, swap, merge or sell; the board works again afterwards', () => {
      const { b, a, input, released, snapshot, empty } = setup(paused);
      const before = snapshot();
      const status = b.status;
      // 1. start dragging a cat toward an empty tile
      const press = input.begin(a.uid, 7, 100, 100);
      press.timer = 42;
      input.move(7, 140, 130, 8, () => ({ uid: a.uid, x: 0, y: 0, overTileId: empty() }));
      expect(input.drag?.uid).toBe(a.uid);
      // 2. a popup opens before release → the screen cancels the press
      expect(popup(b)).toBe(true);
      input.cancel();
      expect(input.busy).toBe(false);
      expect(input.drag).toBeNull(); // no floating cat drawn
      expect(released).toEqual([7]); // pointer capture released
      // 3. the popup closes; the original finger's release arrives late (or never) → nothing happens
      expect(act(b, input.end(7, false))).toBe('none');
      expect(snapshot()).toBe(before);
      expect(b.status).toBe(status); // Tactical Pause stays paused, a running battle keeps running
      // 4. the game is interactive again: a new finger drags the same cat to an empty tile
      const target = empty();
      input.begin(a.uid, 8, 100, 100);
      input.move(8, 160, 160, 8, () => ({ uid: a.uid, x: 0, y: 0, overTileId: target }));
      expect(act(b, input.end(8, false))).toBe('moved');
      expect(b.catByUid(a.uid)!.tileId).toBe(target);
      expect(b.status).toBe(status);
    });

    it('a stale press whose release was lost never blocks the next touch, and is never acted on', () => {
      const { b, a, c, input, released, snapshot } = setup(paused);
      const before = snapshot();
      input.begin(a.uid, 11, 0, 0);
      input.move(11, 50, 50, 8, () => ({ uid: a.uid, x: 0, y: 0, overTileId: c.tileId })); // over the orange (would swap)
      // the release of finger 11 is lost (system banner / popup); finger 12 touches the board
      input.begin(c.uid, 12, 0, 0);
      expect(released).toEqual([11]);
      expect(input.press?.pointerId).toBe(12);
      expect(act(b, input.end(11, false))).toBe('none'); // late release of the old finger: ignored
      expect(snapshot()).toBe(before); // no swap happened
      expect(act(b, input.end(12, false))).toBe('tap'); // the new finger works (a tap cycles targeting)
    });
  });
}

describe('drag controller basics', () => {
  it('pointercancel, long-press and lost capture end the press without acting', () => {
    const { a, input, empty } = setup(false);
    input.begin(a.uid, 1, 0, 0);
    input.move(1, 40, 0, 8, () => ({ uid: a.uid, x: 0, y: 0, overTileId: empty() }));
    expect(input.end(1, true)).toEqual({ kind: 'none' }); // pointercancel / lostpointercapture
    const p = input.begin(a.uid, 2, 0, 0);
    p.long = true; // long press opened the details panel
    expect(input.end(2, false)).toEqual({ kind: 'none' });
    input.begin(a.uid, 3, 0, 0);
    input.move(3, 3, 3, 8, () => ({ uid: a.uid, x: 0, y: 0, overTileId: null })); // below the drag threshold
    expect(input.end(3, false)).toEqual({ kind: 'tap', uid: a.uid });
    expect(input.end(99, false)).toEqual({ kind: 'none' }); // unknown pointer
  });

  it('popups and interruptions block the board; lessons that need a board drag or tap do not', () => {
    const base = { step: null, status: 'playing', inspecting: false, menuOpen: false, result: false, hidden: false };
    expect(boardBlocked(base)).toBe(false);
    expect(boardBlocked({ ...base, status: 'paused' })).toBe(false); // Tactical Pause: formation editing
    // tutorial popups / new cat & enemy intros (passive panels) and button lessons
    expect(boardBlocked({ ...base, step: {} })).toBe(true);
    expect(boardBlocked({ ...base, step: { expect: 'skill' } })).toBe(true);
    expect(boardBlocked({ ...base, step: { expect: 'pause' } })).toBe(true);
    // drag / tap lessons keep the board alive
    expect(boardBlocked({ ...base, step: { expect: 'moved' } })).toBe(false);
    expect(boardBlocked({ ...base, step: { expect: ['moved', 'swapped', 'merged'] } })).toBe(false);
    expect(boardBlocked({ ...base, step: { expect: 'tap' } })).toBe(false);
    // skill / reward choice, details panel, menu, result screen, hidden page
    expect(boardBlocked({ ...base, status: 'reward' })).toBe(true);
    expect(boardBlocked({ ...base, inspecting: true })).toBe(true);
    expect(boardBlocked({ ...base, menuOpen: true })).toBe(true);
    expect(boardBlocked({ ...base, result: true })).toBe(true);
    expect(boardBlocked({ ...base, hidden: true })).toBe(true);
  });
});
