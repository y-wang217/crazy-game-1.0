# Cat Defense / 喵喵防衛隊 (working title)

A cute, mobile-first, portrait tower-defense game. Summon random cats, drag them around, swap and merge them, set per-cat targeting, grab skills and crack open treasure chests to protect the fish from forest mice.

**Current version: V1.1.** Chapter 1 "Beginner Forest" has 10 stages, 5 cats, 5 enemy types (including a boss), bronze/silver/gold chests, 8 skills, two currencies and a cosmetic shop. The game is fully playable in English and Traditional Chinese, with a step-by-step tutorial and a developer balance panel.

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
| Pick a chest reward (combat is paused) | Tap one of the 3 cards |
| Pause / speed | Ⅱ and 1×/2× in the top bar |

While dragging, tiles are tinted to show what the drop will do: green = move, gold = merge, blue = swap. A press only becomes a drag after the pointer moves 10 px, so a tap never moves a cat by accident.

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
| Summon cost table, skill cost, wave timing, HP ramp curve, level scaling, armor rule, skill-shop unlock stage | `src/config/balance.ts` |
| Each stage: waves (`buildWaves` count/growth/interval/mix/chests), `hpScale`, `waveHpGrowth`, tiles, roster, start cats, rewards | `src/config/chapters.ts` |
| Cat stats | `src/config/cats.ts` |
| Enemy and chest stats / rewards | `src/config/enemies.ts` |
| Skill values | `src/config/skills.ts` |
| Tutorial lessons per stage | `src/tutorial/steps.ts` |
| All text (EN / 繁中) | `src/i18n/en.ts`, `src/i18n/zh.ts` |

`npm run sim` plays every stage 10× with a *naive* bot (never moves cats) and a *smart* bot (keeps strong cats on the best tiles). Both always take the first chest option and never change targeting, so a real player should do better. Current results:

| Stage | naive wins | smart wins | avg length |
| --- | --- | --- | --- |
| 1 | 10/10 | 10/10 | 1.7 min (+ tutorial) |
| 2–3 | 9–10/10 | 9–10/10 | 3.3–3.7 min |
| 4–6 | 8–9/10 | 8–10/10 | 5.5–6.4 min |
| 7–9 | 4–8/10 | 7–8/10 | 6.0–6.2 min |
| 10 | 6/10 | 7/10 | 7.7 min (winning runs ≈ 8+) |

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
