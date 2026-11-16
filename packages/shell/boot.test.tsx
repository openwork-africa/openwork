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
  assert(labelled(container, copy.listLabel) && labelled(container, copy.panelLabel));
  assert(container.querySelector(".convo-loading")?.textContent?.includes(copy.noRoomsTitle));
  assertEquals(shell.product.problems, []);
  assertEquals(getNotices().filter((notice) => notice.status === "error"), []);
  await unmount();
  shell.stop();
});

Deno.test("a room path opens the room, and the profile path opens the panel drawer until it is closed", async () => {
  const { shell, env } = boot("/c/r1/profile");
  const { container, unmount } = await mount(view(shell));
  assert(container.querySelector(".convo-shell")?.classList.contains("is-panel-open"));
  await act(() => (container.querySelector(".convo-scrim") as HTMLElement).click());
  assertEquals(env.history.at(-1), "/c/r1");
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
  assert(container.textContent?.includes(copy.notFoundTitle));
  await act(() => (container.querySelector("button") as HTMLElement).click());
  assert(labelled(container, copy.listLabel));
  await unmount();
  shell.stop();
});
