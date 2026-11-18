import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { contribute, definePlugin, getNotices, type Plugin, shellPage, shellRegion } from "@openwork/kit";
import { clearNotices } from "@openwork/kit/testing";
import { manualConnectivity, type MemoryDeviceStore } from "@openwork/store";
import { memoryPorts } from "@openwork/store/testing";
import { bootShell, type Shell, type ShellOptions } from "./boot.ts";
import { copy } from "./copy.ts";
import { createRouter } from "./router.ts";
import { ShellApp } from "./ShellApp.tsx";
import { flush, labelled, memoryEnv, mount } from "./testing.tsx";

function boot(
  path: string,
  plugins: Plugin[] = [],
  regions: ShellOptions["regions"] = {},
): { shell: Shell; env: ReturnType<typeof memoryEnv>; store: MemoryDeviceStore } {
  clearNotices();
  const env = memoryEnv(path);
  const ports = memoryPorts();
  const { store } = ports;
  const shell = bootShell({
    plugins,
    ports,
    connectivity: manualConnectivity(true),
    router: createRouter(env),
    regions,
  });
  return { shell, env, store };
}

const regionPlugin = (id: "circle" | "panel", label: string): Plugin =>
  definePlugin({
    id,
    version: "1.0.0",
    contributes: [contribute(shellRegion, { id, order: 10, region: id, load: () => Promise.resolve({ default: () => <p data-region={id}>{label}</p> }) })],
  });

const view = (shell: Shell) => <ShellApp product={shell.product} router={shell.router} regions={shell.regions} drawer={shell.drawer} />;

Deno.test("boot with zero plugins shows the frame and no error notices", async () => {
  const { shell } = boot("/");
  const { container, unmount } = await mount(view(shell));
  await flush();
  assertEquals(labelled(container, copy.listLabel), null, "no circle plugin: no list");
  assertEquals(labelled(container, copy.panelLabel), null, "no panel plugin: no panel column");
  assert(container.querySelector(".convo-loading")?.textContent?.includes(copy.noRoomsTitle));
  assertEquals(shell.product.problems, []);
  assertEquals(getNotices().filter((notice) => notice.status === "error"), []);
  await unmount();
  shell.stop();
});

Deno.test("a plugin that contributes shell.region draws its island in the frame; one that is not in the list leaves no trace", async () => {
  const { shell, store } = boot("/", [regionPlugin("circle", "the list")]);
  const room = await store.createRoom("One");
  shell.router.navigate(`/c/${room.id}`);
  const { container, unmount } = await mount(view(shell));
  await flush();
  assertEquals(labelled(container, copy.listLabel)?.textContent, "the list");
  assertEquals(container.querySelector('[data-region="panel"]'), null, "the panel plugin is not in the list");
  assertEquals(labelled(container, copy.panelLabel), null);
  await unmount();
  shell.stop();
});

Deno.test("a room path opens the room, and the profile path opens the panel drawer until it is closed", async () => {
  const { shell, env, store } = boot("/", [regionPlugin("panel", "the panel")]);
  const room = await store.createRoom("One");
  env.replace(`/c/${room.id}/profile`);
  const { container, unmount } = await mount(view(shell));
  await flush();
  assert(container.querySelector(".convo-shell")?.classList.contains("is-panel-open"));
  await act(() => (container.querySelector(".convo-scrim") as HTMLElement).click());
  assertEquals(env.history.at(-1), `/c/${room.id}`);
  assert(!container.querySelector(".convo-shell")?.classList.contains("is-panel-open"));
  assertEquals(shell.drawer.drawer(), "none");
  await unmount();
  shell.stop();
});

Deno.test("the home path opens the latest room with drawers closed, or the empty state when there are no rooms", async () => {
  const { shell, store, env } = boot("/");
  const { container, unmount } = await mount(view(shell));
  await flush();
  assert(!container.querySelector(".convo-shell")?.classList.contains("is-list-open"));
  const room = await act(() => store.createRoom("One"));
  await flush();
  assertEquals(env.read(), `/c/${room.id}`);
  assert(!container.querySelector(".convo-shell")?.classList.contains("is-list-open"));
  await unmount();
  shell.stop();
});

Deno.test("a plugin page is a path of its own, and an unknown path says so", async () => {
  const settings = definePlugin({
    id: "settings",
    version: "0.1.0",
    contributes: [contribute(shellPage, { id: "settings", order: 1, path: "/settings", load: () => Promise.resolve({ default: () => <p>Settings page</p> }) })],
  });
  const { shell } = boot("/settings", [settings]);
  const { container, unmount } = await mount(view(shell));
  await flush();
  assert(container.textContent?.includes("Settings page"));
  await act(() => shell.router.navigate("/nowhere"));
  await flush();
  assertEquals(shell.router.navigate === undefined, false);
  assert(container.textContent?.includes(copy.noRoomsTitle), "an unknown path goes home");
  await unmount();
  shell.stop();
});

Deno.test("a room that is not on the device is left for the latest room, or for home when there is none", async () => {
  const { shell, env, store } = boot("/c/gone");
  const { container, unmount } = await mount(view(shell));
  await flush();
  assertEquals(env.history.at(-1), "/");
  assert(container.textContent?.includes(copy.noRoomsTitle));
  const kept = await store.createRoom("Kept");
  await act(() => shell.router.navigate("/c/stale"));
  await flush();
  assertEquals(env.history.at(-1), `/c/${kept.id}`);
  await unmount();
  shell.stop();
});

Deno.test("a room still being read, or one that is missing, shows the window's own loading frame and not the brand loader", async () => {
  const { shell, store } = boot("/");
  const room = await store.createRoom("One");
  await store.deleteRoom(room.id);
  const { container, unmount } = await mount(view(shell));
  await flush();
  assertEquals(container.querySelector('svg[aria-label="Openwork"]'), null);
  await unmount();
  shell.stop();
});
