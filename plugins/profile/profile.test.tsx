import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { compose, getNotices, dismiss } from "@openwork/kit";
import { ContactPanel } from "@openwork/panel";
import { flush, mount } from "@openwork/panel/testing";
import { ManualClock, MemoryDeviceStore, MemoryFileStore, MemoryTransport, type Room } from "@openwork/store";
import { copy } from "./copy.ts";
import { profilePlugin } from "./plugin.tsx";

async function setup() {
  document.body.innerHTML = "";
  getNotices().forEach((notice) => dismiss(notice.id));
  const clock = new ManualClock();
  const store = new MemoryDeviceStore(clock);
  const files = new MemoryFileStore();
  const room = await store.createRoom("Notes");
  const product = compose([profilePlugin], { store, files, transport: new MemoryTransport(), clock });
  const mounted = await mount(
    <product.Root roomId={room.id} navigate={() => {}}>
      <ContactPanel roomId={room.id} />
    </product.Root>,
  );
  await flush();
  return { ...mounted, store, files, room };
}

const byLabel = (label: string): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>("[aria-label], button, [role='button']")].find((node) =>
    node.getAttribute("aria-label") === label || (node.textContent ?? "").trim().startsWith(label)
  ) ?? null;

async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  await act(() => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // happy-dom hands React the input event only with the next one.
  await act(() => void input.dispatchEvent(new KeyboardEvent("keyup", { key: "x", bubbles: true })));
  await flush();
}

const clickAndWait = (button: HTMLElement): Promise<void> =>
  act(async () => {
    button.click();
    await new Promise((done) => setTimeout(done, 30));
  });

const leave = (input: HTMLElement): void => void input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

function answerChooser(file: File): () => void {
  const create = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const element = create(tag);
    if (tag === "input") {
      element.click = () => {
        Object.defineProperty(element, "files", { value: [file] });
        element.dispatchEvent(new Event("change"));
      };
    }
    return element;
  }) as typeof document.createElement;
  return () => void (document.createElement = create);
}

const labelled = (label: string): HTMLElement => {
  const found = byLabel(label);
  assert(found, `no "${label}"`);
  return found;
};

Deno.test("the profile is the panel's section: cover, picture, name and description", async () => {
  const { container, unmount } = await setup();
  assert(container.querySelector(".profile-cover"));
  assert(container.querySelector(".profile-avatar"));
  assert(byLabel(copy.changeBackground));
  assert(container.textContent?.includes("Notes"));
  assert(container.textContent?.includes(copy.descriptionPlaceholder));
  await unmount();
});

Deno.test("the name is renamed in place", async () => {
  const { store, room, container, unmount } = await setup();
  await act(() => labelled("Notes").click());
  const input = container.querySelector("input")!;
  await typeInto(input, "  Ideas  ");
  await act(() => leave(input));
  await flush();
  assertEquals((await roomNow(store, room.id)).name, "Ideas");
  await unmount();
});

Deno.test("the description is typed in place, and clearing it removes it", async () => {
  const { store, room, container, unmount } = await setup();
  await act(() => labelled(copy.descriptionPlaceholder).click());
  const input = container.querySelector("input")!;
  await typeInto(input, "My notes");
  await act(() => leave(input));
  await flush();
  assertEquals((await roomNow(store, room.id)).description, "My notes");
  await act(() => labelled("My notes").click());
  const again = container.querySelector("input")!;
  await typeInto(again, "  ");
  await act(() => leave(again));
  await flush();
  assertEquals((await roomNow(store, room.id)).description, undefined);
  await unmount();
});

Deno.test("picking a theme cover saves the base name as the background", async () => {
  const { store, room, container, unmount } = await setup();
  await act(() => labelled(copy.changeBackground).click());
  await flush();
  const choices = [...document.querySelectorAll(`[aria-label="${copy.backgrounds}"] button, [aria-label="${copy.backgrounds}"] [role="button"]`)];
  assert(choices.length >= 12, "upload card and eleven theme covers");
  await act(() => labelled(copy.backgroundOf("Ember")).click());
  await flush();
  assertEquals((await roomNow(store, room.id)).background, "ember");
  assert(container.querySelector(".profile-cover")?.getAttribute("style")?.includes("/assets/covers/ember.jpg"));
  await unmount();
});

Deno.test("uploading a background keeps the bytes and a file record, and saves file:<id>", async () => {
  const { store, files, room, unmount } = await setup();
  const restore = answerChooser(new File(["pixels"], "sky.png", { type: "image/png" }));
  await act(() => labelled(copy.changeBackground).click());
  await flush();
  await clickAndWait(labelled(copy.uploadPicture));
  restore();
  const background = (await roomNow(store, room.id)).background;
  assert(background?.startsWith("file:"), String(background));
  const id = background!.slice(5);
  assertEquals(await (await files.get(id))?.text(), "pixels");
  const changes = await Promise.all((await store.journal.pending()).map((row) => store.journal.changeOf(row)));
  const record = changes.find((change) => change?.kind === "file");
  assertEquals(record?.id, id);
  assertEquals(record?.data, { id, parentId: room.id, name: "sky.png", mimeType: "image/png", size: 6, createdAt: record?.updatedAt, updatedAt: record?.updatedAt });
  await unmount();
});

Deno.test("uploading a picture saves file:<id> as the profile picture", async () => {
  const { store, files, room, unmount } = await setup();
  const restore = answerChooser(new File(["face"], "me.jpg", { type: "image/jpeg" }));
  await act(() => labelled(copy.changeImage).click());
  await flush();
  await clickAndWait(labelled(copy.uploadImage));
  restore();
  const picture = (await roomNow(store, room.id)).picture;
  assert(picture?.startsWith("file:"), String(picture));
  assertEquals(await (await files.get(picture!.slice(5)))?.text(), "face");
  await unmount();
});

async function roomNow(store: MemoryDeviceStore, id: string): Promise<Room> {
  const live = store.room(id);
  const stop = live.subscribe(() => {});
  await new Promise((done) => setTimeout(done, 30));
  stop();
  return live.get() as Room;
}
