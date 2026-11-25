import { useRef, useState } from "react";
import type { CatId, CosmeticLoadout } from "../../game/types";
import { t } from "../../i18n";
import { CatPreview } from "./CatPreview";
import { CatScene } from "./CatScene";

/**
 * Approved story illustrations, page by page (none yet). When the owner supplies artwork, add
 * the file URLs here — e.g. `kitten: ['/story/kitten-1.webp', null, …]` — and those pages show
 * the picture instead of the room scene. Nothing else in the Storybook needs to change.
 */
export const STORY_ART: Partial<Record<CatId, (string | null)[]>> = {};

/** Pages = the story's existing paragraphs (the approved text, unchanged). */
export function storyPages(cat: CatId): string[] {
  return t(`cat.${cat}.story`)
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Character Storybook (V1.6.4): the full biography as a small page-by-page storybook. Each page
 * is a scene made only from existing approved art (the cat's own room and its sprite — no new or
 * generated illustrations), the scene number and the original paragraph; the last page adds the
 * cat's own line in a speech bubble. Free navigation (buttons, page dots or a swipe), no timers.
 */
export function Storybook({
  cat,
  star,
  loadout,
}: {
  cat: CatId;
  star: number;
  loadout: CosmeticLoadout;
}) {
  const pages = storyPages(cat);
  const [page, setPage] = useState(0);
  const go = (p: number) => setPage(Math.max(0, Math.min(pages.length - 1, p)));
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const last = page === pages.length - 1;
  const art = STORY_ART[cat]?.[page] ?? null;
  const side = page % 2 === 0 ? "left" : "right";
  return (
    <div
      className="storybook"
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5)
          go(page + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="storybook-head">
        <b>{t("book.title", { cat: t(`cat.${cat}.name`) })}</b>
        <span className="muted small">{t("book.scene", { n: page + 1 })}</span>
      </div>
      <div key={page} className="storybook-page">
        <div className={`storybook-scene side-${side}`}>
          {art ? (
            <img src={art} alt="" className="storybook-art" />
          ) : (
            <>
              <CatScene cat={cat} star={star} />
              <div className="storybook-cat">
                <CatPreview
                  type={cat}
                  level={1}
                  loadout={loadout}
                  size={104}
                  attackLoop={last}
                />
              </div>
            </>
          )}
          {last && (
            <div className={`storybook-bubble side-${side}`}>
              「{t(`cat.${cat}.line`)}」
            </div>
          )}
        </div>
        <p className="storybook-text">{pages[page]}</p>
      </div>
      <div className="storybook-nav">
        <button
          className="btn btn-small"
          disabled={page === 0}
          onClick={() => go(page - 1)}
          aria-label={t("book.prev")}
        >
          ‹ {t("book.prev")}
        </button>
        <div
          className="storybook-dots"
          aria-label={t("book.progress", { n: page + 1, total: pages.length })}
        >
          {pages.map((_, i) => (
            <button
              key={i}
              className={i === page ? "on" : ""}
              onClick={() => go(i)}
              aria-label={t("book.scene", { n: i + 1 })}
            />
          ))}
          <span className="tiny muted">
            {page + 1}/{pages.length}
          </span>
        </div>
        <button
          className="btn btn-small btn-primary"
          disabled={last}
          onClick={() => go(page + 1)}
          aria-label={t("book.next")}
        >
          {t("book.next")} ›
        </button>
      </div>
    </div>
  );
}
