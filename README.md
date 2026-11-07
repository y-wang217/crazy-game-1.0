# Cat Defense (working title)

A cute, mobile-first, portrait tower-defense prototype. You summon random cats, drag them around, merge them, set per-cat targeting, grab skills and crack open treasure chests to protect the fish from forest mice.

**V1 scope:** Chapter 1 "Beginner Forest" has 10 stages on a single S-shaped road. There are 5 cat types, 5 enemy types (including a boss), bronze/silver/gold chests, 8 skills, two currencies and a cosmetic shop. Progress is saved in localStorage.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test             # unit tests + headless balance report
npm run sim          # balance report only
npm run build        # type-check + production build into dist/
```

**Phone testing:** while `npm run dev` is running, open the "Network" URL Vite prints on your phone (same Wi-Fi).
**Desktop:** open DevTools → device toolbar (Ctrl/Cmd+Shift+M) → pick a phone such as iPhone 12/13.

## Controls

| Action | Input |
| --- | --- |
| Summon a random cat (random free tile) | **Summon Cat** button |
| Buy one random skill | **Random Skill** button |
| Move a cat (free, unlimited) | Drag it to an empty tile |
| Merge (same type + same level) | Drag it onto the matching cat |
| Cycle targeting: First → Nearest → Strongest → Weakest → Treasure | Tap the cat |
| Pick a chest reward (combat is paused) | Tap one of the 3 cards |
| Pause / speed | Ⅱ and 1×/2× in the top bar |

A press only becomes a drag after the pointer moves 10 px (`BALANCE.dragThresholdPx`), so a tap never moves a cat by accident.

## Project layout

```
src/
  config/            ← all content & balance numbers (edit these first)
    balance.ts       costs, wave timing, level scaling, armor rule, slow cap, stars
    cats.ts          5 cats: damage, range, interval, combo/splash/slow params, colours
    enemies.ts       mice + boss stats, chest HP / coin ranges / skill-tier weights
    skills.ts        8 skills, max levels, per-level values
    chapters.ts      chapters → stages: roster, unlocked tiles, waves, rewards
    maps.ts          grid, S-path waypoints, every possible placement tile
    cosmetics.ts     shop items (hats + fur skins), visual only
  game/              ← pure simulation, no DOM (unit-testable)
    battle.ts        Battle class: state machine, waves, attacks, summon/merge/move, chests
    combat.ts        damage formula, shield, skill modifiers, effective cat stats
    targeting.ts     the 5 targeting modes
    path.ts, rng.ts  path geometry, seeded RNG
    progression.ts   stars, stage rewards, next stage
    bot.ts           naive auto-player for headless balance checks
  render/            ← Canvas 2D drawing only
    renderer.ts      battlefield, effects, drag highlights, range rings
    sprites.ts       programmatic placeholder art (cats, mice, chests, hats)
  save/store.ts      localStorage persistence (coins, unlocks, stars, cosmetics)
  ui/                ← React screens: Home, Stage select, Battle, Shop, Cat guide
```

**Engine choice:** there is no game engine. A hand-rolled Canvas 2D renderer draws the battlefield, and React draws the menus and HUD. For a single-screen 2D defense game this keeps the bundle around 70 KB gzipped and the simulation 100% testable without a browser. It also avoids learning engine conventions. To use real art, replace the functions in `render/sprites.ts` with `drawImage` calls. Gameplay code doesn't need to change.

## Key rules (as implemented)

- **Damage:** `damage = max(raw − armor, raw × 20%)`. Shields absorb damage before HP. One rule covers everything. Many small hits (tabby) are weak against armor; big hits (black cat, orange cat, merged cats) ignore most of it.
- **Levels:** 5 max. Each merge gives about ×1.8 damage plus +6% range and +6% attack speed. Merging frees a tile and concentrates power, but it doesn't beat two separate cats on raw DPS, so keeping duplicates stays a real choice.
- **Targeting:** all modes only look within range. Non-treasure modes prefer mice and only hit chests when no mouse is in range. Treasure prefers chests, otherwise it falls back to First. White cat: her pulse slows everything in range, and her targeting picks a "focus" that gets an extra +15% slow.
- **Slow:** doesn't stack. The strongest active slow applies, capped at 70%.
- **Dried fish (battle):** start amount per stage, plus rewards from kills and a wave-clear bonus. Summon cost starts at 20 and rises +3 per summon (cap 60). Skill cost starts at 40 and rises +12 per roll (cap 120).
- **Fish coins (persistent):** stage clear (more the first time) plus chest coins. Chest coins are saved the moment a chest breaks, so you keep them even if you lose.
- **Chests:** they walk the road with their own HP. Breaking one pauses combat and offers 3 random skills (bronze/silver: +1 level; gold: +2 levels). Better tiers weight toward "improved" skills. Skills for cats not in the stage roster are never offered.
- **Stars:** 3★ = no base HP lost, 2★ = at least 50% kept, 1★ = survived.

## Balance report

`npm run sim` plays every stage 12 times with a deliberately naive bot that never repositions, never changes targeting and always picks the first chest option. It prints win rates. Current provisional numbers: stages 1–6 are almost always won, stages 7–10 are around 35–75%. A human using positioning and targeting should do noticeably better. Tune `hpScale` in `chapters.ts` and the numbers in `balance.ts`, then re-run.

## Deploying to Vercel

It's a static Vite app, so no server or env vars are needed. Import the repo in Vercel; it auto-detects Vite (build `npm run build`, output `dist`). Or deploy from the CLI:

```bash
npx vercel
```
