import { ALL_STAGE_IDS } from "../../config/chapters";
import {
  REDEEM_CODES,
  lookupCode,
  normalizeCode,
  type RedeemCodeDef,
} from "../../config/redeemCodes";
import { isFeatureUnlocked } from "../../config/unlocks";
import { parseSave, saveStore } from "../../save/store";
import { pendingTutorials, tutorialBlocking } from "../../tutorial/gate";
import { canEnterStage } from "../progression";

/** A page reload: the save goes through JSON + parseSave exactly like localStorage. */
const reload = () => parseSave(JSON.stringify(saveStore.get()));

describe("redeem code registry", () => {
  it("matching ignores case, spaces and full-width input", () => {
    expect(normalizeCode("  cat can 00 ")).toBe("CATCAN00");
    for (const s of [
      "CAT CAN 00",
      "cat can 00",
      " Cat Can 00 ",
      "catcan00",
      "ＣＡＴ　ＣＡＮ　００",
    ]) {
      const r = lookupCode(s);
      expect(r.ok && r.def.id).toBe("catcan00");
    }
    for (const s of [" unlock88", "Money999 "])
      expect(lookupCode(s).ok).toBe(true);
    expect(lookupCode("   ")).toEqual({ ok: false, error: "empty" });
    expect(lookupCode("MONEY998")).toEqual({ ok: false, error: "invalid" });
  });

  it("ids and codes are unique; the three testing codes are configured as requested", () => {
    expect(new Set(REDEEM_CODES.map((c) => c.id)).size).toBe(
      REDEEM_CODES.length,
    );
    expect(new Set(REDEEM_CODES.map((c) => normalizeCode(c.code))).size).toBe(
      REDEEM_CODES.length,
    );
    const by = Object.fromEntries(REDEEM_CODES.map((c) => [c.id, c]));
    expect(by.unlock88).toMatchObject({
      code: "UNLOCK88",
      policy: "once",
      audience: "testing",
      rewards: [{ type: "testAccess", access: "allStages" }],
    });
    expect(by.money999).toMatchObject({
      code: "MONEY999",
      policy: "unlimited",
      rewards: [{ type: "fishCoins", amount: 999 }],
    });
    expect(by.catcan00).toMatchObject({
      code: "CAT CAN 00",
      policy: "unlimited",
      rewards: [{ type: "cans", amount: 10 }],
    });
  });

  it("disabled codes look unknown; event windows are respected", () => {
    const codes: RedeemCodeDef[] = [
      {
        id: "off",
        code: "OFF1",
        rewards: [],
        policy: "once",
        enabled: false,
        audience: "public",
      },
      {
        id: "ev",
        code: "EVENT",
        rewards: [],
        policy: "once",
        enabled: true,
        audience: "public",
        startsAt: "2026-12-01",
        endsAt: "2027-01-01",
      },
    ];
    expect(lookupCode("off1", new Date(), codes)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(lookupCode("event", new Date("2026-11-30"), codes)).toEqual({
      ok: false,
      error: "notYet",
    });
    expect(lookupCode("event", new Date("2026-12-15"), codes).ok).toBe(true);
    expect(lookupCode("event", new Date("2027-01-01"), codes)).toEqual({
      ok: false,
      error: "expired",
    });
  });
});

describe("redeeming", () => {
  beforeEach(() => saveStore.reset());

  it("MONEY999 adds exactly 999 fish coins every time, never overwriting, also after a reload", () => {
    saveStore.addCoins(37);
    for (let i = 1; i <= 3; i++) {
      const r = saveStore.redeemCode("money999");
      expect(r.ok).toBe(true);
      expect(saveStore.get().fishCoins).toBe(37 + 999 * i);
    }
    expect(reload().fishCoins).toBe(37 + 999 * 3);
    expect(reload().redeemed.money999).toBe(3);
    expect(saveStore.get().cans).toBe(0);
  });

  it("CAT CAN 00 adds exactly 10 cans each time without unlocking Recruitment or clearing anything", () => {
    for (let i = 1; i <= 4; i++) {
      expect(saveStore.redeemCode(i % 2 ? "CAT CAN 00" : "catcan00").ok).toBe(
        true,
      );
      expect(saveStore.get().cans).toBe(10 * i);
    }
    const s = reload();
    expect(s.cans).toBe(40);
    expect(s.fishCoins).toBe(0);
    expect(s.cleared).toEqual({});
    expect(isFeatureUnlocked(s, "recruit")).toBe(false);
    expect(saveStore.claimRecruitIntro()).toBe(0); // the 2-5 intro gift still needs a real 2-5 clear
  });

  it("invalid, empty and disabled codes change nothing", () => {
    saveStore.addCoins(50);
    const before = JSON.stringify(saveStore.get());
    for (const c of ["", "  ", "MONEY", "CATCAN01", "unlock 89"])
      expect(saveStore.redeemCode(c).ok).toBe(false);
    expect(JSON.stringify(saveStore.get())).toBe(before);
  });

  it("UNLOCK88 opens every stage once, without clearing stages, rewards or tutorials", () => {
    const before = saveStore.get();
    expect(ALL_STAGE_IDS.filter((id) => canEnterStage(before, id))).toEqual([
      "1-1",
    ]);
    const r = saveStore.redeemCode("unlock88");
    expect(r.ok).toBe(true);
    const s = saveStore.get();
    for (const id of ALL_STAGE_IDS) expect(canEnterStage(s, id)).toBe(true);
    // Real progress is untouched.
    expect(s.unlocked).toEqual(["1-1"]);
    expect(s.cleared).toEqual({});
    expect(s.tutorials).toEqual({});
    expect(s.seen).toEqual([]);
    expect(s.fishCoins).toBe(0);
    expect(s.cans).toBe(0);
    expect(s.chapterRewards).toEqual([]);
    expect(s.collection).toEqual(before.collection);
    for (const f of ["shop", "encyclopedia", "team", "recruit"] as const)
      expect(isFeatureUnlocked(s, f)).toBe(false);
    expect(pendingTutorials(s)).toEqual([]);
    // One-time: a second redemption is refused and changes nothing; survives a reload.
    expect(saveStore.redeemCode(" Unlock88 ")).toEqual({
      ok: false,
      error: "used",
    });
    expect(saveStore.get().redeemed.unlock88).toBe(1);
    const again = reload();
    expect(again.testAccess).toEqual(["allStages"]);
    expect(canEnterStage(again, "2-20")).toBe(true);
  });

  it("after UNLOCK88, really clearing a stage still gives first-clear rewards and starts its tutorial", () => {
    saveStore.redeemCode("UNLOCK88");
    // Play straight into 1-4 (normally locked): a genuine first clear.
    const r = saveStore.completeStage("1-4", 10, 10);
    expect(r.firstClear).toBe(true);
    expect(r.coins).toBeGreaterThan(0);
    const s = saveStore.get();
    expect(isFeatureUnlocked(s, "shop")).toBe(true);
    expect(pendingTutorials(s)).toEqual(["shopCats"]); // tutorial shows up as usual…
    expect(tutorialBlocking(s, "1-5")).toBe("shopCats"); // …and keeps its mandatory gate
    expect(tutorialBlocking(s, "1-2")).toBeNull();
    // A repeat clear is not a first clear.
    expect(saveStore.completeStage("1-4", 10, 10).firstClear).toBe(false);
    // 2-8 milestone cans are still paid by a real first clear.
    expect(saveStore.completeStage("2-8", 10, 10).cans).toBeGreaterThan(0);
  });

  it("players who never used a code keep normal progression", () => {
    const s = saveStore.get();
    expect(canEnterStage(s, "1-2")).toBe(false);
    saveStore.completeStage("1-1", 10, 10);
    expect(canEnterStage(saveStore.get(), "1-2")).toBe(true);
    expect(canEnterStage(saveStore.get(), "1-3")).toBe(false);
  });
});

describe("save compatibility", () => {
  it("older saves without redeem fields load with empty ones and keep everything else", () => {
    const old = {
      version: 5,
      fishCoins: 321,
      cans: 4,
      cleared: { "1-1": 3, "1-2": 2 },
      unlocked: ["1-1", "1-2", "1-3"],
      tutorials: { shopCats: "done" },
    };
    const s = parseSave(JSON.stringify(old));
    expect(s.redeemed).toEqual({});
    expect(s.testAccess).toEqual([]);
    expect(s.fishCoins).toBe(321);
    expect(s.cans).toBe(4);
    expect(s.unlocked).toEqual(["1-1", "1-2", "1-3"]);
    // Junk values are dropped.
    const junk = parseSave(
      JSON.stringify({
        ...old,
        redeemed: { a: -1, b: "x", money999: 2 },
        testAccess: ["allStages", "godMode", 3],
      }),
    );
    expect(junk.redeemed).toEqual({ money999: 2 });
    expect(junk.testAccess).toEqual(["allStages"]);
  });
});
