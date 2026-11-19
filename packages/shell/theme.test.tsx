import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { manualConnectivity } from "@openwork/store";
import { memoryPorts } from "@openwork/store/testing";
import { THEME_BY_ID } from "@openwork/ui";
import { bootShell } from "./boot.ts";
import { createRouter } from "./router.ts";
import { ShellApp } from "./ShellApp.tsx";
import { flush, memoryEnv, mount } from "./testing.tsx";

const root = () => document.documentElement;
const base = () => root().getAttribute("data-base");

Deno.test("the theme follows the open conversation: its own base while open, the device default otherwise", async () => {
  const env = memoryEnv("/");
  const ports = memoryPorts();
  const { store } = ports;
  const shell = bootShell({
    plugins: [],
    ports,
    connectivity: manualConnectivity(true),
    router: createRouter(env),
  });
  const dark = await store.createRoom("Dark", { background: "midnight" });
  const plain = await store.createRoom("Plain");
  const photo = await store.createRoom("Photo", { background: "file:abc" });
  const accented = await store.createRoom("Accented", { background: "file:abc" });
  await store.setRoomBackground(accented.id, "file:abc", "#d14c2c");
  const { unmount } = await mount(<ShellApp product={shell.product} router={shell.router} regions={shell.regions} drawer={shell.drawer} />);

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
  await act(() => shell.router.navigate(`/c/${accented.id}`));
  await flush();
  assertEquals(base(), "white", "uploaded images keep the default base");
  assertEquals(root().getAttribute("data-theme"), "light", "accent does not change the device scheme");

  await act(() => shell.router.navigate(`/c/${dark.id}`));
  await flush();
  await act(() => shell.router.navigate("/"));
  await flush();
  const latestPath = shell.router.path();
  assert(latestPath.startsWith("/c/"), "home resolves to a conversation");
  const latestId = latestPath.slice("/c/".length);
  assertEquals(base(), latestId === dark.id ? "midnight" : "white");
  await unmount();
  shell.stop();
});

Deno.test("a theme passed to the shell is shown instead of the default; a conversation's own base still wins", async () => {
  const env = memoryEnv("/");
  const ports = memoryPorts();
  const shell = bootShell({ plugins: [], ports, connectivity: manualConnectivity(true), router: createRouter(env) });
  const dark = await ports.store.createRoom("Dark", { background: "midnight" });
  const plain = await ports.store.createRoom("Plain");
  const own = { theme: THEME_BY_ID.gothic.theme, scheme: "dark" as const };
  const { unmount } = await mount(<ShellApp product={shell.product} router={shell.router} regions={shell.regions} drawer={shell.drawer} theme={own} />);
  await act(() => shell.router.navigate(`/c/${plain.id}`));
  await flush();
  assertEquals([root().getAttribute("data-theme"), root().getAttribute("data-astryx-theme")], ["dark", "gothic"]);
  await act(() => shell.router.navigate(`/c/${dark.id}`));
  await flush();
  assertEquals(root().getAttribute("data-astryx-theme"), "midnight");
  await unmount();
  shell.stop();
});
