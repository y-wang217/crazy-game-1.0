import { useState } from "react";
import {
  ARCHETYPES,
  CAT_CLASSES,
  TAG_ORDER,
  matchesFilter,
  tagsAt,
  type Archetype,
  type SkillTag,
} from "../../config/catClasses";
import type { CatId } from "../../game/types";
import { t } from "../../i18n";

export interface CatFilterValue {
  archetype: Archetype | null;
  tag: SkillTag | null;
}
export const NO_FILTER: CatFilterValue = { archetype: null, tag: null };
export const filterActive = (f: CatFilterValue) => !!(f.archetype || f.tag);

// Selections survive leaving the screen (e.g. opening a profile and coming back) for this session.
const remembered = new Map<string, CatFilterValue>();
export function useCatFilter(
  key: string,
): [CatFilterValue, (v: CatFilterValue) => void] {
  const [value, setValue] = useState<CatFilterValue>(
    () => remembered.get(key) ?? NO_FILTER,
  );
  return [
    value,
    (v) => {
      remembered.set(key, v);
      setValue(v);
    },
  ];
}

/** The cats from `pool` that match (tags only count once unlocked at the cat's permanent ★). */
export function applyCatFilter<T extends { id: CatId; stars: number }>(
  pool: T[],
  f: CatFilterValue,
): T[] {
  return pool.filter((c) => matchesFilter(c.id, c.stars, f));
}

/**
 * A compact chip panel, collapsed by default (the button shows how many filters are on, and a short
 * summary stays visible while collapsed): one role and/or one skill tag (tap again to clear). Only roles
 * and unlocked tags that the given cats actually have are offered, so it never hints at cats or
 * abilities the player hasn't found. Habitat is intentionally not a filter (dormant feature).
 */
export function CatFilter({
  pool,
  value,
  onChange,
}: {
  pool: { id: CatId; stars: number }[];
  value: CatFilterValue;
  onChange: (v: CatFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const roles = ARCHETYPES.filter((a) =>
    pool.some((c) => CAT_CLASSES[c.id].archetype === a),
  );
  const tags = TAG_ORDER.filter((tg) =>
    pool.some((c) =>
      tagsAt(c.id, c.stars).some((x) => x.id === tg && x.active),
    ),
  );
  const count = (value.archetype ? 1 : 0) + (value.tag ? 1 : 0);
  const summary = [
    value.archetype && t(`archetype.${value.archetype}`),
    value.tag && t(`ctag.${value.tag}`),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={`cat-filter ${open ? "open" : ""}`}>
      <div className="cat-filter-bar">
        <button
          className={`btn btn-small cat-filter-toggle ${count ? "on" : ""}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {t("filter.open")}
          {count > 0 && <span className="cat-filter-count">{count}</span>}
        </button>
        {count > 0 && !open && (
          <span className="cat-filter-summary">{summary}</span>
        )}
        {count > 0 && (
          <button
            className="link-btn tiny cat-filter-clear"
            onClick={() => onChange(NO_FILTER)}
          >
            {t("filter.clear")}
          </button>
        )}
      </div>
      {open && (
        <div className="cat-filter-panel">
          <div className="cat-filter-group">
            <span className="cat-filter-label">{t("filter.role")}</span>
            {roles.map((a) => (
              <button
                key={a}
                className={`role-chip role-${a} chip-btn ${value.archetype === a ? "on" : ""}`}
                aria-pressed={value.archetype === a}
                onClick={() =>
                  onChange({
                    ...value,
                    archetype: value.archetype === a ? null : a,
                  })
                }
              >
                {t(`archetype.${a}`)}
              </button>
            ))}
          </div>
          <div className="cat-filter-group">
            <span className="cat-filter-label">{t("filter.skill")}</span>
            {tags.map((tg) => (
              <button
                key={tg}
                className={`tag-chip chip-btn ${value.tag === tg ? "on" : ""}`}
                aria-pressed={value.tag === tg}
                onClick={() =>
                  onChange({ ...value, tag: value.tag === tg ? null : tg })
                }
              >
                {t(`ctag.${tg}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
