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
| Pause / speed | Ⅱ and 1×/2× in the top bar |

While dragging, tiles are tinted to show what the drop will do: green = move, gold = merge, blue = swap. A press only becomes a drag after the pointer moves 10 px, so a tap never moves a cat by accident.

## What's new in V1.2

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
| **Summon cost** (`summon.base`, `summon.perSummon`, `summon.maxCost`), skill cost, wave timing, HP ramp curve, **level multipliers** (`levels.damageMult`), armor rule, skill-shop unlock stage | `src/config/balance.ts` |
| Each stage: waves (`buildWaves` count/growth/interval/mix/chests), `hpScale`, `waveHpGrowth`, **unlocked tiles**, roster, rewards; which map the chapter uses (`mapId`) | `src/config/chapters.ts` |
| **Map dimensions**: `FOREST_COMPACT_MAP` (cols, rows, path waypoints, every possible tile) and the old larger `FOREST_MAP` | `src/config/maps.ts` |
| **Cat stats** (Lv.1 damage, range, interval, combo, splash, slow) | `src/config/cats.ts` |
| Enemy and chest stats / rewards / chest skill-tier weights | `src/config/enemies.ts` |
| **Skills** (per-level effects, max levels) and **skill probabilities** (`SKILL_WEIGHTS`: general vs on-board vs roster-only cats, chest relevance guarantee) | `src/config/skills.ts` |
| Tutorial lessons per stage | `src/tutorial/steps.ts` |
| All text (EN / 繁中) | `src/i18n/en.ts`, `src/i18n/zh.ts` |

`npm run sim` plays every stage 10× with a *naive* bot (never moves cats) and a *smart* bot (keeps strong cats on the best tiles). Both always take the first chest option and never change targeting, so a real player should do better. Current results:

| Stage | naive wins | smart wins | avg length | summons / merges (smart) |
| --- | --- | --- | --- | --- |
| 1 | 10/10 | 10/10 | 1.3 min (+ tutorial) | 15 / 10 |
| 2–3 | 6–10/10 | 10/10 | 2.8–3.3 min | 27–31 / 20–22 |
| 4–6 | 7–8/10 | 8–10/10 | 4.8–5.6 min | 45–54 / 36–42 |
| 7–9 | 4–7/10 | 7/10 | 4.8–5.2 min | 40–52 / 30–39 |
| 10 | 2/10 | 7/10 | 6.8 min | 63 / 50 |

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

The save stays under the same localStorage key (`catdefense.save.v1`), and existing V1 saves load unchanged. V1.1 adds a `seen` list of completed tutorials and introductions; `parseSave()` fills it with `[]` for old saves (version 1 → 2). Home → "Replay tutorials" clears only that list. The language is stored separately in `catdefense.lang`, and debug settings in `catdefense.debug`.

## Deploying to Vercel

It's a static Vite app, so no server or env vars are needed. Vercel auto-detects Vite (build `npm run build`, output `dist`).
