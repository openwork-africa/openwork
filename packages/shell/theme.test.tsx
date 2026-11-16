import { assertEquals } from "@std/assert";
import { act } from "react";
import { ManualClock, manualConnectivity, MemoryDeviceStore, MemoryFileStore, MemoryTransport } from "@openwork/store";
import { bootShell } from "./boot.ts";
import { createRouter } from "./router.ts";
import { ShellApp } from "./ShellApp.tsx";
import { flush, memoryEnv, mount } from "./testing.tsx";

const root = () => document.documentElement;
const base = () => root().getAttribute("data-base");

Deno.test("the theme follows the open conversation: its own base while open, the device default otherwise", async () => {
  const env = memoryEnv("/");
  const clock = new ManualClock();
  const store = new MemoryDeviceStore(clock);
  const shell = bootShell({
    plugins: [],
    ports: { store, files: new MemoryFileStore(), transport: new MemoryTransport(), clock },
    connectivity: manualConnectivity(true),
    router: createRouter(env),
  });
  const dark = await store.createRoom("Dark", { background: "midnight" });
  const plain = await store.createRoom("Plain");
  const photo = await store.createRoom("Photo", { background: "file:abc" });
  const { unmount } = await mount(<ShellApp product={shell.product} router={shell.router} regions={shell.regions} />);

  await act(() => shell.router.navigate(`/c/${dark.id}`));
  await flush();
  assertEquals(base(), "midnight");
  assertEquals([root().getAttribute("data-theme"), root().getAttribute("data-astryx-theme")], ["dark", "midnight"]);

  await act(() => shell.router.navigate(`/c/${plain.id}`));
  await flush();
  assertEquals([base(), root().getAttribute("data-theme")], ["white", "light"]);

  await act(() => shell.router.navigate(`/c/${dark.id}`));
  await flush();
  assertEquals(base(), "midnight");
  await act(() => shell.router.navigate(`/c/${photo.id}`));
  await flush();
  assertEquals(base(), "white", "an uploaded image keeps the device default");

  await act(() => shell.router.navigate(`/c/${dark.id}`));
  await flush();
  await act(() => shell.router.navigate("/"));
  await flush();
  assertEquals(base(), "white");
  await unmount();
  shell.stop();
});
