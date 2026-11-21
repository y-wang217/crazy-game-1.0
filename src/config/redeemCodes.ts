import type { CatId } from "../game/types";

// Redeem / gift codes (兌換碼). Everything about a code lives here; the redemption UI and the save
// store never hard-code a code. To add a code, append an entry. To retire one, set `enabled: false`
// (players then get the normal "invalid code" message) or delete the entry — saves that already
// redeemed it keep what they received. Never reuse or change an `id`: saves record redemptions by id.
//
// Note: this is a client-side game, so these codes are not secret. Testing codes are fine for
// playtests; real public rewards should stay small (or move to a server later).

export type CodeReward =
  /** Permanent fish coins (魚幣). */
  | { type: "fishCoins"; amount: number }
  /** Cat Food Cans (貓罐頭), the recruitment currency. */
  | { type: "cans"; amount: number }
  /** Fragments for one cat (only applied if the player owns that cat). */
  | { type: "fragments"; cat: CatId; amount: number }
  /** A cosmetic from the Shop catalogue (skipped if already owned). */
  | { type: "cosmetic"; id: string }
  /**
   * Testing access. 'allStages': every implemented stage can be entered from Stage Select.
   * It never marks a stage cleared, never grants rewards and never completes tutorials.
   */
  | { type: "testAccess"; access: TestAccess };

export type TestAccess = "allStages";

export interface RedeemCodeDef {
  /** Stable id stored in saves. Never change or reuse it. */
  id: string;
  /** What the player types. Matching ignores letter case and all spaces (also full-width input). */
  code: string;
  rewards: CodeReward[];
  /** 'once' = once per save; 'unlimited' = every redemption grants the rewards again. */
  policy: "once" | "unlimited";
  /** false = behaves exactly like an unknown code. */
  enabled: boolean;
  /** Optional event window (ISO dates, inclusive start / exclusive end). */
  startsAt?: string;
  endsAt?: string;
  /** Classification only (for later clean-up / builds): testing codes vs. real public gifts. */
  audience: "testing" | "public";
  /** Optional custom success text; otherwise the message is built from the rewards. */
  message?: { en: string; zh: string };
}

export const REDEEM_CODES: RedeemCodeDef[] = [
  {
    id: "unlock88",
    code: "UNLOCK88",
    rewards: [{ type: "testAccess", access: "allStages" }],
    policy: "once",
    enabled: true,
    audience: "testing",
    message: {
      en: "Test access on! Every stage can now be played from Stage Select. Your progress, rewards and tutorials are unchanged.",
      zh: "已開啟測試權限！所有關卡都可以從選關畫面進入。你的進度、獎勵和教學都不受影響。",
    },
  },
  {
    id: "money999",
    code: "MONEY999",
    rewards: [{ type: "fishCoins", amount: 999 }],
    policy: "unlimited",
    enabled: true,
    audience: "testing",
  },
  {
    id: "catcan00",
    code: "CAT CAN 00",
    rewards: [{ type: "cans", amount: 10 }],
    policy: "unlimited",
    enabled: true,
    audience: "testing",
  },
];

/** Case-, space- and width-insensitive form used for matching ("cat can 00" = "CATCAN00"). */
export function normalizeCode(input: string): string {
  return input.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
}

export type CodeLookup =
  | { ok: true; def: RedeemCodeDef }
  | { ok: false; error: "empty" | "invalid" | "notYet" | "expired" };

/** Find an enabled code; disabled and unknown codes look the same to the player. */
export function lookupCode(
  input: string,
  now: Date = new Date(),
  codes: RedeemCodeDef[] = REDEEM_CODES,
): CodeLookup {
  const key = normalizeCode(input);
  if (!key) return { ok: false, error: "empty" };
  const def = codes.find((c) => c.enabled && normalizeCode(c.code) === key);
  if (!def) return { ok: false, error: "invalid" };
  if (def.startsAt && now < new Date(def.startsAt))
    return { ok: false, error: "notYet" };
  if (def.endsAt && now >= new Date(def.endsAt))
    return { ok: false, error: "expired" };
  return { ok: true, def };
}
