import type { RouterEnv } from "./router.ts";
export { flush, labelled, mount } from "@openwork/ui/testing";

export function memoryEnv(start = "/"): RouterEnv & { history: string[]; back(): void } {
  const listeners = new Set<() => void>();
  const history = [start];
  return {
    history,
    read: () => history.at(-1)!,
    push: (path) => void history.push(path),
    replace: (path) => void history.splice(-1, 1, path),
    back() {
      history.pop();
      listeners.forEach((listener) => listener());
    },
    listen(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
