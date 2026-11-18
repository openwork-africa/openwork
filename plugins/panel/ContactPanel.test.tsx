import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { compose, contribute, definePlugin, getNotices, panelCover, panelSection, panelTab, type Plugin } from "@openwork/kit";
import { ContactPanel } from "./ContactPanel.tsx";
import { copy } from "./copy.ts";
import { flush, mount } from "./testing.tsx";

const section = (id: string, order: number) =>
  definePlugin({ id, version: "0.1.0", contributes: [contribute(panelSection, { id, order, render: () => <p data-section={id}>{id}</p> })] });

const tab = (id: string, order: number) =>
  definePlugin({
    id,
    version: "0.1.0",
    contributes: [contribute(panelTab, { id, order, value: id, label: id, icon: null, render: () => <p data-tab={id}>{id} tab</p> })],
  });

const view = (plugins: Plugin[], roomId?: string, paths: string[] = []) => {
  const product = compose(plugins, {});
  return (
    <product.Root roomId={roomId} navigate={(path) => void paths.push(path)}>
      <ContactPanel roomId={roomId} />
    </product.Root>
  );
};

Deno.test("sections show top to bottom by order, whatever the order the plugins were listed in", async () => {
  const { container, unmount } = await mount(view([section("late", 30), section("first", 10), section("middle", 20)], "r1"));
  assertEquals([...container.querySelectorAll("[data-section]")].map((node) => node.getAttribute("data-section")), ["first", "middle", "late"]);
  assert(container.querySelector(`aside[aria-label="${copy.panelLabel}"]`));
  await unmount();
});

Deno.test("with no tabs there is no tab bar", async () => {
  const { container, unmount } = await mount(view([section("first", 10)], "r1"));
  assertEquals(container.querySelectorAll('[role="tablist"]').length, 0);
  await unmount();
});

Deno.test("with tabs there is a tab bar showing the first tab, and another tab shows when chosen", async () => {
  const { container, unmount } = await mount(view([tab("files", 20), tab("notes", 10)], "r1"));
  const labels = () => [...container.querySelectorAll('[role="tab"]')].map((node) => node.textContent);
  assertEquals(labels().map((label) => label?.startsWith("notes") ? "notes" : "files"), ["notes", "files"]);
  assertEquals(container.querySelector("[data-tab]")?.getAttribute("data-tab"), "notes");
  await act(() => ([...container.querySelectorAll('[role="tab"]')][1] as HTMLElement).click());
  assertEquals(container.querySelector("[data-tab]")?.getAttribute("data-tab"), "files");
  await unmount();
});

Deno.test("zero plugins is an empty panel with no errors", async () => {
  const { container, unmount } = await mount(view([], "r1"));
  await flush();
  assert(container.querySelector(".contact-panel"));
  assertEquals(container.querySelectorAll("[data-section]").length, 0);
  assertEquals(getNotices().filter((notice) => notice.status === "error"), []);
  await unmount();
});

Deno.test("no room draws nothing", async () => {
  const { container, unmount } = await mount(view([section("first", 10)]));
  assertEquals(container.innerHTML, "");
  await unmount();
});

Deno.test("a cover sits above the scroll, outside the animated part, and there is no close button", async () => {
  const cover = definePlugin({
    id: "cover",
    version: "0.1.0",
    contributes: [contribute(panelCover, { id: "cover", order: 10, render: () => <p data-cover>cover</p> })],
  });
  const { container, unmount } = await mount(view([cover, section("first", 10)], "r1"));
  const panel = container.querySelector(".contact-panel") as HTMLElement;
  const nodes = [...panel.children];
  assertEquals(nodes.map((node) => node.hasAttribute("data-cover") || node.classList.contains("contact-scroll")), [true, true]);
  assert(nodes[0].hasAttribute("data-cover"));
  assert(!container.querySelector(".contact-scroll [data-cover]"));
  assertEquals(container.querySelectorAll(".contact-close, button").length, 0);
  await unmount();
});
