import { type ComponentType, lazy, type ReactElement, Suspense, useEffect, useMemo } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { createRoomCommand, type PageValue, runCommand, shellPage, useCtx, useSlot } from "@openwork/kit";
import { devicePorts, useRoom, useRooms } from "@openwork/store";
import { ErrorBoundary, Loading } from "@openwork/ui";
import { copy } from "./copy.ts";
import { Frame, type Regions } from "./Frame.tsx";
import { type Drawer, useDrawer, useDrawerState } from "./drawer.ts";
import { matchPath, roomIdOf, roomPath, type Route } from "./route.ts";
import { useRoute, useRouter } from "./router.ts";

const lazies = new WeakMap<PageValue, ComponentType>();

const componentOf = (page: PageValue): ComponentType => {
  let component = lazies.get(page);
  if (!component) lazies.set(page, component = lazy(page.load));
  return component;
};

const drawerFor = (route: Route, noRooms: boolean): Drawer => (route.name === "profile" ? "panel" : route.name === "home" && !noRooms ? "list" : "none");

/** The conversation routes: `/`, `/c/:roomId` and `/c/:roomId/profile` (the panel open on a phone). */
function RoomRoutes({ regions, route }: { regions: Regions; route: Route }): ReactElement {
  const ctx = useCtx();
  const router = useRouter();
  const drawer = useDrawer();
  const drawerState = useDrawerState();
  const roomId = roomIdOf(route);
  const rooms = useRooms(devicePorts(ctx.ports).store);
  const latest = rooms?.[0]?.id;
  const create = ctx.commands[createRoomCommand.name] ? () => runCommand(ctx, createRoomCommand) : undefined;
  const room = useRoom(devicePorts(ctx.ports).store, roomId ?? "");
  const isMissing = !!roomId && room === null;
  const noRooms = rooms?.length === 0;
  useEffect(() => drawerState?.setDrawer(drawerFor(route, noRooms)), [route.name, roomId, noRooms, drawerState]);
  useEffect(() => {
    if (route.name === "home" && latest) router.replace(roomPath(latest));
  }, [route.name, latest]);

  useEffect(() => {
    if (!isMissing) return;
    const other = rooms?.find((each) => each.id !== roomId)?.id;
    router.replace(other ? roomPath(other) : "/");
  }, [isMissing, roomId, rooms]);

  const onDrawer = (next: Drawer): void => {
    if (noRooms && next === "list") return;
    drawerState?.setDrawer(next);
    if (!roomId) return;
    // Opening the contact panel is local UI state; a direct /profile link is
    // still supported, and closing that link should not leave stale history.
    if (next !== "panel" && route.name === "profile") router.replace(roomPath(roomId));
  };

  return (
    <Frame
      {...regions}
      roomId={roomId}
      noRooms={noRooms}
      isMissing={isMissing}
      onStart={create && (() => void create())}
      drawer={drawer}
      onDrawer={onDrawer}
    />
  );
}

function NotFound(): null {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return null;
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
  const page = route.name === "other" ? "page" : "conversation";
  return (
    <HStack className="app-shell">
      <VStack className={`app-page app-page-${page}`}>
        {route.name === "other" ? <PluginPage path={route.path} /> : <RoomRoutes regions={regions} route={route} />}
      </VStack>
    </HStack>
  );
}
