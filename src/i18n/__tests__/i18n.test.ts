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
    for (const e of Object.keys(ENEMIES)) for (const f of ['name', 'strength', 'behavior', 'tip']) keys.push(`enemy.${e}.${f}`);
    for (const c of Object.keys(CHESTS)) keys.push(`chest.${c}.name`, `chest.${c}.desc`);
    for (const s of SKILL_ORDER) keys.push(`skill.${s}.name`, `skill.${s}.desc`);
    for (const m of TARGET_MODES) keys.push(`mode.${m}`, `mode.${m}.short`, `mode.${m}.desc`);
    for (const c of COSMETICS) keys.push(`cosmetic.${c.id}.name`, `cosmetic.${c.id}.desc`);
    for (const ch of CHAPTERS) {
      keys.push(`chapter.${ch.id}`);
      for (const s of ch.stages) keys.push(`stage.${s.id}`);
    }
    for (const steps of Object.values(STAGE_STEPS)) for (const s of steps) {
      const name = s.id.replace('tut:', '');
      keys.push(`tut.${name}.title`, `tut.${name}.body`);
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
    setLang('zh-TW');
    expect(t('battle.summon')).toBe('召喚貓咪');
    expect(t('battle.skill')).toBe('隨機技能');
    expect(t('cat.orange.name')).toBe('肥橘');
    expect(t('cat.tabby.name')).toBe('虎斑戰士');
    expect(t('currency.coins')).toBe('魚幣');
    expect(t('currency.fish')).toBe('魚乾仔');
    expect(t('mode.treasure')).toBe('優先寶箱');
    expect(t('skill.bellySlam.name')).toBe('肉球震地');
    expect(t('skill.flurryPaws.name')).toBe('連環貓拳');
    expect(t('battle.wave', { n: 2, total: 9 })).toBe('第 2/9 波');
    setLang(before);
  });
});
