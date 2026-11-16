import { type RefObject, useEffect, useRef } from "react";

const AT_BOTTOM_PX = 24;
const GESTURE_MS = 800;

/**
 * Keeps the newest message in view while it is still being written. Astryx's ChatLayout follows growth, but takes any
 * scroll upwards as the reader leaving, and a line that gets shorter moves the view up by itself (the browser clamps it);
 * from then on nothing follows. Here only the reader's own hand decides: a scroll within a moment of their touch, wheel
 * or key that comes to rest away from the bottom stops the following, and coming back to the bottom starts it again.
 * `inside` holds the chat layout; `trail` is what is drawn in it, so the watch moves with it.
 */
export function useFollowNewest(inside: RefObject<HTMLElement | null>, trail: unknown): void {
  const following = useRef(true);
  useEffect(() => {
    const scroller = inside.current?.querySelector<HTMLElement>(".astryx-chat-layout");
    const content = scroller?.querySelector<HTMLElement>("[role=log]");
    if (!scroller || !content || typeof ResizeObserver === "undefined") return;
    following.current = true;
    let touchedAt = 0;
    const gapOf = () => scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    const touched = () => void (touchedAt = Date.now());
    const onScroll = () => {
      if (Date.now() - touchedAt < GESTURE_MS) following.current = gapOf() <= AT_BOTTOM_PX;
    };
    const grown = new ResizeObserver(() => {
      if (following.current && gapOf() > AT_BOTTOM_PX) scroller.scrollTop = scroller.scrollHeight;
    });
    const gestures = ["pointerdown", "touchmove", "wheel", "keydown"] as const;
    for (const gesture of gestures) scroller.addEventListener(gesture, touched, { passive: true });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    grown.observe(content);
    // The visual viewport shrinking for the on-screen keyboard changes the scroller's clientHeight, not the log's size.
    grown.observe(scroller);
    return () => {
      for (const gesture of gestures) scroller.removeEventListener(gesture, touched);
      scroller.removeEventListener("scroll", onScroll);
      grown.disconnect();
    };
  }, [inside, trail]);
}
