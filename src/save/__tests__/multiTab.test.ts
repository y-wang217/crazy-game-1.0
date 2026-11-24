import { vi } from "vitest";

// Regression (audit B2): two tabs share one browser storage but each keeps the save in memory.
// A tab opened earlier used to write its old copy over progress made in the other tab (coins,
// clears, cats…). Each "tab" here is a fresh instance of the store module on the same storage.
const KEY = "catdefense.save.v1";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

type Mod = typeof import("../store");
async function openTab(): Promise<Mod> {
  vi.resetModules();
  return import("../store");
}
let ls: ReturnType<typeof fakeStorage>;
const stored = () => JSON.parse(ls.getItem(KEY)!);

beforeEach(() => {
  ls = fakeStorage();
  vi.stubGlobal("localStorage", ls);
});
afterEach(() => vi.unstubAllGlobals());

describe("two tabs on the same save", () => {
  it("progress made in one tab survives a purchase in a tab opened earlier", async () => {
    const A = (await openTab()).saveStore;
    A.reset();
    A.redeemCode("MONEY999");
    const B = (await openTab()).saveStore; // opened now: 999 coins
    for (const id of ["1-1", "1-2", "1-3", "1-4"]) A.completeStage(id, 10, 10); // +150 coins in tab A
    expect(B.get().fishCoins).toBe(999); // B hasn't noticed yet (no storage event in tests)…
    expect(B.buyCosmetic("hat_bow").ok).toBe(true); // …but its purchase applies to the newest save
    const s = stored();
    expect(s.fishCoins).toBe(999 + 150 - 30);
    expect(Object.keys(s.cleared)).toEqual(["1-1", "1-2", "1-3", "1-4"]);
    expect(s.owned).toEqual(["hat_bow"]);
    expect(B.get().fishCoins).toBe(s.fishCoins);
  });

  it("stage clears from both tabs are kept, and a first clear is never paid twice", async () => {
    const A = (await openTab()).saveStore;
    A.reset();
    const B = (await openTab()).saveStore;
    const paid: number[] = [];
    const a1 = A.completeStage("1-1", 10, 10);
    const b1 = B.completeStage("1-1", 10, 10);
    expect(a1.firstClear).toBe(true);
    expect(b1.firstClear).toBe(false); // already cleared in tab A: replay reward only
    const b2 = B.completeStage("1-2", 10, 10);
    expect(b2.firstClear).toBe(true);
    const a3 = A.completeStage("1-3", 10, 10);
    paid.push(a1.coins, b1.coins, b2.coins, a3.coins);
    expect(b1.coins).toBeLessThan(a1.coins);
    expect(Object.keys(stored().cleared).sort()).toEqual(["1-1", "1-2", "1-3"]);
    expect(stored().fishCoins).toBe(paid.reduce((x, y) => x + y, 0)); // every payment kept, none twice
  });

  it("recruitment and star upgrades in two tabs never lose cats, cans, fragments or coins", async () => {
    const A = (await openTab()).saveStore;
    A.reset();
    A.completeStage("2-5", 10, 10); // Recruitment open
    for (let i = 0; i < 3; i++) A.redeemCode("CAT CAN 00"); // 30 cans
    A.redeemCode("MONEY999");
    const B = (await openTab()).saveStore;
    const before = stored().cans;
    const r1 = A.recruit(() => 0.01); // tab A draws
    const r2 = B.recruit(() => 0.01); // tab B draws from the same pile
    expect(r1.ok && r2.ok).toBe(true);
    expect(stored().cans).toBe(before - 2);
    const owned = Object.keys(stored().collection);
    if (r1.ok) expect(owned).toContain(r1.cat);
    if (r2.ok) expect(owned).toContain(r2.cat);
    // Star upgrade in B after A topped up fragments: both effects remain.
    A.topUpFragments("kitten");
    const up = B.upgradeStar("kitten");
    expect(up.ok).toBe(true);
    expect(stored().collection.kitten.stars).toBe(2);
    expect(stored().fishCoins).toBe(B.get().fishCoins);
  });

  it("refreshing one tab picks up everything, and the other tab keeps working on top of it", async () => {
    const A = (await openTab()).saveStore;
    A.reset();
    A.completeStage("1-1", 10, 10);
    const B = (await openTab()).saveStore; // "refreshed" tab
    expect(Object.keys(B.get().cleared)).toEqual(["1-1"]);
    B.completeStage("1-2", 10, 10);
    A.markSeen("tut:welcome");
    const s = stored();
    expect(Object.keys(s.cleared)).toEqual(["1-1", "1-2"]);
    expect(s.seen).toContain("tut:welcome");
  });

  it("a save written by another tab is loaded at once by an idle tab (storage event)", async () => {
    const A = (await openTab()).saveStore;
    A.reset();
    const tabB = await openTab();
    let notified = 0;
    tabB.saveStore.onExternalChange(() => notified++);
    A.redeemCode("MONEY999");
    expect(tabB.applyExternalSave(ls.getItem(KEY))).toBe(true); // what the storage event does
    expect(tabB.saveStore.get().fishCoins).toBe(999);
    expect(notified).toBe(1);
    expect(tabB.applyExternalSave(ls.getItem(KEY))).toBe(false); // nothing new
    // Storage emptied by the browser: keep this tab's copy and write it back on the next action.
    ls.removeItem(KEY);
    expect(tabB.applyExternalSave(null)).toBe(false);
    tabB.saveStore.markSeen("x");
    expect(stored().fishCoins).toBe(999);
  });

  it("a single tab behaves exactly as before", async () => {
    const A = (await openTab()).saveStore;
    A.reset();
    A.completeStage("1-1", 10, 10);
    A.addCoins(5);
    expect(stored().fishCoins).toBe(35);
    expect(A.get().fishCoins).toBe(35);
  });
});
