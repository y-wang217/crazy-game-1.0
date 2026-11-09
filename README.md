# Cat Defense / 喵喵防衛隊 (working title)

A cute, mobile-first, portrait tower-defense game. Summon random cats, drag them around, swap and merge them, set per-cat targeting, grab skills and crack open treasure chests to protect the fish from forest mice.

**Current version: V1.2.** Chapter 1 "Beginner Forest" has 10 stages on a compact board, 5 cats, 5 enemy types (including a boss), bronze/silver/gold chests, 19 skills (mostly cat-specific), two currencies and a cosmetic shop. The game is fully playable in English and Traditional Chinese, with a step-by-step tutorial and a developer balance panel.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test             # unit tests + headless balance report
npm run sim          # balance report only
npm run build        # type-check + production build into dist/
```

**Phone testing:** while `npm run dev` is running, open the "Network" URL Vite prints on your phone (same Wi-Fi).
**Desktop:** DevTools → device toolbar (Ctrl/Cmd+Shift+M) → pick a phone such as iPhone 12/13 or iPhone SE.

## Controls

| Action | Input |
| --- | --- |
| Summon a random cat (random free tile) | **Summon Cat** button |
| Buy one random skill (from Stage 5) | **Random Skill** button |
| Move a cat (free, unlimited) | Drag it to an empty tile |
| Swap two cats (free, unlimited) | Drag it onto a different cat (different type *or* level) |
| Merge (same type + same level) | Drag it onto the identical cat |
| Cycle targeting: First → Nearest → Strongest → Weakest → Treasure | Tap the cat |
| Cat details (effective stats, active skills); pauses the battle | Long-press the cat (~0.5 s) · desktop: right-click · close with ✕, backdrop or Esc |
| Pick a chest reward (combat is paused) | Tap one of the 3 cards |
| Start the fight early | **Start Battle** in the 20 s preparation bar (or let the countdown run out) |
| **Tactical Pause / 策略暫停** (freeze combat, keep editing the formation) | **Tactical Pause** button next to Summon/Skill · **Resume Battle / 繼續戰鬥** to continue · desktop: Space or P |
| Menu (Resume / Restart / Stage select / Home) | ☰ button in the top bar · desktop: Esc |
| Speed | speed button in the top bar (cycles 0.5× → 0.75× → 1× → 1.5× → 2×) |
| Focus a mouse *(experimental, feature flag)* | Tap the mouse or chest; tap again to cancel |

While dragging, tiles are tinted to show what the drop will do: green = move, gold = merge, blue = swap. A press only becomes a drag after the pointer moves 10 px, so a tap never moves a cat by accident.

## Early Access notice

- **When:** before the main menu, once per browser session (`sessionStorage` key `catdefense.noticeSeen`; returning to the menu or reloading the tab doesn't show it again, a new browser session does). Its single button dismisses it. It shows **「🐾 喵喵防衛隊（暫定）・開發中！」 / "🐾 Cat Defense (Working Title) — In Development!"** with the exact wording as specified.
- **Look:** always the Moonlit Gothic style (scoped colour tokens), even when the player uses the Light theme. A language switch sits on the card, and it fits without scrolling on 320 × 568 and 360 × 640 screens.
- **Version:** shown from `src/config/version.ts` (`APP_VERSION`, displayed as e.g. `V1.4` via `versionLabel()`), the same constant as the Home footer. Bump the version there only.
- **No side effects:** it never touches the save. If an interrupted battle was saved, the "Resume previous battle?" prompt appears right after the notice is dismissed.

## Next release — Cat level scaling vs enemy progression (balance review)

**What playtesting reported:** runs swing between "one Lv.5 cat makes everything trivial" and "didn't merge enough, the run collapses".

**What the measurements showed:**
- **Merge payoff:** every merge multiplied damage per second (DPS) by about 2.1, so a Lv.5 cat did about 20× a Lv.1.
- **Armour:** flat armour made the gap about 75× against armoured mice.
- **Beginner-style runs** (beginner bot, enemy HP ×1.15) that reached a Lv.5 won about 100%. Runs that didn't won 0–30% on later stages.
- **The real cause:** those losing runs did not die late. They collapsed in the first third of the stage (e.g. 19 of 19 losses on 1-9, 1-10 and 2-10), with only Lv.2–3 cats. From 1-7 on, regular mice started tough from wave 1 and then barely grew, while cat power grows steeply within a stage. So openings were brutal and finals soft: "never reached Lv.5" was a symptom of dying early.

**Fix, on both sides together:**

1. **Smoother merge payoff:** `BALANCE.levels.damageMult` changed from `[1, 2, 4, 8, 16]` to `[1, 2.1, 4.2, 7.6, 13]` (per-level speed and range unchanged).

   | Merge | DPS step before | DPS step after |
   | --- | --- | --- |
   | Lv.1 → Lv.2 | ×2.12 | ×2.23 |
   | Lv.2 → Lv.3 | ×2.11 | ×2.11 |
   | Lv.3 → Lv.4 | ×2.11 | ×1.91 |
   | Lv.4 → Lv.5 | ×2.10 | ×1.80 |

   - Lv.5 is now about 15× a Lv.1 instead of about 20×.
   - Early merges pay a little more than the two cats they use. Late merges trade a little raw power for a free tile.
   - Poison, ricochets and other effects follow the same curve.
   - A 35% armour floor was tried and rejected because it erased Tabby's "weak against armour" identity. The floor stays at 20%.
2. **Elite enemies** (`config/enemies.ts`, `elite` role). Rare and crowned, each a focused threat with a counter:

   | Elite | Role | Threat | Counter |
   | --- | --- | --- | --- |
   | **肥芝士守衛 Chonky Cheese Guard** | high HP | about 8× a Forest Mouse | concentrate damage ("Strongest") |
   | **鐵盔鼠 Iron Helm Mouse** | high armour | armour 12 | big hits, Armor Break, poison |
   | **芝士小偷 Cheese Thief** | fast | very fast; escaping costs 3 hearts | "First" targeting near the exit |
   | **老鼠隊長 Mouse Captain** | escort | arrives with 4 escorts; mice in its gold circle take 35% less damage from hits (`BALANCE.elite`) | kill it first; poison ignores the guard |

   - **Looks:** a gold crown and a pulsing ring underfoot. The Captain's guard radius is drawn on the field, and protected mice show a small gold shield.
   - **Announcements:** first meeting shows an intro card ("精英敵人出現！" with type, threat and counter); every arrival shows a toast.
   - **Reward:** elites pay a little more dried fish.
   - **Placement:** none in Stages 1-1 → 1-4. The first is a single Cheese Guard late in 1-5. Later stages have 2–5, always under 6% of a stage's mice (tested). Scheduled per stage with `elites: { wave: id }`.
3. **Regular mice give steady pressure, elites provide the spikes.** From 1-7 and across Chapter 2:
   - Opening HP is lowered to ×0.75–0.8 of what it was.
   - Per-wave growth is steepened so each stage's final HP lands at its tuned target (×1.0–1.7 of before, per stage).
   - 1-5 and 1-6 keep the beginner fix and only gain elites.

**Results** (40–60 simulated runs per stage, original values vs the new configuration):
- **Strong players (smart bot headroom):** unchanged on most stages, within one measurement step on the rest. No stage got meaningfully easier or harder for good play.
- **Beginners (normal difficulty):** win rates are the same or better on most stages; for example 1-8 26 → 29/30 and 1-10 27 → 28/30.
- **Early collapse (beginner bot, ×1.15 pressure):** early-wave losses dropped a lot. Of all losses, the share in the first third went:
  - 1-7: 8 of 8 → 2 of 8
  - 1-9: 19 of 19 → 12 of 17
  - 1-10: 19 of 19 → 12 of 13
  - 2-10: 19 of 19 → 7 of 14
- **Lv.5 is no longer an automatic win:** Lv.5 runs now win 88–96% on the hardest stages instead of 100%.
- **What hasn't changed:** under ×1.15 pressure, runs that never reach Lv.5 on the two boss stages still mostly lose. Those runs fall behind early, and the bosses still demand a developed team. That is intentional, but worth watching in playtests.

**Tools:**
- `runBot(..., { levelCap })` measures how much a stage depends on Lv.5. Capping the smart bot at Lv.3 or Lv.4 doesn't change its results, which shows outcomes track total summons, not breakpoints.
- `runBeginnerBot` (described below) is the other measuring tool.
- `levelsElites.test.ts` guards the curve shape and the elite rules.

## Next release — Beginner balance fix (Chapter 1)

**Problem:** Stage 1-2 was far too hard for new players.
- V1.3 had raised its enemy HP multiplier from 2.0 to 3.7, with a steep per-wave ramp: the last wave had about 900 HP per mouse, 13× Stage 1-1's.
- Stages 1-3 and 1-4 were tighter still. Even the near-perfect "smart" bot had **0% headroom** there.
- Stage 1-4 opened with a wave made entirely of Zippy Mice.
- The existing balance bots never noticed because they play perfectly.

**Fix — stage configuration only, no global multiplier:**

| Stage | Before | After |
| --- | --- | --- |
| 1-2 | HP ×3.7, growth 0.23, 10 tiles, 12 fish | HP ×2.0, growth 0.12, **12 tiles, 14 fish** |
| 1-3 | ×5.0, growth 0.25 | ×4.3, growth 0.12 |
| 1-4 | ×5.42, growth 0.185, an all-Zippy wave 2 | ×4.5, growth 0.09, Zippy Mice mixed in gradually (never more fast than regular) |
| 1-5 | ×4.94, growth 0.18 | ×4.6, growth 0.10 |
| 1-6 | ×5.51, growth 0.10, armored ramp 0.6 + 0.08w | ×4.7, growth 0.075, gentler armored ramp |
| 1-7 | ×4.95, armored from wave 1 | ×4.6 with the **same final-wave HP**; no armored mice in waves 1–2 |
| 1-1, 1-8 → 1-10, Chapter 2 | — | unchanged |

**How it was measured:** a new **beginner bot** (`runBeginnerBot` in `bot.ts`) plays like a first-time player:
- fresh save, only the five original cats at 1★, no skins, 1× speed;
- one decision every 1.5–3.5 s;
- summons when it can, but notices a merge only ~35% of the time and then merges a random pair;
- never repositions or changes targeting;
- picks chest rewards at random;
- spends only part of its starting fish during the preparation phase.

A **struggling** variant reacts in 2.5–5 s and merges even less. Each was run 40 times per stage with ordinary random summons, including unlucky ones.

| Stage | Beginner before → after | Struggling after | Strong-player headroom before → after |
| --- | --- | --- | --- |
| 1-1 | 40/40 → 40/40 | 40/40 | +130% → +130% |
| 1-2 | **0/40 → 40/40** | 39/40 | +20% → +130% |
| 1-3 | **2/40 → 40/40** (some hearts lost) | 18/40 | **+0% → +45%** |
| 1-4 | **0/40 → 39/40** | 13/40 | **+0% → +45%** |
| 1-5 | 16/40 → 39/40 | 11/40 | +10% → +45% |
| 1-6 | 23/40 → 40/40 | 8/40 | +20% → +45% |
| 1-7 | 32/40 → 38/40 | 21/40 | +30% → +45% |
| 1-8 → 1-10 | 35–36/40 (unchanged config) | 13–19/40 | +45–60% (unchanged) |

Stages 1-1 and 1-2 are now near-certain wins while learning. Stage 1-3 is a real challenge for weak play (18/40 for the struggling profile) but fair for a normal beginner, and the curve has no cliffs. Late Chapter 1 keeps its difficulty for strong players.

Tutorials never use up preparation or combat time: lessons freeze the battle and the prep countdown (covered by `director.test.ts`). New `beginner.test.ts` guards all of this: win rates, no early fast or armored mice, no all-fast waves, and no HP jumps.

## What's new in V1.4 (4th public release)

Version numbers follow public releases: each deploy to production gets the next number (V1.3 → Chapter 2 → **V1.4** → V1.5 …). V1.4 bundles everything below. The number is set in `src/config/version.ts`.

### V1.4 · Skin Shop tutorial & Special Skins

- **Two kinds of skins** (`src/config/cosmetics.ts`; every price and bonus is configurable):

  | Type | Label | Effect | Price |
  | --- | --- | --- | --- |
  | **Regular / 普通造型** | 外觀限定・無能力加成 / Looks only · no stat bonus | Looks only. Every cat has one: the 5 originals (60) plus 5 new ones for the Chapter 2 cats (80). | 60–80 fish coins |
  | **Special / 特殊造型** | 附帶能力加成 / Includes a stat bonus | Looks plus one exact bonus for that species: **Attack +3%**, **Attack speed +3%** or **Range +2%**. One per cat (10 total), with a twinkling sparkle so they're recognisable on the field. | 220 (starter cats) / 260 (others) |

  Hats stay looks-only. The five skins sold before the skin update keep their ids and prices and stay *regular*: no purchase was converted into a stat item. Existing `owned` / `equipped` save data loads unchanged.
- **Rules:**
  - One skin per cat species, so bonuses never stack.
  - The bonus applies to every unit of that species at every Lv. (merging) and ★ rank, through `applySkinBonus` in `Battle.unitStats`. It is fixed for the battle and kept in battle-recovery snapshots (older snapshots restore with no bonus).
  - A cat's skin can only be bought once you own that cat; it shows as **未解鎖 / Locked** until then.
  - Any single bonus is capped at `SKIN_RULES.maxBonusPct` (5%), enforced by tests.
  - Special skins are never needed to clear a stage. With all special skins equipped, bot win rates at normal difficulty are identical to playing without them; they only help near the edge of difficulty (+15–30% enemy HP).
  - A full team of five special skins costs about 1,100–1,300 fish coins: a real choice next to recruiting (100) and stars (100–800), and well within what Chapters 1–2 pay.
- **Shop UI:** tabs 特殊造型 / 普通造型 / 帽子 (Special / Regular / Hats). Each card shows:
  - a preview on the right cat
  - which cat it's for
  - the type label and exact bonus
  - the price, or **裝備中 / 已擁有 / 未解鎖** (Equipped / Owned / Locked)

  Tapping any card opens a **preview** before buying: "now" vs "with this look" (animated), the bonus, and a Buy / Equip / Take-off / Locked message.
  The long-press details panel in battle shows 「造型加成：攻擊速度 +3%」 and the boosted stats.
- **Skin Shop intro:**
  - Shown once on Home after the first clear of Stage 1-3 (`SKIN_RULES.shopIntroAfterStage`), also for existing players already past it.
  - Kitten says 「儲咗魚幣未？除咗招募新貓，仲可以買靚衫畀貓咪著㗎！」 while a live preview cycles through default → regular skin → special skin. The two skin types are explained in one line each.
  - The Shop button is spotlighted (the other Home buttons are dimmed), with **去商店看看 / Take a look** or **稍後再看 / Maybe later**. Nothing has to be bought, and the buttons ignore taps for the first 0.7 s.
  - Revisit it any time with **造型介紹 / About skins** in the shop, or Home → Replay tutorials.

### V1.4 · Android Back gesture safety & battle recovery

Android's edge Back gesture (and refreshes, app switches and closed tabs) used to throw away the battle in progress. There are now three layers of protection. **Recovery is the one that matters**, because no web page can fully block Android's system Back gesture.

1. **Touch handling.**
   - The board, HUD and controls use `touch-action: none` and `overscroll-behavior: none`, and drags use Pointer Events with pointer capture. So the screen never scrolls, zooms or pull-to-refreshes during a drag, and a system-cancelled gesture (`pointercancel`) just cancels the drag.
   - Overlays, detail panels, results and menus keep normal vertical scrolling (`pan-y`, contained overscroll).
   - The board keeps a 14 px gutter at each screen edge, so the outermost cats sit further from the edge Back-gesture zone. It only takes effect when the board fills the width: on a 360–412 px Android phone the outer cats' centres are about 44–52 px from the edge.
   - System gestures are not intercepted.
2. **Safe Back.**
   - A battle adds one guard entry to the browser history. Back opens **「確定離開戰鬥？」 / "Leave Battle?"**, with **繼續遊戲 / Continue Playing** and **返回主頁 / Return Home**, and the battle pauses and is saved.
   - Continue restores the single guard entry, so the history never grows. A second Back while the sheet is open leaves normally (no trap), and recovery still applies.
   - `beforeunload` only asks for confirmation if the checkpoint could *not* be saved (storage blocked or full).
3. **Battle recovery** (`src/save/battleRecovery.ts`, `Battle.snapshot()` / `Battle.restore()`):
   - **What's saved:** the complete battle state as versioned JSON (about 10–30 KB) in `catdefense.battle.v1`. That covers stage, wave and spawn progress, the between-wave timers, hearts and fish, summon and skill cost progression, and every cat (level, tile, star rank, cooldown, wind-up, combo, ultimate queue, buffs). It also covers mice and chests (HP, shields, position, poison, marks, shred, slow), projectiles in flight, skills, ultimate charge, Mallow's team buff, a pending chest reward, focus target, team, stars, RNG state and game speed. Effects and other animation-only state are not saved.
   - **When it's saved:** after every player action, at wave and chest events, immediately after chest coins are paid (so an older checkpoint can't pay them twice), every 2 s of combat or prep countdown, and whenever the page is hidden (`visibilitychange`, `pagehide`, `beforeunload`).
   - **On reopening the game:** **「繼續上次戰鬥？」** offers **繼續上次戰鬥 / Resume Previous Battle** or **放棄戰鬥 / Discard Battle** (with a confirm). A resumed battle comes back **paused** (the Tactical Pause screen, or the menu during preparation) and continues exactly as it would have. A test runs the original and the restored battle side by side for 40 s, with actions, and they stay identical.
   - **No duplicates:**
     - Each attempt has a run id. On victory or defeat the checkpoint is deleted and the id goes into a finished-runs ledger (`catdefense.battle.done`, last 40), so an old copy of a won battle is never offered or rewarded again.
     - Finished, corrupted, outdated or mismatched records are discarded, never misread. A strict validator checks version, stage, waves, cat tiles, unique ids, finite numbers and status.
     - If the same battle is resumed in a second tab, the first tab stops and says so.
   - **When the checkpoint is cleared:** only after a completed battle, or a deliberate leave (menu → Stage select / Home, Leave Battle → Return Home, Restart, Discard).
   - **Browser checks (Chromium with Android device emulation and real CDP touch events, Pixel 7 zh-HK and Galaxy S9+ en):**
     - Drags and merges in the outermost columns work.
     - A drag that slides off the edge cancels cleanly.
     - Vertical swipes on the board, from the very edge and on the controls never scroll the page.
     - Back opens the sheet, freezes the battle and saves it, and 4 Back/Continue cycles add no history entries.
     - An app switch pauses and saves.
     - Refresh, and close-tab → reopen, both restore the exact state: cats, cooldowns, buffs, mice HP, poison, projectiles, skills, cost and speed.
     - Victory pays once, and a pre-victory copy put back into storage is rejected.
     - Return Home and Discard leave nothing behind.
     - The collection screen still scrolls with a finger.
   - **Not tested on real Android hardware** — please try it on a phone (see the checklist in the release notes).

### V1.4 · Combat pacing, Tactical Pause, clearer tutorials

- **Combat is 10% slower.** `BALANCE.speed.baseline` 1.2 → 1.08 (the old 1.2× pace minus 10%). The 0.5× / 0.75× / 1× / 1.5× / 2× options all scale from it. Enemy HP, armor, cat damage, wave counts, composition and bosses are unchanged. Because only the real-time pace changed, sim (game-time) balance is identical. The earlier "10% difficulty reduction" was not applied.
- **More breathing room between waves.**
  - When you clear the field you always get `clearedWaveGap + waveBreather` = 1.2 + 3 = 4.2 s of calm (about 3.9 real seconds at 1×), counted from the moment the last mouse falls. During it the HUD shows **「第 N 波：X 秒後」/ "Wave N in Xs"**. The countdown lives in the HUD label, so it never overlaps the wave banner or toasts.
  - When mice are still on the road, the next wave comes at the pressure cap `waveGap + waveBreatherHostile` = 4.5 + 1.5 s.
  - Sim results (naive bot, 10 seeds):
    - 0 restores the results from before the pacing update exactly.
    - 1.5 is slightly gentler in early Chapter 1 for weak play (1-4: 4 → 6/10 wins); smart-bot results are unchanged.
    - 3 on both gaps made 1-4 9/10, a clear difficulty drop, so it was not used.
  - All three values are in `src/config/balance.ts`.
- **Tactical Pause / 策略暫停.**
  - Freezes the entire simulation: movement, spawns, wave timers, cooldowns, wind-ups, projectiles, poison/marks and ultimate charge. While paused you can still move, swap and merge (full board and Lv.5 included), change targeting, open details and sell (same refund table).
  - Summoning and buying skills wait until you resume, so there are no free summons and no extra fish.
  - On screen: a slim 「策略暫停中」 badge and an outlined field. The Summon/Skill row turns into one big **繼續戰鬥** button in the thumb zone. There is no modal over the field.
  - The old pause is now the ☰ menu (Resume / Restart / Stage select / **Home**). Leaving the app opens the menu.
  - Moving a cat cancels its wind-up, so it re-targets from its new tile on resume.
  - Tests:
    - A combat-state snapshot is byte-identical after 600 paused updates.
    - Mashing pause/resume between frames gives exactly the same battle as never pausing: no duplicate damage, kills or fish.
  - Not available during the 20 s preparation phase, which is unchanged.
- **Tutorial clarity.**
  - New one-time **Tactical Pause lesson**, from stage 1-3 on, for new and existing players. It runs in three steps, and each one needs the real action: press 策略暫停 → drag a cat while paused → press 繼續戰鬥. If you already paused on your own, the first step is skipped.
  - Every completed action shows **「做得好！」/ "Nice!"**, and timers stay frozen for that 1 s beat.
  - Info cards ignore taps for the first 0.9 s, and cat reveal cards for 0.7 s, so a fast tap can't dismiss them unread.
  - **略過教學 / Skip tutorial** is on every lesson, with a confirm. It skips all scripted lessons; first-meeting cat/enemy/chest cards stay, and Home → Replay tutorials brings everything back.
  - Lessons can now run while paused (`whilePaused`), complete silently if the player already did the thing (`doneIf`), and accept several actions (`expect: [...]`).
- **Focus Targeting is experimental.**
  - Tap-to-focus sits behind `src/config/features.ts` → `focusTargeting`. It is on by default; override it with localStorage `catdefense.feature.focusTargeting` = `0`/`1` or the debug panel checkbox.
  - When it's off, taps on mice do nothing, no crosshair is drawn, and the hint text drops the focus line. The original five targeting modes are untouched.
  - Nothing in progression or the tutorials depends on it.

### V1.4 · Chapter 2 space fix, Hong Kong Chinese

- **Chapter 2 placement capacity.** The spiral map was 5 columns wide with only 19 buildable cells in total, so stages opened just 11 → 16 tiles. The map is now **6 × 8** (same 50 px cells, same spiral into the central cat house; the road and house moved one column right). On portrait phones the board is limited by its height, so the extra column fits in the spare width: measured tile size is unchanged on iPhone SE (46.5 px) and iPhone 13 (58.2 px); on very tall/narrow screens like Pixel 7 tiles go from 80 to ~69 px. Chapter 2 now opens **17, 18, 19, 19, 20, 21, 21, 22, 23, 23** tiles (2-1 … 2-10; Chapter 1 ends at 21). Enemy HP re-tuned with the bots; merges per stage roughly doubled.
- **Team of 4 or 5 species** (`TEAM_MIN` 4, `TEAM_SIZE` 5): optional — fewer species means more matching pairs. Default and existing teams stay at five.
- **Full board is never a dead end:** tapping Summon on a full board explains the options (merge, or long-press → Sell). Tests cover no-pair full boards (swap, sell, summon only into the freed tile, nothing overwritten) and that no tile can sit on the road or the house.
- **Chinese is now Chinese (Hong Kong), `zh-HK`, shown as 中文（香港）.** Every string was reviewed: consistent 魚乾 / 魚幣 / 召喚 / 合成 / 出售貓咪 / 特技（3★）/ 必殺技（5★）/ 集中攻擊 / 返回主頁, 虎紋戰士 (was 虎斑), 首領 (was 頭目), 芝士大王 (was 起司), HK wording (按 for taps, 甚麼, 姐姐, 繁忙時間…). Cantonese stays in character and story dialogue; instructions use concise written Hong Kong Chinese. Noto Sans HK / PingFang HK fonts. A saved `zh-TW` preference migrates automatically.

### V1.4 · Shorter stages, selling, story, 0.5×

- **~30% fewer waves everywhere** (`BALANCE.waves.countScale = 0.7`): e.g. 1-1 6 → 4, 1-3 10 → 7, 1-10 21 → 15, 2-10 21 → 15. Stage plans in `chapters.ts` keep their original length; the game stretches each plan's arc over the shorter stage, so wave sizes still run from the first to the last original size (~30% fewer mice in total, nothing crammed), every enemy type still appears, **every chest is kept** (same skill chances) and bosses stay in the final wave. The HP ramp follows the same progress. Dried fish per mouse ×1.25 and wave-clear bonus 3 → 4 keep summoning and Lv.5 reachable; the bots' win rates are unchanged.
- **Sell Cat / 出售貓咪** in the long-press panel: shows the exact refund, removes the cat and frees the tile immediately (refund `BALANCE.sell.refund` = Lv.1 1 · Lv.2 1 · Lv.3 3 · Lv.4 5 · Lv.5 9 dried fish; Lv.3+ ask to confirm). The suggested table (1/2/4/7/12) let Lv.2–3 cats sell back for 80–100% of their cheapest cost, so it was lowered; summon → sell can never gain fish (tested). Only during battle/preparation; never affects stars, fragments or the collection.
- **Chapter 1 → 2 story transition** (~11 s, three scenes: celebration in the moonlit forest → a mysterious glow beyond the trees → “Chapter 2 · Moonlit Mushroom Forest” reveal) with short Cantonese / English dialogue, Skip button and reduced-motion support. Plays once after the first clear of 1-10, then Sir Sable’s reward reveal; replay any time from Stage Select (Chapter 2 → Story). The reward is claimed and saved before the cutscene, so nothing can be awarded twice and taps underneath are blocked.
- **0.5× speed** added: 0.5× / 0.75× / 1× / 1.5× / 2× (1× is still the faster V1.3 baseline). The chosen speed is remembered between battles; the 20 s preparation timer is never affected.

### V1.4 · Cat collection, stars, new cats

**Two separate progressions**
- **In-battle level Lv.1–Lv.5** (merging, resets every battle) — unchanged.
- **Permanent star rank 1★–5★** (saved): modest stat growth per star, attack effects evolve (trails at 2★, sparkles at 4★, gold at 5★), **3★ unlocks a Special**, **5★ unlocks an Ultimate**. A 4★ cat still enters battle at Lv.1. Stars are always drawn as ★, levels as “Lv.”.
- Star-up costs fragments of that cat + fish coins (10/100 → 20/250 → 30/500 → 40/800). The preview shows exact stat changes, new effects, unlocks and cost; nothing is spent unless it succeeds. At 5★: MAX, and leftover fragments can be exchanged for coins.

**Ten cats** — the original five plus five new ones, each with a story, Cantonese signature line, Lv.1–5 gear, Special and Ultimate:

| Cat | Role | Base | 3★ Special | 5★ Ultimate |
| --- | --- | --- | --- | --- |
| Mr. Whiskers 燕尾服魔術師 | Ricochet | yarn bounces 2× (−30%/jump) | Endless Trick: every 4th +1 bounce | Hat of Wonders: giant ball, 8 bounces |
| Sir Sable 高冷劍士 | Pierce | straight sword wave hits all on the line | Armor-Piercing Form: −3 armor 3s | Moonshadow Slash: telegraphed long ×5 slash |
| Captain Mallow 溫柔隊長 | Support | +30% attack speed to nearby cats, no damage | Teamwork: nearby merge → +15% dmg | Everyone Together!: team +25% speed +15% dmg |
| Shadow Pounce 暗影獵手 | Execute | fast claws, ×2.2 below 35% HP | Hunting Instinct: post-kill strike ×2.5 | Shadow Pursuit: 6 strikes on wounded mice (bosses: normal hits) |
| Silver Devil 魔鬼銀漸層 | Poison | 6/s poison for 3s (ignores armor, refreshes) | Venomous Kiss: stacks up to 3 | Devil’s Pact: mark, ×2.5 poison, allies +15% (boss caps) |

Originals: Kitten (every 4th yarn ×2 / Heroic Burst), Tabby (finisher ×2 / 12-punch flurry), Orange (slammed mice +15% damage taken / Mega Belly Slam, no shake), Black Cat (every 3rd shot ignores 60% armor / Charged Shot at the toughest mouse), Noble White (every 3rd charm lasts 2× / Grand Royal Pose).

**Ultimates** fire automatically on one shared cooldown per species (22 s, starts half charged), performed by the highest-level copy that has a valid target — extra copies never spam it. A compact ring per species in the top-right of the board shows readiness.

**Collection, recruitment, team**
- Recruit (Home → Recruit) for 100 fish coins: every cat has the same chance (10%); duplicates give 10 fragments of that cat (5★ cats refund coins). **New-cat guarantee:** after 5 duplicates in a row, the 6th draw is a cat you don’t own. Odds and the counter are always shown. No real money.
- **Chapter rewards:** first clear of Chapter 1 → Sir Sable, Chapter 2 → Silver Devil (once each; also granted retroactively to players who already cleared them; an unowned new cat or fragments if already owned).
- **Battle team:** 5 species; random summons only pick from it (tutorial stages 1-1…1-6 keep their own cats). Edit it from Stage Select or the Collection; saved immediately. Existing players start with the original five.
- First time you get or summon a cat: an entrance (spotlight, drop-in, name and line), then its profile — the battle and prep timer stay paused.

**UX**
- **Tap-to-focus:** tap a mouse or chest to focus it (gold crosshair); cats that can reach it attack it first; tap again to cancel; clears when it dies or escapes.
- Chest skill cards show real on-field counts: “On field: 3 · Lv.1 ×2 / Lv.2 ×1”.
- Long-press details: Lv. and ★ separately, current stats (stars, skills and buffs included) vs. the next level (MAX at Lv.5), role stats (bounces, wave length, buff, execute, poison) and Special/Ultimate status.
- Encyclopedia profiles: star rank, fragments, upgrade, Special/Ultimate (locked/unlocked), ★1–★5 evolution, and a **live demo running the real combat engine** with a ★ selector to preview each star’s effects.

Tuning lives in `src/config/collection.ts` (stars, costs, recruitment, team size, chapter rewards, every Special/Ultimate, ultimate cooldown) and `src/config/cats.ts` (base stats). Save format v3 migrates older saves automatically.

## What's new in V1.3

**Gameplay reliability**
- **Tiered summon cost:** 1,1,1 → 2,2,2 → 3,3,3 … (`BALANCE.summon.tierSize` / `perTier` / `base` / `maxCost`). Resets every stage.
- **20-second preparation phase** at the start of every stage: no enemies; summon, move, swap and merge freely. The countdown is in *real* seconds (game speed doesn't touch it), pauses during tutorials, detail panels, the pause menu and hidden tabs, and a **Start Battle / 開始戰鬥** button begins wave 1 immediately. Combat can only start once (`Battle.startBattle()` is idempotent). Tune with `BALANCE.prepSeconds`.
- **Speed system:** the new 1× runs the simulation at the old 1.2× (`BALANCE.speed.baseline`). Options 0.75× / 1× / 1.5× / 2× (`BALANCE.speed.options`). Everything in the simulation scales (movement, cooldowns, wind-ups, projectiles, spawns, wave timers, slows); UI animations and the prep timer do not.
- **More room from Stage 1-3:** 8 → 10 → 14 tiles, then +1 per stage up to 21 at 1-10 (`tiles` in `chapters.ts`).
- **Fair chests:** heavier = slower (bronze 60 HP / fast, silver 190 / medium, gold 360 / slow). Chest HP scales gently by stage (`BALANCE.chest.hpPerStage`) but no longer rides the per-wave enemy HP ramp. Compact chest HP bar.
- Orange's slam no longer shakes the whole screen; the impact is shown with a local shockwave ring instead.

**UX & tutorials**
- Shorter, playful tutorial lines (English + Cantonese-style 繁中, e.g. 「召喚貓咪好平㗎！快啲試吓！」). Small details such as cost increments are left out.
- Stage 2 speed tip once mice are walking: 「覺得老鼠行得太慢？試吓調整遊戲速度！」, which points at the speed button.
- Skill cards: big effect icon → small owner badge (the real cat's portrait, or a team-paw icon for universal skills) → name → NEW / Lv → description. The same badges appear on skill chips and the "new skill" pop.
- Victory screen: staggered star animation with bursts, why each star was earned, hearts kept, a per-battle reward summary (first clear / clear reward / chest rewards / battle total) and the current fish-coin balance. Buttons: **Next Stage / Replay / Home** (下一關 / 再玩一次 / 返回主頁).

**Chapter 2 — Moonlit Mushroom Forest / 月夜蘑菇森林 (stages 2-1 to 2-10)**
- 20 playable stages in two chapters. Chapter 2 unlocks when 1-10 is cleared, and every cleared stage stays replayable.
- **New map** (`MUSHROOM_MAP` in `maps.ts`): same 5×8 portrait grid, but the road enters from the **top** and **spirals inward** to a cat house in the **middle**. Inner tiles sit between two or three road passes; edge tiles cover far less. Tiles grow from 11 to 16 across the chapter.
- **Environment:** giant spotted toadstools instead of trees, stepping-stone road, a mushroom fairy ring around the house, glowing mushroom lamps and drifting spores. Both themes get their own ground, road and roof colours (`ENV_OVERRIDES` in `theme/palettes.ts`).
- **Difficulty** uses only existing enemies and systems: bigger and more mixed waves, faster spawns, steeper per-wave HP, more speed variety (Zippy Mice alongside slow Acorn Knights) and extra armor on armored mice (`armorBonus`). No new mechanics or cats.
- **Boss — Mushroom King / 蘑菇鼠王 (2-10):** its giant cap is a shield (glows while intact, cracks once broken), with armor and huge HP underneath. It is slow, but escaping costs 8 hearts.
- **Saves:** existing progress is untouched. On load, every cleared stage unlocks the next one, so players who finished 1-10 before this update find 2-1 open.
- **Adding a chapter:** add a map to `maps.ts`, a stage list to `chapters.ts` and the `chapter.<id>` / `stage.<id>` names to the i18n files. Unlocks, stage select, results and the skill-shop unlock (global `order`) work automatically.

**Art direction**
- Main menu emblem (cat ears + crescent moon + paw), layered scenery (twinkling stars, moon glow, forest silhouettes) in both themes, and icon buttons for Shop and Cats.
- One SVG icon set (`src/ui/components/GameIcon.tsx`) replaces the emoji in the main UI.
- Battlefield: compact targeting badge at the tile corner, smaller and fainter locked tiles, clearer route chevrons, shorter wave banners, impact sparks on hits, a golden glow under chests.
- Idle personality: Orange dozes ("z z"), Kitten tilts its head, Tabby hops, Black glances around, White sparkles.

## V1.2 — Character identity & visual themes

### Five cats that fight very differently
All values below are for Lv.1 with no skills. Merging improves a cat's existing strengths; it never changes its role.

| Cat | hit | attacks/s | range | how it attacks |
| --- | --- | --- | --- | --- |
| Kitten | 10 | 1.43 | 1.76 tiles | steady yarn balls; the baseline |
| Tabby Warrior | 3.5 × 3 | 2.0 combos (6 hits) | 1.12 tiles | punches land one by one, 0.08 s apart; poor vs armor |
| Chubby Orange | 28 | 0.45 | 1.4 tiles | 0.7 s wind-up (target circle shown), then the slam hits every mouse within 1.16 tiles at once. It lands where the target **was**, so fast mice can slip away |
| Black Cat | 46 | 0.33 | 3.2 tiles | 0.6 s aim with a red line and crosshair, then one heavy shot |
| Noble White | 0 | 0.45 | 1.64 tiles | poses; mice in the aura glow pink and walk 45% slower for 2 s (their legs slow down too) |

`npm test` prints a Lv.1 comparison of damage dealt in five scenarios (`src/game/__tests__/catIdentity.test.ts`):

| Cat | dense pack | scattered | fast | armored | one huge mouse |
| --- | --- | --- | --- | --- | --- |
| Kitten | 140 | 420 | 238 | 116 | 100 |
| Tabby | 137 | 347 | 273 | 67 | 63 |
| Orange | 945 | 439 | 379 | 426 | 84 |
| Black | 238 | 470 | 278 | 440 | 230 |

Paired with Noble White, the other cats turn their damage into far more kills (Orange goes from 0/8 to 8/8 in the sparse test).

### Visual themes: Original Light / Moonlit Gothic
Switch on the Home screen. The choice is stored in `catdefense.theme`, separate from the save, so switching never touches progress, stats or combat.
- **UI colors** are CSS tokens: `:root` holds the light theme and `:root[data-theme='moonlit']` the dark one, both at the top of `src/styles.css`. A test fails if a token is defined in terms of itself.
- **Battlefield colors** live in `src/theme/palettes.ts`. Moonlit uses a sandy road on deep-sage ground, gold-rimmed plum tiles with a lighter centre (so the Black Cat stays visible), lanterns, glowing mushrooms, fireflies and a lit cottage. Tests check the contrast.

### Cat encyclopedia
- **Collection overview** (Home → Cats): a card per cat with portrait, name, role and discovered state. Undiscovered cats appear as silhouettes with the stage they first appear in, and can't be opened.
- **Profile page** for each discovered cat:
  - large illustration and title, personality and story
  - role and attack type
  - a Lv.1–Lv.5 picker that updates the illustration, gear description and stats (bars compare all five cats at that level)
  - extra stats: combo, splash, wind-up/aim, slow
  - a looping signature-attack demo that uses the cat's real timing values
  - strengths and weaknesses, and its three character skills
- **Still placeholder art:** every cat, mouse, chest, tree and house is drawn programmatically, and the attack demo is a scripted canvas animation. Level gear is drawn as layers in `drawBodyGear()` in `src/render/sprites.ts`, separate from combat. Replacing those functions with illustrated assets needs no gameplay changes.

## What's new in V1.2 (gameplay)

- **One tutorial battle.** Stage 1 now teaches every basic control in sequence: summon, auto-attack, tap to retarget, summon a small team, move, swap and merge. The swap and merge lessons place any cats they need, so they can't get stuck. Stage 2 is pure practice; its lessons only appear for players who finished Stage 1 before V1.2. Cat, enemy and chest introductions still appear only once, ever.
- **Gentle summon costs:** 1, 2, 3, 4, 5 … (+1 per summon, reset every stage). Lv.1 cats hit about 25% softer, but every merge doubles damage. The loop is now many weak cats → merge and reposition → fewer strong cats → summon again. In the bot runs, summons per stage roughly doubled (15–60) and merges roughly tripled (10–50).
- **Long-press cat details.** Hold a cat to see its level, effective damage, attack speed, range, DPS, splash/slow stats, targeting mode and active skills, with base values crossed out when an upgrade changed them. Tap and drag behave exactly as before.
- **Compact beginner map.** Chapter 1 now uses a 5×8 board instead of 7×11, about half the footprint. Cats, tiles, mice and chests render about 40% larger on a phone. It's the same S-route with three passes; the old map is kept for future chapters.
- **Character skills.** There are 3 skills per cat plus 4 general ones:
  - **Kitten:** Brave Paws, Explorer Eyes, Zoomies
  - **Tabby Warrior:** Flurry Paws, Quick Jabs, Champion Punch
  - **Chubby Orange:** Big Belly, Belly Slam, Aftershock
  - **Black Cat:** Steady Aim, Deadeye, Long Scope
  - **Noble White:** Dazzling Grace, Lingering Charm, Radiant Beauty

  Offers favour cats you actually have on the board. At least 2 of every 3 chest choices are useful for your current formation, and chest cards say who each skill is for.
- **Faster pacing.** Shorter wave gaps (4.5 s, or 1.2 s once the field is clear), a quicker first wave, snappier summon and merge animations. Upgraded cats bounce and show the skill icon, and the skill pop shows which cat it boosts.

## What's new in V1.1

- **Interactive tutorial** (`src/tutorial/`). Lessons pause the battle completely: no movement, attacks, spawning or wave timers. They spotlight the relevant button, cat, tile or enemy and show an animated hand. Interactive lessons wait for the real action, and any other action is blocked with a hint. Simple lessons wait for Continue; nothing auto-dismisses.
  - Stage 1: summon → auto-combat → tap a cat to change targeting → the 5 modes.
  - Stage 2: move → swap → merge. The stage starts with two Kittens and a Tabby, and the merge lesson adds a Kitten if needed, so it can never get stuck.
  - Stage 4: targeting tips (right after meeting Zippy Mice).
  - Stage 5: Random Skill unlocks. The first roll is free, then a note explains that duplicates level up.
- **First-time introductions:** each cat species, enemy type and chest tier is introduced once per player, when it is first actually summoned or seen on the road. Never at stage start, and never twice, even across stages or browser refreshes.
- **Economy:** stages start with 12 dried fish. Summons cost 1, 2, 3, 5, 7, 9 … and the cost resets every stage. Kill rewards are smaller but steadier.
- **Swap:** drop a cat on a different cat to swap places directly.
- **Longer, harder battles:** 6–21 waves per stage. Enemy HP climbs *during* each stage on a curve, so the opening is gentle and the late waves need a real formation.
- **Feature unlocks:** the Random Skill button is locked (🔒) until Stage 5.
- **繁體中文 / English:** switch on the home screen; the choice is saved. Every player-facing string is translated.
- **Feedback:**
  - summon light-beam and pop, and a "+N" bubble when the summon price rises
  - bigger merge burst with a "Lv.N!" label
  - enemy hit wobble and a white HP damage trail
  - spinning rays and flying coins when a chest opens
  - a centred "new skill" pop, with cats sparkling as the chip flashes
  - wave banners with a progress bar
  - dancing cats and staggered stars on victory, and a "Close call!" title when you win with ≤3 hearts

## Developer balance panel

Open the game with **`?debug`** (or tap the version label on the home screen 5×; `?debug=0` turns it off). A 🛠 button appears in battle with:

- Start fish override, summon cost ×, enemy HP ×, enemy speed ×, enemies per wave ×, wave/spawn interval ×, cat damage ×.
- Apply & restart.
- Game speed 0.5×–8×, and +50 fish.

With debug on, the results screen also shows battle stats: duration, base HP left, cats summoned, merges, moves/swaps, target changes, skills (shop/chest), fish earned/spent, enemies defeated/escaped, chests opened/missed.

## Where to tune balance

| What | File |
| --- | --- |
| **Summon cost** (`summon.base`, `summon.tierSize`, `summon.perTier`, `summon.maxCost`), **prep time** (`prepSeconds`), **game speed** (`speed.baseline`, `speed.options`), chest HP per stage (`chest.hpPerStage`), skill cost, wave timing, HP ramp curve, **level multipliers** (`levels.damageMult`), armor rule, skill-shop unlock stage | `src/config/balance.ts` |
| Each stage: waves (`buildWaves` count/growth/interval/mix/chests), `hpScale`, `waveHpGrowth`, **unlocked tiles**, roster, rewards; which map the chapter uses (`mapId`) | `src/config/chapters.ts` |
| **Map dimensions**: `FOREST_COMPACT_MAP` (cols, rows, path waypoints, every possible tile) and the old larger `FOREST_MAP` | `src/config/maps.ts` |
| **Cat stats** (Lv.1 damage, range, interval, combo + `comboGap`, splash, `windup`, slow); the identity table is in the header comment | `src/config/cats.ts` |
| **Theme colors**: UI tokens / battlefield palettes | `src/styles.css` (top) / `src/theme/palettes.ts` |
| Encyclopedia text (stories, gear names, signature attacks) | `src/i18n/en.ts`, `src/i18n/zh.ts` (`cat.<id>.story`, `gear.<id>.<lv>`, `cat.<id>.signature`) |
| Enemy and chest stats / rewards / chest skill-tier weights | `src/config/enemies.ts` |
| **Skills** (per-level effects, max levels) and **skill probabilities** (`SKILL_WEIGHTS`: general vs on-board vs roster-only cats, chest relevance guarantee) | `src/config/skills.ts` |
| Tutorial lessons per stage | `src/tutorial/steps.ts` |
| All text (EN / 繁中) | `src/i18n/en.ts`, `src/i18n/zh.ts` |

`npm run sim` plays every stage 10× with a *naive* bot (never moves cats) and a *smart* bot (keeps strong cats on the best tiles). Both always take the first chest option and never change targeting, so a real player should do better. Current results:

| Stage | naive wins | smart wins | avg length (sim time) | summons (smart) |
| --- | --- | --- | --- | --- |
| 1 | 10/10 | 10/10 | 1.2 min (+ prep / tutorial) | 26 |
| 2–3 | 9–10/10 | 10/10 | 2.7–3.2 min | 52–65 |
| 4–6 | 6–9/10 | 10/10 | 4.8–5.5 min | 89–106 |
| 7–9 | 6–7/10 | 8–9/10 | 5.4–6.5 min | 87–120 |
| 10 | 8/10 | 8/10 | 7.7 min | 127 |
| 2-1 – 2-3 | 8–10/10 | 10/10 | 4.1–5.1 min | 30–39 |
| 2-4 – 2-6 | 9–10/10 | 9–10/10 | 5.7–5.8 min | 38–52 |
| 2-7 – 2-9 | 9/10 | 10/10 | 6.4–7.7 min | 57–74 |
| 2-10 (boss) | 9/10 | 9/10 | 8.3 min | 66 |

Chapter 2 is tuned by *headroom*: how much extra enemy HP the smart bot can still beat 7/10 times. Chapter 1's late stages sit at about +15–20%. Chapter 2 starts gentler on its new map (2-1 ≈ +45%), then tightens steadily to about +10% at 2-10. Lengths are simulation time; at the default 1× (= 1.08× sim speed since the V1.4 pacing update) a real battle takes about 1/1.08 of that, plus up to 20 s of preparation. The bots open nearly every chest, so chests are reachable without perfect targeting.

## Project layout

```
src/
  config/      content & balance (edit these first)
  game/        pure simulation, no DOM (battle, combat, targeting, bot)
  tutorial/    lesson director + per-stage steps (separate from combat)
  i18n/        t(), language store, en.ts, zh.ts
  render/      Canvas 2D renderer + programmatic placeholder sprites
  save/        localStorage persistence (coins, unlocks, stars, cosmetics, seen intros)
  ui/          React screens, tutorial overlay, debug panel
```

## Save data

The save stays under the same localStorage key (`catdefense.save.v1`), and existing V1 saves load unchanged. V1.1 adds a `seen` list of completed tutorials and introductions; `parseSave()` fills it with `[]` for old saves (version 1 → 2). Home → "Replay tutorials" clears only that list. The language is stored separately in `catdefense.lang`, and debug settings in `catdefense.debug`. An unfinished battle is checkpointed separately in `catdefense.battle.v1`, with its own version plus `Battle`'s `SNAPSHOT_VERSION`, so a bad battle record can never touch progression. Finished run ids are kept in `catdefense.battle.done`.

## Deploying to Vercel

It's a static Vite app, so no server or env vars are needed. Vercel auto-detects Vite (build `npm run build`, output `dist`).
