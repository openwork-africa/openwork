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
interface SideRoom {
  back: number;
  ahead: number;
}

const scrollsInstead = (room: SideRoom | null, direction: "left" | "right"): boolean =>
  !!room && (direction === "right" ? room.back > 0 : room.ahead > 1);

function sideRoomAt(target: EventTarget | null): SideRoom | null {
  for (let element = target instanceof Element ? target : null; element; element = element.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(element).overflowX) && element.scrollWidth > element.clientWidth) {
      return { back: Math.abs(element.scrollLeft), ahead: element.scrollWidth - element.clientWidth - Math.abs(element.scrollLeft) };
    }
  }
  return null;
}

export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (direction: "left" | "right") => void): void {
  const swiped = useEffectEvent(onSwipe);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
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
    element.addEventListener("touchstart", down, { passive: true });
    element.addEventListener("touchend", up, { passive: true });
    element.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      element.removeEventListener("touchstart", down);
      element.removeEventListener("touchend", up);
      element.removeEventListener("touchcancel", cancel);
    };
  }, [ref]);
}
