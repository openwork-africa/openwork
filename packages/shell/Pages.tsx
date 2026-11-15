import { type ComponentType, lazy, Suspense, useEffect, useMemo, type ReactElement } from "react";
import { Button } from "@astryxdesign/core/Button";
import { shellPage, type PageValue, useCtx, useSlot } from "@openwork/kit";
import { EmptyCard, ErrorBoundary, Loading } from "@openwork/ui";
import { copy } from "./copy.ts";
import { Frame, type Regions } from "./Frame.tsx";
import { type Drawer, shellUi, useDrawer } from "./drawer.ts";
import { matchPath, profilePath, roomIdOf, roomPath, type Route } from "./route.ts";
import { useRoute } from "./router.ts";

const lazies = new WeakMap<PageValue, ComponentType>();

const componentOf = (page: PageValue): ComponentType => {
  let component = lazies.get(page);
  if (!component) lazies.set(page, component = lazy(page.load));
  return component;
};

const drawerFor = (route: Route): Drawer => (route.name === "profile" ? "panel" : route.name === "home" ? "list" : "none");

/** The conversation routes: `/`, `/c/:roomId` and `/c/:roomId/profile` (the panel open on a phone). */
function RoomRoutes({ regions, route }: { regions: Regions; route: Route }): ReactElement {
  const { navigate } = useCtx();
  const drawer = useDrawer();
  const roomId = roomIdOf(route);
  useEffect(() => shellUi.setDrawer(drawerFor(route)), [route.name, roomId]);

  const onDrawer = (next: Drawer): void => {
    shellUi.setDrawer(next);
    if (!roomId) return;
    if (next === "panel") navigate(profilePath(roomId));
    else if (route.name === "profile") navigate(roomPath(roomId));
  };

  return <Frame {...regions} roomId={roomId} drawer={drawer} onDrawer={onDrawer} />;
}

function NotFound(): ReactElement {
  const { navigate } = useCtx();
  return (
    <EmptyCard
      art="chat"
      title={copy.notFoundTitle}
      description={copy.notFoundDescription}
      action={<Button label={copy.goHome} variant="secondary" onClick={() => navigate("/")} />}
    />
  );
}

function PluginPage({ path }: { path: string }): ReactElement {
  const ctx = useCtx();
  const pages = useSlot(shellPage, ctx);
  const page = useMemo(() => pages.find((candidate) => matchPath(candidate.path, path)), [pages, path]);
  const Page = page ? componentOf(page) : NotFound;
  return (
    <ErrorBoundary name={copy.pageName} resetKey={path}>
      <Suspense fallback={<Loading />}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  );
}

/** The shell.page host: the conversation routes are the shell's own, every other path is a page a plugin contributed. */
export function ShellRoutes({ regions }: { regions: Regions }): ReactElement {
  const route = useRoute();
  return route.name === "other" ? <PluginPage path={route.path} /> : <RoomRoutes regions={regions} route={route} />;
}
