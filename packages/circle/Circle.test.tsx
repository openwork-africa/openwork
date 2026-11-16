import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { MemoryDeviceStore } from "@openwork/store";
import { Circle } from "./Circle.tsx";
import { ConfirmDelete } from "./ConfirmDelete.tsx";
import { copy } from "./copy.ts";
import { fakePlugin, fakeSource, flush, host, mount, row } from "./testing.tsx";

const store = new MemoryDeviceStore();
const ports = { store };
const names = (container: HTMLElement): string[] =>
  [...container.querySelectorAll("[aria-label]")].map((element) =>
    element.getAttribute("aria-label") ?? ""
  );
const button = (container: HTMLElement, label: string): HTMLElement | null =>
  container.querySelector(`button[aria-label="${label}"]`);

Deno.test("rows from every source are merged, most recent first, and a row id is shown once", async () => {
  const first = fakeSource();
  const second = fakeSource();
  first.set([row("a", "Alpha", 10), row("c", "Gamma", 30)]);
  second.set([row("b", "Beta", 20), row("a", "Alpha again", 99)]);
  const plugin = fakePlugin({
    sources: [{ id: "one", observable: first.observable }, {
      id: "two",
      observable: second.observable,
    }],
  });
  const { container, unmount } = await mount(host([plugin], ports, <Circle />));
  const text = container.textContent ?? "";
  assert(
    text.indexOf("Gamma") < text.indexOf("Beta") &&
      text.indexOf("Beta") < text.indexOf("Alpha"),
    text,
  );
  assert(!text.includes("Alpha again"));
  await unmount();
});

Deno.test("while a source has not answered the list is a loading skeleton, then the rows", async () => {
  const source = fakeSource();
  const plugin = fakePlugin({
    sources: [{ id: "one", observable: source.observable }],
  });
  const { container, unmount } = await mount(host([plugin], ports, <Circle />));
  assert(
    container.querySelector(
      `[role="status"][aria-label="${copy.loadingLabel}"]`,
    ),
    "skeleton",
  );
  await act(() => source.set([row("a", "Alpha", 1)]));
  assert(!container.querySelector('[role="status"]'));
  assert((container.textContent ?? "").includes("Alpha"));
  await unmount();
});

Deno.test("with nothing to show the circle draws no card, only what circle.empty plugins draw", async () => {
  const source = fakeSource();
  source.set([]);
  const plain = await mount(
    host(
      [fakePlugin({ sources: [{ id: "one", observable: source.observable }] })],
      ports,
      <Circle />,
    ),
  );
  assertEquals(plain.container.querySelector(".empty-card"), null);
  assertEquals(plain.container.querySelector(".convo-circle-list")?.textContent, "");
  await plain.unmount();
  const own = await mount(
    host(
      [fakePlugin({
        sources: [{ id: "one", observable: source.observable }],
        empty: [{ id: "e", text: "Start here" }],
      })],
      ports,
      <Circle />,
    ),
  );
  const text = own.container.textContent ?? "";
  assert(text.includes("Start here"));
  await own.unmount();
});

Deno.test("a tab bar shows only with two or more tabs, and a tab filters the rows", async () => {
  const source = fakeSource();
  source.set([row("a", "Alpha", 2, { unread: 1 }), row("b", "Beta", 1)]);
  const sources = [{ id: "one", observable: source.observable }];
  const one = await mount(
    host(
      [fakePlugin({
        sources,
        tabs: [{
          id: "all",
          label: "All",
          filter: () => true,
        }],
      })],
      ports,
      <Circle />,
    ),
  );
  assertEquals(one.container.querySelectorAll('[role="tab"]').length, 0);
  await one.unmount();
  const two = await mount(
    host(
      [fakePlugin({
        sources,
        tabs: [{
          id: "all",
          label: "All",
          filter: () => true,
        }, {
          id: "unread",
          label: "Unread",
          filter: (each) => !!each.unread,
        }],
      })],
      ports,
      <Circle />,
    ),
  );
  const tabs = [...two.container.querySelectorAll('[role="tab"]')];
  assertEquals(tabs.length, 2);
  assert(
    tabs[0].textContent?.includes("All") &&
      tabs[1].textContent?.includes("Unread"),
  );
  await act(() => (tabs[1] as HTMLElement).click());
  const text = two.container.textContent ?? "";
  assert(text.includes("Alpha") && !text.includes("Beta"), text);
  await two.unmount();
});

Deno.test("the unread count shows on a row, except the open one; selecting a row opens /c/:id", async () => {
  const source = fakeSource();
  source.set([
    row("a", "Alpha", 2, { unread: 3 }),
    row("b", "Beta", 1, { unread: 5 }),
  ]);
  const opened: string[] = [];
  const { container, unmount } = await mount(
    host(
      [fakePlugin({ sources: [{ id: "one", observable: source.observable }] })],
      ports,
      <Circle />,
      { roomId: "b", navigate: (path) => void opened.push(path) },
    ),
  );
  assert(container.querySelector('[aria-label="3 unread"]'));
  assert(!container.querySelector('[aria-label="5 unread"]'));
  await act(() =>
    (container.querySelector('[aria-label="Alpha"]') as HTMLElement).click()
  );
  assertEquals(opened, ["/c/a"]);
  await unmount();
});

Deno.test("a row has a context menu from circle.rowMenu only when a plugin adds items", async () => {
  const source = fakeSource();
  source.set([row("a", "Alpha", 1)]);
  const sources = [{ id: "one", observable: source.observable }];
  const bare = await mount(host([fakePlugin({ sources })], ports, <Circle />));
  assert(!bare.container.querySelector('[aria-label="Alpha actions"]'));
  await bare.unmount();
  const menu = await mount(
    host(
      [fakePlugin({
        sources,
        menu: [{ id: "m", label: "Delete", danger: true, run: () => {} }],
      })],
      ports,
      <Circle />,
    ),
  );
  assert(
    menu.container.querySelector('[aria-label="Alpha actions"]'),
    "the row is wrapped in a menu",
  );
  await menu.unmount();
});

Deno.test("New runs rooms.create and is hidden without it", async () => {
  const source = fakeSource();
  source.set([]);
  const plugin = fakePlugin({
    sources: [{ id: "one", observable: source.observable }],
  });
  const without = await mount(host([plugin], ports, <Circle />));
  assertEquals(button(without.container, copy.newLabel), null);
  await without.unmount();
  let created = 0;
  const withIt = await mount(
    host([plugin], ports, <Circle />, {
      commands: { "rooms.create": () => void created++ },
    }),
  );
  await act(() => button(withIt.container, copy.newLabel)!.click());
  assertEquals(created, 1);
  await withIt.unmount();
});

Deno.test("while the device is catching up, loading rows follow the rows and the empty card waits", async () => {
  const source = fakeSource();
  source.set([]);
  await act(() => store.journal.setStatus("catchingUp"));
  const { container, unmount } = await mount(
    host(
      [fakePlugin({
        sources: [{ id: "one", observable: source.observable }],
        empty: [{ id: "e", text: "Start here" }],
      })],
      ports,
      <Circle />,
    ),
  );
  await flush();
  assert(container.querySelector('[role="status"]'), "catching-up rows");
  assert(!(container.textContent ?? "").includes("Start here"));
  await act(() => store.journal.setStatus("current"));
  await flush();
  assert((container.textContent ?? "").includes("Start here"));
  await unmount();
});

Deno.test("with zero plugins the circle is the empty frame, without errors", async () => {
  const { container, unmount } = await mount(host([], ports, <Circle />));
  assertEquals(container.querySelector(".convo-circle-list")?.textContent, "");
  assertEquals(button(container, copy.newLabel), null);
  assert(!names(container).includes(copy.loadingLabel));
  await unmount();
});

Deno.test("deleting asks first: Cancel and the danger label are the two answers", async () => {
  const answers: string[] = [];
  const { unmount } = await mount(<ConfirmDelete name="Alpha" label="Delete" onCancel={() => answers.push("cancel")} onConfirm={() => answers.push("confirm")} />);
  const buttons = [...document.querySelectorAll("button")].filter((each) => ["Cancel", "Delete"].includes(each.textContent ?? ""));
  assertEquals(buttons.map((each) => each.textContent), ["Cancel", "Delete"]);
  assert(document.body.textContent?.includes("“Alpha” will be deleted."));
  await act(() => buttons[1].click());
  await act(() => buttons[0].click());
  assertEquals(answers, ["confirm", "cancel"]);
  await unmount();
});
