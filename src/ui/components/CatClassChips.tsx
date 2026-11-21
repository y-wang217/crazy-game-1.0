import { CAT_CLASSES, coreTag, tagsAt } from "../../config/catClasses";
import type { CatId } from "../../game/types";
import { t } from "../../i18n";
import { GameIcon } from "./GameIcon";

/**
 * A cat's primary role + skill tags as small chips. `compact` (cards): role + the one core tag.
 * Full (profile): every tag; 3★ / 5★ tags the player hasn't reached are dimmed with a lock and
 * their requirement, so they never look like abilities the cat already has.
 */
export function CatClassChips({
  cat,
  stars,
  compact = false,
}: {
  cat: CatId;
  stars: number;
  compact?: boolean;
}) {
  const cls = CAT_CLASSES[cat];
  const tags = compact
    ? [{ id: coreTag(cat), active: true, star: undefined }]
    : tagsAt(cat, stars);
  return (
    <div className={`class-chips ${compact ? "compact" : ""}`}>
      <span className={`role-chip role-${cls.archetype}`}>
        {t(`archetype.${cls.archetype}`)}
      </span>
      {tags.map((tg) => (
        <span
          key={tg.id}
          className={`tag-chip ${tg.active ? "" : "locked"}`}
          title={tg.active ? undefined : t("ctag.locked", { n: tg.star ?? 3 })}
        >
          {!tg.active && <GameIcon name="lock" size={10} />}
          {t(`ctag.${tg.id}`)}
          {tg.star && (
            <span className="tag-star">
              {tg.active ? `${tg.star}★` : t("ctag.locked", { n: tg.star })}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
