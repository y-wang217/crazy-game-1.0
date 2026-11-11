import { CAT_ORDER, TARGET_MODES } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { COSMETICS } from '../../config/cosmetics';
import { CHESTS, ENEMIES } from '../../config/enemies';
import { SKILL_ORDER } from '../../config/skills';
import { STAGE_STEPS } from '../../tutorial/steps';
import { en, getLang, setLang, t, zh } from '../index';

describe('i18n', () => {
  it('English and Traditional Chinese have exactly the same keys', () => {
    const a = Object.keys(en).sort();
    const b = Object.keys(zh).sort();
    expect(b.filter((k) => !a.includes(k))).toEqual([]);
    expect(a.filter((k) => !b.includes(k))).toEqual([]);
  });

  it('placeholders match between languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(en)) expect([k, ph(zh[k])]).toEqual([k, ph(en[k])]);
  });

  it('every content id has a translation', () => {
    const keys: string[] = [];
    for (const c of CAT_ORDER) {
      for (const f of ['name', 'title', 'personality', 'role', 'attack', 'strengths', 'weaknesses', 'story', 'signature']) keys.push(`cat.${c}.${f}`);
      for (let lv = 1; lv <= 5; lv++) keys.push(`gear.${c}.${lv}`);
    }
    for (const a of ['projectile', 'combo', 'slam', 'snipe', 'aura']) keys.push(`attack.${a}`);
    keys.push('theme.light', 'theme.moonlit');
    for (const e of Object.keys(ENEMIES)) for (const f of ['name', 'strength', 'behavior', ...(e === 'fast' ? [] : ['tip'])]) keys.push(`enemy.${e}.${f}`);
    for (const c of Object.keys(CHESTS)) keys.push(`chest.${c}.name`, `chest.${c}.desc`);
    for (const s of SKILL_ORDER) keys.push(`skill.${s}.name`, `skill.${s}.desc`);
    for (const m of TARGET_MODES) keys.push(`mode.${m}`, `mode.${m}.short`, `mode.${m}.desc`);
    for (const c of COSMETICS) keys.push(`cosmetic.${c.id}.name`, `cosmetic.${c.id}.desc`);
    for (const ch of CHAPTERS) {
      keys.push(`chapter.${ch.id}`);
      for (const s of ch.stages) keys.push(`stage.${s.id}`);
    }
    for (const steps of Object.values(STAGE_STEPS))
      for (const s of steps) {
        // Tutorial steps use tut.<name>.*; lesson steps (e.g. pierce:move) use pierce.move.*.
        const base = s.id.startsWith('tut:') ? `tut.${s.id.slice(4)}` : s.id.replace(':', '.');
        keys.push(`${base}.title`, `${base}.body`);
      }
    for (const k of keys) {
      expect([k, k in en]).toEqual([k, true]);
      expect([k, k in zh]).toEqual([k, true]);
    }
  });

  it('switches language and fills parameters', () => {
    const before = getLang();
    setLang('en');
    expect(t('battle.wave', { n: 2, total: 9 })).toBe('Wave 2/9');
    expect(t('battle.summon')).toBe('Summon Cat');
    setLang('zh-HK');
    expect(t('battle.summon')).toBe('召喚貓咪');
    expect(t('battle.skill')).toBe('隨機技能');
    expect(t('cat.orange.name')).toBe('肥橘');
    expect(t('cat.tabby.name')).toBe('虎紋戰士');
    expect(t('currency.coins')).toBe('魚幣');
    expect(t('currency.fish')).toBe('魚乾');
    expect(t('mode.treasure')).toBe('優先寶箱');
    expect(t('skill.bellySlam.name')).toBe('肉球震地');
    expect(t('skill.flurryPaws.name')).toBe('連環貓拳');
    expect(t('battle.wave', { n: 2, total: 9 })).toBe('第 2/9 波');
    setLang(before);
  });
});

describe('zh-HK', () => {
  it('is offered as 中文（香港） and uses Hong Kong terms consistently', async () => {
    const { LANGS } = await import('../index');
    const { zh } = await import('../zh');
    expect(LANGS.find((l) => l.id === 'zh-HK')?.label).toBe('中文（香港）');
    const all = Object.values(zh).join('\n');
    // Old / Taiwan-style terms that must not come back.
    for (const bad of ['魚乾仔', '合體', '虎斑', '奧義', '集火', '起司', '頭目', '點擊', '喔', '台灣']) expect(all, bad).not.toContain(bad);
    expect(zh['cat.tabby.name']).toBe('虎紋戰士');
    expect(zh['ability.special']).toBe('特技（3★）');
    expect(zh['ability.ultimate']).toBe('必殺技（5★）');
    expect(zh['sell.button']).toBe('出售貓咪');
    expect(zh['result.home']).toBe('返回主頁');
    expect(zh['currency.fish']).toBe('魚乾');
    expect(zh['currency.coins']).toBe('魚幣');
    expect(zh['battle.focusSet']).toContain('集中攻擊');
  });
});

describe('Early Access notice', () => {
  it('keeps the exact wording and takes the version from the central constant', async () => {
    const { zh } = await import('../zh');
    const { en } = await import('../en');
    const { APP_VERSION, versionLabel } = await import('../../config/version');
    expect(zh['ea.title']).toBe('🐾 喵喵防衛隊（暫定）・開發中！');
    expect(zh['ea.thanks']).toBe('多謝你嚟試玩《喵喵防衛隊（暫定）》！');
    expect(zh['ea.body']).toBe('遊戲目前仍處於開發階段，功能、關卡及貓咪角色可能會不定期大幅更新，遊戲進度亦有機會受到影響。');
    expect(zh['ea.closing']).toBe('多謝你陪住貓咪一齊成長！');
    expect(zh['ea.ok']).toBe('明白，開始遊戲！');
    expect(en['ea.title']).toBe('🐾 Cat Defense (Working Title) — In Development!');
    expect(en['ea.thanks']).toBe('Thank you for trying Cat Defense (Working Title)!');
    expect(en['ea.body']).toBe(
      'The game is still under active development. Features, stages, and cat characters may receive major updates from time to time, and your saved progress may occasionally be affected.',
    );
    expect(en['ea.closing']).toBe('Thank you for growing alongside our cats!');
    expect(en['ea.ok']).toBe("Got it! Let's Play!");
    expect(versionLabel()).toBe(`V${APP_VERSION}`);
    expect(zh['ea.version'].replace('{v}', versionLabel())).toBe(`目前版本：V${APP_VERSION}`);
    expect(en['ea.version'].replace('{v}', versionLabel())).toBe(`Current Version: V${APP_VERSION}`);
  });
});
