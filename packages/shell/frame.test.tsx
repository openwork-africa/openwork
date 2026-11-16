import { assert, assertEquals } from "@std/assert";
import { act, useState, type ReactElement } from "react";
import { Frame } from "./Frame.tsx";
import { copy } from "./copy.ts";
import { flush, labelled, mount } from "./testing.tsx";

const noop = () => {};

const Marker = (name: string) => ({ roomId }: { roomId?: string }): ReactElement => <p data-region={name}>{`${name}:${roomId ?? "none"}`}</p>;

Deno.test("the frame has a list, a window and a panel, each with its empty state", async () => {
  const { container, unmount } = await mount(<Frame drawer="none" onDrawer={noop} />);
  assert(labelled(container, copy.listLabel), "list panel");
  assert(labelled(container, copy.panelLabel), "contact panel");
  assertEquals(container.querySelectorAll(".convo-shell").length, 1);
  const text = container.textContent ?? "";
  for (const expected of [copy.circleEmptyTitle, copy.noRoomTitle, copy.panelEmpty]) assert(text.includes(expected), expected);
  assert(container.querySelector('svg[aria-label="Openwork"]'), "the logo is the no-room mark");
  await unmount();
});

Deno.test("with no room open the window is drawn inside the window's frame, centred", async () => {
  const { container, unmount } = await mount(<Frame drawer="none" onDrawer={noop} />);
  assert(container.querySelector(".convo-loading")?.querySelector('svg[aria-label="Openwork"]'), "the logo is inside the frame");
  assert(container.querySelector(".convo-loading")?.textContent?.includes(copy.noRoomTitle));
  await unmount();
});

Deno.test("with no rooms at all the frame offers to start one, and only when it can", async () => {
  let started = 0;
  const { container, unmount } = await mount(<Frame noRooms onStart={() => void started++} drawer="none" onDrawer={noop} />);
  const frame = container.querySelector(".convo-loading") as HTMLElement;
  assert(frame.textContent?.includes(copy.noRoomsTitle));
  await act(() => (frame.querySelector("button") as HTMLElement).click());
  assertEquals(started, 1);
  await unmount();
  const bare = await mount(<Frame noRooms drawer="none" onDrawer={noop} />);
  assertEquals(bare.container.querySelector(".convo-loading button"), null);
  await bare.unmount();
});

Deno.test("regions the product passes in are rendered in their panes and told the room", async () => {
  const { container, unmount } = await mount(
    <Frame circle={Marker("circle")} window={Marker("window")} panel={Marker("panel")} roomId="r1" drawer="none" onDrawer={noop} />,
  );
  assertEquals(labelled(container, copy.listLabel)?.textContent, "circle:r1");
  assertEquals(labelled(container, copy.panelLabel)?.textContent, "panel:r1");
  assertEquals(container.querySelector('[data-region="window"]')?.textContent, "window:r1");
  await unmount();
});

Deno.test("with no room open the window region is not asked for: the no-room mark shows instead", async () => {
  const { container, unmount } = await mount(<Frame window={Marker("window")} drawer="none" onDrawer={noop} />);
  assertEquals(container.querySelector('[data-region="window"]'), null);
  assert((container.textContent ?? "").includes(copy.noRoomTitle));
  await unmount();
});

Deno.test("a drawer is open by class, and the scrim closes it", async () => {
  const closed: string[] = [];
  const { container, unmount } = await mount(<Frame drawer="panel" onDrawer={(drawer) => closed.push(drawer)} />);
  assert(container.querySelector(".convo-shell")?.classList.contains("is-panel-open"));
  await act(() => (container.querySelector(".convo-scrim") as HTMLElement).click());
  assertEquals(closed, ["none"]);
  await unmount();
});

Deno.test("a region that fails is an island: the others stay, and Try again brings it back", async () => {
  let broken = true;
  const Window = (): ReactElement => {
    if (broken) throw new Error("window blew up");
    return <p>window is back</p>;
  };
  const Host = (): ReactElement => {
    const [roomId] = useState("r1");
    return <Frame circle={Marker("circle")} window={Window} panel={Marker("panel")} roomId={roomId} drawer="none" onDrawer={noop} />;
  };
  const { container, unmount } = await mount(<Host />);
  const text = () => container.textContent ?? "";
  assert(text().includes(copy.windowName) && text().includes("Couldn't show"), text());
  assert(text().includes("circle:r1") && text().includes("panel:r1"), "the other islands carry on");
  broken = false;
  const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "Try again") as HTMLElement;
  await act(() => retry.click());
  await flush();
  assert(text().includes("window is back"));
  await unmount();
});
