import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { type Plugin, contribute, definePlugin, getNotices, dismiss, shellPage } from "@openwork/kit";
import { ManualClock, manualConnectivity, MemoryDeviceStore, MemoryFileStore, MemoryTransport } from "@openwork/store";
import { type Shell, bootShell } from "./boot.ts";
import { copy } from "./copy.ts";
import { shellUi } from "./drawer.ts";
import { createRouter } from "./router.ts";
import { ShellApp } from "./ShellApp.tsx";
import { flush, labelled, memoryEnv, mount } from "./testing.tsx";

function boot(path: string, plugins: Plugin[] = []): { shell: Shell; env: ReturnType<typeof memoryEnv>; store: MemoryDeviceStore } {
  getNotices().forEach((notice) => dismiss(notice.id));
  const env = memoryEnv(path);
  const clock = new ManualClock();
  const store = new MemoryDeviceStore(clock);
  const shell = bootShell({
    plugins,
    ports: { store, files: new MemoryFileStore(), transport: new MemoryTransport(), clock },
    connectivity: manualConnectivity(true),
    router: createRouter(env),
  });
  return { shell, env, store };
}

const view = (shell: Shell) => <ShellApp product={shell.product} router={shell.router} regions={shell.regions} />;

Deno.test("boot with zero plugins shows the frame and no error notices", async () => {
  const { shell } = boot("/");
  const { container, unmount } = await mount(view(shell));
  await flush();
  assert(labelled(container, copy.listLabel));
  assertEquals(labelled(container, copy.panelLabel), null, "no room is open: no panel column");
  assert(container.querySelector(".convo-loading")?.textContent?.includes(copy.noRoomsTitle));
  assertEquals(shell.product.problems, []);
  assertEquals(getNotices().filter((notice) => notice.status === "error"), []);
  await unmount();
  shell.stop();
});

Deno.test("a room path opens the room, and the profile path opens the panel drawer until it is closed", async () => {
  const { shell, env, store } = boot("/");
  const room = await store.createRoom("One");
  env.replace(`/c/${room.id}/profile`);
  const { container, unmount } = await mount(view(shell));
  await flush();
  assert(container.querySelector(".convo-shell")?.classList.contains("is-panel-open"));
  await act(() => (container.querySelector(".convo-scrim") as HTMLElement).click());
  assertEquals(env.history.at(-1), `/c/${room.id}`);
  assert(!container.querySelector(".convo-shell")?.classList.contains("is-panel-open"));
  assertEquals(shellUi.drawer(), "none");
  await unmount();
  shell.stop();
});

Deno.test("the home path opens the list drawer on a phone, unless there are no rooms to list", async () => {
  const { shell, store } = boot("/");
  const { container, unmount } = await mount(view(shell));
  await flush();
  assert(!container.querySelector(".convo-shell")?.classList.contains("is-list-open"));
  await act(() => store.createRoom("One").then(() => undefined));
  await flush();
  assert(container.querySelector(".convo-shell")?.classList.contains("is-list-open"));
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
  assert(labelled(container, copy.listLabel), "an unknown path goes home");
  await unmount();
  shell.stop();
});

Deno.test("a room that is not on the device is left for the latest room, or for home when there is none", async () => {
  const { shell, env, store } = boot("/c/gone");
  const { container, unmount } = await mount(view(shell));
  await flush();
  assertEquals(env.history.at(-1), "/");
  assert(labelled(container, copy.listLabel));
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
