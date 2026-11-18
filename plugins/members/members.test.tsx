import { assert, assertEquals } from "@std/assert";
import { ConversationWindow } from "@openwork/conversation";
import { flush, mount, press, rig } from "@openwork/conversation/testing";
import { until } from "@openwork/store/testing";
import { addressAddressee, type SlotContext } from "@openwork/kit";
import { copy } from "./copy.ts";
import { MEMBER_ADDED, members } from "./mod.ts";

async function open() {
  const device = rig([members]);
  const room = await device.store.createRoom("Family");
  const ctx = { roomId: room.id, ports: device.product.ports } as unknown as SlotContext;
  return { ...device, room, ctx, provider: device.product.registry.slot(addressAddressee)[0] };
}

Deno.test("the address bar suggests the assistant, and a typed name as a person", async () => {
  const { provider, ctx } = await open();
  assertEquals((await provider.suggest("", ctx)).map((pick) => pick.label), ["Assistant"]);
  assertEquals((await provider.suggest("assi", ctx)).map((pick) => pick.label), ["Assistant"]);
  assertEquals((await provider.suggest("Ama", ctx)).map((pick) => pick.label), ["Ama"]);
});

Deno.test("picking the assistant adds it with one status line, and picking it again adds nothing", async () => {
  const { provider, ctx, store, room } = await open();
  const [assistant] = await provider.suggest("", ctx);
  await provider.add(assistant, ctx);
  await provider.add(assistant, ctx);
  const trail = await until(store.trail(room.id), (list) => list.length >= 1);
  assertEquals(trail.map((message) => [message.kind, message.content]), [[MEMBER_ADDED, copy.joined("Assistant")]]);
});

Deno.test("picking a person adds them with their own status line", async () => {
  const { provider, ctx, store, room } = await open();
  const [ama] = await provider.suggest("Ama", ctx);
  await provider.add(ama, ctx);
  assertEquals((await until(store.trail(room.id), (list) => list.length === 1)).map((message) => message.content), ["Ama joined"]);
});

Deno.test("the window draws the status line, and the address bar opens onto the picker", async () => {
  const { store, view, room, provider, ctx } = await open();
  await provider.add((await provider.suggest("", ctx))[0], ctx);
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await flush(200);
  assert((container.textContent ?? "").includes("Assistant joined"));
  const name = [...container.querySelectorAll("button")].find((button) => button.textContent === "Family");
  assert(name, "the room name opens the picker now that a plugin offers addressees");
  await press(name!);
  await flush(200);
  assert(container.querySelector(`[aria-label="Search for someone"], input`), "the picker");
  assertEquals((await until(store.trail(room.id))).length, 1);
  await unmount();
});
