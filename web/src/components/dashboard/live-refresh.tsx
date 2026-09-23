"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the dashboard's server-rendered numbers current while the tab stays
 * open, instead of freezing at whatever demand happened to be when the page
 * first loaded.
 *
 * WHY THIS IS NEEDED
 * The dashboard is a server component: the recommended/usual departure times,
 * the demand index at each of them, and the "extra minutes stuck in traffic"
 * figure are all computed fresh every time the page is rendered on the
 * server, from confirmed trips and network events at that moment (see
 * `lib/demand/aggregate.ts`). The engine itself is already live — nothing
 * here recomputes anything. What was missing is the trigger: a person who
 * opens the dashboard and leaves it open never asks the server to render it
 * again, so the numbers on screen stop moving even though the real picture
 * behind them keeps changing as the day goes on (for example, if enough
 * other confirmed trips or a logged network event turn a mild +4 minutes
 * into something much worse later in the morning).
 *
 * WHAT THIS COMPONENT DOES
 * It renders nothing. It just calls `router.refresh()` — which re-runs the
 * server component tree for this page without a full reload or any loss of
 * client-side state (an open "Change my plan" panel, for instance, is
 * untouched) — on a timer, and once immediately whenever the tab comes back
 * into view after being hidden for a while. It never refreshes while the tab
 * is hidden, so a backgrounded browser tab is not doing pointless work.
 */

/** How often to ask the server for fresh numbers while the tab is visible. */
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;

/** Only worth an extra refresh-on-return if the tab was away at least this long. */
const STALE_AFTER_MS = 60 * 1000;

export function LiveRefresh() {
  const router = useRouter();
  const lastRefreshAt = useRef(Date.now());

  useEffect(() => {
    const refresh = () => {
      lastRefreshAt.current = Date.now();
      router.refresh();
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAt.current >= STALE_AFTER_MS) refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
