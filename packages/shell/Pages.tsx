import { type ComponentType, lazy, type ReactElement, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { commandKey, type PageValue, runCommand, shellPage, useCtx, useSlot } from "@openwork/kit";
import { devicePorts, type Room, useRoom, useRooms, useSyncStatus } from "@openwork/store";
import { ErrorBoundary, Loading } from "@openwork/ui";
import { copy } from "./copy.ts";
import { Frame, type Regions } from "./Frame.tsx";
import { type Drawer, useDrawer, useDrawerState } from "./drawer.ts";
import { matchPath, roomIdOf, roomPath, type Route } from "./route.ts";
import { useRoute, useRouter } from "./router.ts";
import { useRegions } from "./useRegions.ts";

/** Provided by the rooms plugin when the product has it; the frame only runs it by name, to open into a first room. */
const createRoom = commandKey<[options?: { first?: boolean }], Promise<void>>("rooms.create");

/** Provided by the rooms plugin when the product names a default room: the shell opens (or makes) it once, when the app opens. */
const openDefaultRoom = commandKey<[rooms: readonly Room[], options?: { navigate?: boolean }], Promise<void>>("rooms.openDefault");

const lazies = new WeakMap<PageValue, ComponentType>();

const componentOf = (page: PageValue): ComponentType => {
  let component = lazies.get(page);
  if (!component) lazies.set(page, component = lazy(page.load));
  return component;
};

const drawerFor = (route: Route, noRooms: boolean, regions: Regions): Drawer =>
  route.name === "profile" && regions.panel ? "panel" : route.name === "home" && !noRooms && regions.circle ? "list" : "none";

/** The conversation routes: `/`, `/c/:roomId` and `/c/:roomId/profile` (the panel open on a phone). */
function RoomRoutes({ given, route }: { given: Regions; route: Route }): ReactElement {
  const ctx = useCtx();
  const regions = useRegions(given);
  const router = useRouter();
  const drawer = useDrawer();
  const drawerState = useDrawerState();
  const roomId = roomIdOf(route);
  const rooms = useRooms(devicePorts(ctx.ports).store);
  const latest = rooms?.[0]?.id;
  const create = ctx.commands[createRoom.name] ? (options: { first: boolean }) => runCommand(ctx, createRoom, options) : undefined;
  const room = useRoom(devicePorts(ctx.ports).store, roomId ?? "");
  const isMissing = !!roomId && room === null;
  const noRooms = rooms?.length === 0;
  useEffect(() => drawerState?.setDrawer(drawerFor(route, noRooms, regions)), [route.name, roomId, noRooms, drawerState, regions]);
  const isSettled = useSyncStatus(devicePorts(ctx.ports).store) !== "catchingUp";
  const isCreating = useRef(false);
  // A product with a default room opens into it once, after the first pull: the oldest room that holds its members, made when there is none.
  const hasDefault = !!ctx.commands[openDefaultRoom.name];
  const [booted, setBooted] = useState(!hasDefault);
  const isOpening = useRef(false);
  useEffect(() => {
    if (booted || !rooms || !isSettled || isOpening.current) return;
    isOpening.current = true;
    const landing = route.name === "home" || rooms.length === 0;
    void (runCommand(ctx, openDefaultRoom, rooms, { navigate: landing }) ?? Promise.resolve()).finally(() => setBooted(true));
  }, [booted, rooms, isSettled]);
  useEffect(() => {
    if (!noRooms) isCreating.current = false;
    else if (create && !hasDefault && isSettled && !isCreating.current) {
      isCreating.current = true;
      void create({ first: true });
    }
  }, [noRooms, isSettled]);
  useEffect(() => {
    if (route.name === "home" && latest && booted) router.replace(roomPath(latest));
  }, [route.name, latest, booted]);

  useEffect(() => {
    if (!isMissing) return;
    const other = rooms?.find((each) => each.id !== roomId)?.id;
    router.replace(other ? roomPath(other) : "/");
  }, [isMissing, roomId, rooms]);

  const onDrawer = (next: Drawer): void => {
    if ((noRooms || !regions.circle) && next === "list") return;
    if (!regions.panel && next === "panel") return;
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
        {route.name === "other" ? <PluginPage path={route.path} /> : <RoomRoutes given={regions} route={route} />}
      </VStack>
    </HStack>
  );
}
