import { type RefObject, useEffect, useEffectEvent } from "react";

const SWIPE_MIN = 60;
const SWIPE_DOMINANCE = 1.5;

export function swipeOf(dx: number, dy: number): "left" | "right" | null {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return null;
  return dx > 0 ? "right" : "left";
}

const isTextField = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest("textarea, input, [contenteditable='true']");

const isInLayer = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest("dialog, [role='dialog'], [popover]");

/** How far a row can still scroll each way: a swipe that would scroll it is the row's, not the page's. */
export interface SideRoom {
  back: number;
  ahead: number;
}

export const scrollsInstead = (room: SideRoom | null, direction: "left" | "right"): boolean =>
  !!room && (direction === "right" ? room.back > 0 : room.ahead > 1);

function sideRoomAt(target: EventTarget | null): SideRoom | null {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth) {
      return { back: Math.abs(el.scrollLeft), ahead: el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) };
    }
  }
  return null;
}

export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (direction: "left" | "right") => void): void {
  const swiped = useEffectEvent(onSwipe);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; room: SideRoom | null } | null = null;
    const down = (event: TouchEvent) => {
      const touch = event.touches[0];
      const isOwn = event.touches.length === 1 && touch && !isTextField(event.target) && !isInLayer(event.target);
      start = isOwn ? { x: touch.clientX, y: touch.clientY, room: sideRoomAt(event.target) } : null;
    };
    const up = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const direction = swipeOf(touch.clientX - start.x, touch.clientY - start.y);
      const room = start.room;
      start = null;
      if (direction && !scrollsInstead(room, direction)) swiped(direction);
    };
    const cancel = () => {
      start = null;
    };
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchend", up, { passive: true });
    el.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", cancel);
    };
  }, [ref]);
}
