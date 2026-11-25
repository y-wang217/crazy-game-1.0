import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../../i18n";

/**
 * The one "Skip tutorial" control used by every tutorial (battle lessons, guided tours, Edit Team):
 * a small secondary pill fixed near the top-right — outside the dialogue bubble, which keeps
 * Continue / Next / the requested action as its main focus. Skipping is always explicit: the pill
 * opens a short confirmation and only its Skip button calls `onSkip`.
 *
 * `below`: CSS selector of a bar the pill must sit under (e.g. the battle HUD, whose top-right
 * holds the speed and menu buttons). Safe areas (notches, browser chrome) are respected in CSS.
 */
export function TutorialSkip({
  open,
  onOpenChange,
  onSkip,
  confirmText,
  below,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSkip: () => void;
  confirmText: string;
  below?: string;
}) {
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!below) return;
    const place = () => {
      const el = document.querySelector(below);
      setTop(el ? Math.round(el.getBoundingClientRect().bottom) + 6 : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [below]);
  const style = top !== null ? { top } : undefined;
  // Rendered at the page root: an animated (transformed) tutorial card would otherwise become the
  // containing block of this fixed element and drag it into the middle of the screen.
  return createPortal(
    <div className="tutorial-skip" style={style}>
      {open ? (
        <div
          className="tutorial-skip-confirm"
          role="alertdialog"
          aria-label={t("tut.skip")}
        >
          <span>{confirmText}</span>
          <div className="tutorial-skip-btns">
            <button
              className="btn btn-small btn-secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("tour.keepGoing")}
            </button>
            <button
              className="btn btn-small btn-danger tutorial-skip-yes"
              onClick={onSkip}
            >
              {t("tut.skipYes")}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="tutorial-skip-btn"
          onClick={() => onOpenChange(true)}
        >
          {t("tut.skip")} ✕
        </button>
      )}
    </div>,
    document.body,
  );
}
