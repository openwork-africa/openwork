import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import type { MemoryDeviceStore, Room } from "@openwork/store";
import { click, bootProduct, errorNotices, flush } from "./harness.tsx";

const labelled = (container: HTMLElement, label: string): HTMLElement | null => container.querySelector(`[aria-label="${label}"]`);

async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  await act(() => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // happy-dom hands React the input event only with the next one.
  await act(() => void input.dispatchEvent(new KeyboardEvent("keyup", { key: "x", bubbles: true })));
  await flush();
}

const roomsOf = (store: MemoryDeviceStore): Promise<Room[]> => new Promise((done) => {
  const live = store.rooms();
  const stop = live.subscribe(() => {
    const value = live.get();
    if (value?.length) queueMicrotask(stop), done(value);
  });
  const value = live.get();
  if (value?.length) queueMicrotask(stop), done(value);
});

const addressName = (container: HTMLElement): string => container.querySelector(".address-field")?.textContent ?? "";
const circleText = (container: HTMLElement): string => labelled(container, "Conversations")?.textContent ?? "";

Deno.test("the product: New, send, profile, rename and describe, end to end", async () => {
  const app = await bootProduct();
  const { container, store } = app;
  assertEquals(app.shell.product.problems, []);

  await click(container.querySelector(".convo-loading button"));
  const [room] = await roomsOf(store);
  await flush();
  assertEquals(app.path(), `/c/${room.id}`);
  assert(addressName(container).includes(room.name), "the address bar shows the room");

  const field = container.querySelector("[contenteditable]") as HTMLElement;
  field.textContent = "Lunch at one?";
  await act(() => void field.dispatchEvent(new InputEvent("input", { bubbles: true })));
  await click(labelled(container, "Send"));
  assert((container.querySelector(`[id^="msg-"]`)?.textContent ?? "").includes("Lunch at one?"), "in the trail");
  assert(circleText(container).includes("Lunch at one?"), "as the row preview");

  await click(labelled(container, "Open contact details"));
  assertEquals(app.path(), `/c/${room.id}/profile`);

  await click([...container.querySelectorAll<HTMLElement>(".contact-hero-body button")].find((button) => button.textContent === room.name) ?? null);
  const input = container.querySelector("input") as HTMLInputElement;
  await typeInto(input, "Lunch plans");
  await act(() => void input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  await flush();
  assert(circleText(container).includes("Lunch plans"), "the new name in the circle");
  assert(addressName(container).includes("Lunch plans"), "and in the address bar");

  await click([...container.querySelectorAll<HTMLElement>("button")].find((button) => button.classList.contains("description-line")) ?? null);
  const description = container.querySelector("input") as HTMLInputElement;
  await typeInto(description, "Where we eat");
  await act(() => void description.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  await flush();
  assertEquals((await roomsOf(store))[0].description, "Where we eat");
  assertEquals(errorNotices(), []);
  await app.stop();
});

Deno.test("the page frame fills the viewport (.app-shell > .app-page > .convo-shell) and the Circle shows on / with no rooms", async () => {
  const app = await bootProduct();
  const { container } = app;
  assert(container.querySelector(".app-shell > .app-page.app-page-conversation > .convo-shell"), "the page structure");
  const circle = container.querySelector(".convo-shell nav.convo-circle");
  assert(circle, "the Circle region is rendered");
  assert(labelled(container, "Conversations")?.contains(circle), "inside the list panel");
  assert(circle.querySelector(".convo-circle-list"), "the real Circle, not the shell's placeholder");
  await app.stop();
});
