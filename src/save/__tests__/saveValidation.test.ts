import { MAX_SAVED_COUNT, toCount } from "../validate";
import { parseSave } from "../store";

// Regression (audit C12): malformed save numbers must never create currency or wipe a save.
const base = {
  version: 5,
  cleared: { "1-1": 3, "1-2": 2 },
  unlocked: ["1-1", "1-2", "1-3"],
  tutorials: { shopCats: "done" },
};
const load = (o: Record<string, unknown>) =>
  parseSave(JSON.stringify({ ...base, ...o }));

describe("save number validation", () => {
  it("toCount: finite, non-negative, whole and capped; plain numeric text is accepted", () => {
    expect(toCount(12)).toBe(12);
    expect(toCount(7.9)).toBe(7);
    expect(toCount("42")).toBe(42);
    expect(toCount(" 5 ")).toBe(5);
    for (const bad of [
      -3,
      NaN,
      Infinity,
      -Infinity,
      "1e400",
      "0x10",
      "",
      "abc",
      null,
      undefined,
      {},
      [],
      true,
    ])
      expect(toCount(bad)).toBe(0);
    expect(toCount(1e12)).toBe(MAX_SAVED_COUNT);
    expect(toCount("nope", 1)).toBe(1);
  });

  it("a hand-edited Infinity (1e400) never becomes infinite coins, cans, fragments or stars", () => {
    const raw = JSON.stringify({
      ...base,
      collection: { kitten: { stars: 1, fragments: 3 } },
    }).replace('"version":5', '"version":5,"fishCoins":1e400,"cans":1e400');
    const s = parseSave(
      raw
        .replace('"fragments":3', '"fragments":1e400')
        .replace('"stars":1', '"stars":1e400'),
    );
    expect(s.fishCoins).toBe(0);
    expect(s.cans).toBe(0);
    expect(s.collection.kitten).toEqual({ stars: 1, fragments: 0 });
    expect(Number.isFinite(JSON.parse(JSON.stringify(s)).fishCoins)).toBe(true);
  });

  it("older saves with numbers stored as text keep their balances", () => {
    const s = load({
      fishCoins: "350",
      cans: "4",
      canDraws: "2",
      recruitStreak: "3",
      collection: { kitten: { stars: "2", fragments: "15" } },
      attempts: { "1-1": "3" },
      redeemed: { money999: "2" },
    });
    expect([s.fishCoins, s.cans, s.canDraws, s.recruitStreak]).toEqual([
      350, 4, 2, 3,
    ]);
    expect(s.collection.kitten).toEqual({ stars: 2, fragments: 15 });
    expect(s.attempts["1-1"]).toBe(3);
    expect(s.redeemed.money999).toBe(2);
  });

  it("one malformed field never resets the rest of the save", () => {
    const s = load({
      fishCoins: -50,
      cans: "lots",
      collection: {
        kitten: { stars: 3, fragments: -1 },
        tabby: { stars: "x", fragments: 5 },
      },
    });
    expect(s.fishCoins).toBe(0);
    expect(s.cans).toBe(0);
    expect(s.collection.kitten).toEqual({ stars: 3, fragments: 0 });
    expect(s.collection.tabby).toEqual({ stars: 1, fragments: 5 });
    // everything else survives
    expect(Object.keys(s.cleared)).toEqual(["1-1", "1-2"]);
    expect(s.unlocked).toEqual(["1-1", "1-2", "1-3"]);
    expect(s.tutorials.shopCats).toBe("done");
  });

  it("legitimate balances load unchanged", () => {
    const s = load({
      fishCoins: 7215,
      cans: 31,
      collection: {
        orange: { stars: 5, fragments: 0 },
        black: { stars: 3, fragments: 28 },
      },
    });
    expect([s.fishCoins, s.cans]).toEqual([7215, 31]);
    expect(s.collection.orange).toEqual({ stars: 5, fragments: 0 });
    expect(s.collection.black).toEqual({ stars: 3, fragments: 28 });
  });
});
