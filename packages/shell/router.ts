import { createContext, useContext, useSyncExternalStore } from "react";
import { parseRoute, type Route } from "./route.ts";

export interface RouterEnv {
  read(): string;
  push(path: string): void;
  listen(listener: () => void): () => void;
}

export interface Router {
  path(): string;
  navigate(path: string): void;
  subscribe(listener: () => void): () => void;
}

export const browserEnv: RouterEnv = {
  read: () => globalThis.location.pathname + globalThis.location.search,
  push: (path) => globalThis.history.pushState(null, "", path),
  listen(listener) {
    globalThis.addEventListener("popstate", listener);
    return () => globalThis.removeEventListener("popstate", listener);
  },
};

/** Real paths on the History API: `navigate` pushes an entry, the back button comes back through `listen`. */
export function createRouter(env: RouterEnv = browserEnv): Router {
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());
  let unlisten: (() => void) | undefined;
  return {
    path: () => env.read(),
    navigate(path) {
      if (path === env.read()) return;
      env.push(path);
      changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      unlisten ??= env.listen(changed);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unlisten?.();
          unlisten = undefined;
        }
      };
    },
  };
}

export const RouterContext = createContext<Router | null>(null);

export function useRouter(): Router {
  const router = useContext(RouterContext);
  if (!router) throw new Error("useRouter needs the shell's RouterContext above it");
  return router;
}

export function useRoute(): Route {
  const router = useRouter();
  return parseRoute(useSyncExternalStore(router.subscribe, router.path, router.path));
}
