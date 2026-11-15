import { Window } from "happy-dom";

const GLOBALS = ["document", "HTMLElement", "Element", "Node", "Text", "Event", "MouseEvent", "KeyboardEvent", "InputEvent", "HTMLIFrameElement", "MutationObserver"] as const;

/** A browser for the tests: one happy-dom window whose parts become globals. */
const dom = new Window({ url: "http://127.0.0.1:47411/" }) as unknown as Record<string, unknown>;
const target = globalThis as unknown as Record<string, unknown>;
target.window = globalThis;
for (const key of GLOBALS) target[key] = dom[key];
target.requestAnimationFrame = (run: (time: number) => void) => setTimeout(() => run(Date.now()), 0);
target.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
target.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
target.CSS = { supports: () => false, escape: (value: string) => value };
target.scrollTo = () => {};
target.getComputedStyle = (dom.getComputedStyle as (...args: unknown[]) => unknown).bind(dom);
target.getSelection = (dom.getSelection as (...args: unknown[]) => unknown).bind(dom);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
