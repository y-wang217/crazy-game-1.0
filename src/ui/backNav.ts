import { useEffect, useRef } from "react";

// Android Back / browser Back (audit B3). The app keeps ONE extra history entry on top of the
// page. Back consumes it; the newest registered handler decides what Back means right now (close
// a dialog, open the battle's "Leave battle?" sheet, go to the previous screen…), and the entry is
// put back. Only when nothing handles it (Home, nothing open) does a SECOND Back within a short
// time leave the game — the first one shows "Press Back again to exit". Saves are always written
// already, so leaving never loses progress; this only prevents leaving by surprise.

type Handler = () => boolean;
const handlers: { fn: () => Handler; priority: number }[] = [];

/** Who answers Back first: guided tours, then dialogs, then the battle, then the screen itself. */
export const BACK_PRIORITY = {
  screen: 0,
  battle: 1,
  dialog: 2,
  tour: 3,
} as const;

/**
 * While `active`, Back calls `onBack` (higher priority first; newest first within a priority).
 * Return true when Back was handled; false lets the next handler try.
 */
export function useBackHandler(
  onBack: Handler,
  active = true,
  priority: number = BACK_PRIORITY.dialog,
): void {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const entry = { fn: () => ref.current, priority };
    handlers.push(entry);
    return () => {
      const i = handlers.indexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, [active, priority]);
}

/** Run the handlers, newest first. Exported for tests. */
export function dispatchBack(): boolean {
  // Stable order: priority descending, then the most recent registration first.
  const order = handlers
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h.priority - a.h.priority || b.i - a.i);
  for (const { h } of order) if (h.fn()()) return true;
  return false;
}

const MARK = "cdApp";
const isMarked = () =>
  !!(window.history.state as Record<string, unknown> | null)?.[MARK];
const EXIT_WINDOW_MS = 2000;

/**
 * Install once (App). `onExitHint` shows the "Press Back again to exit" message.
 * Returns an uninstall function.
 */
export function installBackNav(onExitHint: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // After a refresh the browser keeps our entry: never add a second one.
  if (!isMarked()) window.history.pushState({ [MARK]: true }, "");
  let exitArmedUntil = 0;
  let leaving = false;
  const onPop = () => {
    if (leaving || isMarked()) return; // we went forward again, or this is our own exit
    if (dispatchBack()) {
      window.history.pushState({ [MARK]: true }, "");
      return;
    }
    if (Date.now() < exitArmedUntil) {
      leaving = true;
      window.history.back(); // second Back on Home: leave the game as the player asked
      return;
    }
    exitArmedUntil = Date.now() + EXIT_WINDOW_MS;
    window.history.pushState({ [MARK]: true }, "");
    onExitHint();
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}
