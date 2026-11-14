#!/usr/bin/env node
// DEV TOOL — export the Lv.1–5 comparison sheets (tools/level-sheets.html) as PNG files.
//
//   npm run sheets                         all cats, enlarged + phone size, into ./level-sheets/
//   npm run sheets -- --cats=sable,mallow  only some cats
//   npm run sheets -- --views=phone        only the phone-size sheets
//   npm run sheets -- --hat=hat_crown      wear a shared hat (checks hat stacking)
//   npm run sheets -- --out=some/dir
//
// For each view it writes one sheet with every cat (all-<view>.png) and one per cat
// (<cat>-<view>.png). Phone sheets are rendered at a Pixel 7's pixel density, so they match a real
// Android battle screenshot. Needs Playwright with Chromium:
//   npm i -D playwright && npx playwright install chromium
// (If Playwright isn't available, open the page in a browser instead: `npm run dev`, then
//  http://localhost:5173/tools/level-sheets.html — it has a Download PNG button.)

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  }),
);
const out = resolve(args.out ?? 'level-sheets');
const views = (args.views ?? 'art,phone').split(',');
const PHONE_DPR = 2.625; // Pixel 7

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('Playwright is not installed. Either run:\n  npm i -D playwright && npx playwright install chromium\n' +
    'or open http://localhost:5173/tools/level-sheets.html after `npm run dev` and use its Download PNG button.');
  process.exit(1);
}

const server = await createServer({ logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
mkdirSync(out, { recursive: true });

// Which cats exist (read from the game config through the dev server, so new cats appear automatically).
const probe = await browser.newPage();
await probe.goto(`${base}/tools/level-sheets.html`);
await probe.waitForFunction('window.__sheetReady === true');
const cats = (args.cats ?? (await probe.evaluate(async () => (await import('/src/config/cats.ts')).CAT_ORDER.join(',')))).split(',');
await probe.close();

let failed = false;
const written = [];
for (const view of views) {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: view === 'phone' ? PHONE_DPR : 2 });
  page.on('pageerror', (e) => {
    failed = true;
    console.error(`page error (${view}):`, e.message);
  });
  for (const subset of ['all', ...cats]) {
    const q = new URLSearchParams({ view, ...(subset === 'all' ? (args.cats ? { cats: args.cats } : {}) : { cats: subset }), ...(args.hat ? { hat: args.hat } : {}) });
    await page.goto(`${base}/tools/level-sheets.html?${q}`);
    await page.waitForFunction('window.__sheetReady === true');
    const file = resolve(out, `${subset}-${view}.png`);
    await page.locator('#sheet').screenshot({ path: file });
    written.push(file);
  }
  await page.close();
}
await browser.close();
await server.close();
console.log(`Wrote ${written.length} sheets to ${out}`);
process.exit(failed ? 1 : 0);
