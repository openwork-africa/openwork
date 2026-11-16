// A menu opened by holding a finger down (a ContextMenu on a phone) rises as a sheet under that finger. Lifting the
// finger is then a click on whichever item happens to be there: the menu would pick for you. Give this to the menu's
// `onOpenChange`: the click that lifting makes is dropped, and the next tap picks.
const RELEASE_CLICK_MS = 400;
const CAPTURED = { capture: true } as const;
let isTouching = false;

const page = globalThis.document as Document | undefined;
page?.addEventListener("touchstart", () => void (isTouching = true), { capture: true, passive: true });
for (const lifted of ["touchend", "touchcancel"]) page?.addEventListener(lifted, () => void (isTouching = false), CAPTURED);

const drop = (event: Event): void => {
  event.preventDefault();
  event.stopPropagation();
};

export const dropReleaseClick = (isOpen: boolean): void => {
  if (!isOpen || !isTouching || !page) return;
  page.addEventListener("click", drop, CAPTURED);
  const lifted = (): void => {
    page.removeEventListener("touchend", lifted, CAPTURED);
    page.removeEventListener("touchcancel", lifted, CAPTURED);
    setTimeout(() => page.removeEventListener("click", drop, CAPTURED), RELEASE_CLICK_MS);
  };
  page.addEventListener("touchend", lifted, CAPTURED);
  page.addEventListener("touchcancel", lifted, CAPTURED);
};
