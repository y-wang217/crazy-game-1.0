import { SKILLS } from '../../config/skills';
import type { CosmeticLoadout, SkillId } from '../../game/types';
import { t } from '../../i18n';
import { CatHead } from './CatPreview';
import { GameIcon } from './GameIcon';

/** Who a skill helps: the matching cat's real portrait, or a "whole team" paw icon. */
export function SkillOwner({ id, loadout, size = 24, label = false }: { id: SkillId; loadout: CosmeticLoadout; size?: number; label?: boolean }) {
  const cat = SKILLS[id].cat;
  return (
    <span className={`skill-owner ${cat ? 'cat' : 'team'}`} title={cat ? t(`cat.${cat}.name`) : t('battle.allCats')}>
      <span className="skill-owner-badge" style={{ width: size, height: size }}>
        {cat ? <CatHead type={cat} loadout={loadout} size={size} /> : <GameIcon name="team" size={size - 4} />}
      </span>
      {label && <span className="skill-owner-label">{cat ? t(`cat.${cat}.name`) : t('battle.allCats')}</span>}
    </span>
  );
}
