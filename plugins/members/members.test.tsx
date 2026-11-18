import { assert, assertEquals } from "@std/assert";
import { ConversationWindow } from "@openwork/conversation";
import { flush, mount, press, rig } from "@openwork/conversation/testing";
import { addressAddressee, type SlotContext } from "@openwork/kit";
import { type Member, OPERATOR } from "@openwork/store";
import { until } from "@openwork/store/testing";
import { members } from "./mod.ts";

const helper: Member = { id: "op-1", name: "Helper", type: OPERATOR, description: "Answers in this room" };
const nameless: Member = { id: "op-2", name: "", type: OPERATOR };
const ama: Member = { id: "p-1", name: "Ama", type: "person" };

async function open(directory: Member[] = [helper, nameless, ama]) {
  const device = rig([members({ directory })]);
  const room = await device.store.createRoom("Family");
  const ctx = { roomId: room.id, ports: device.product.ports } as unknown as SlotContext;
  return { ...device, room, ctx, provider: device.product.registry.slot(addressAddressee)[0] };
}

Deno.test("the address bar suggests people and operators from the directory, an operator by its name and description", async () => {
  const { provider, ctx } = await open();
  const all = await provider.suggest("", ctx);
  assertEquals(all.map((pick) => [pick.label, pick.description]), [["Helper", "Answers in this room"], ["Unnamed operator", "Operator"], ["Ama", undefined]]);
  assertEquals((await provider.suggest("ama", ctx)).map((pick) => pick.label), ["Ama"]);
});

Deno.test("text that matches no one offers Create operator", async () => {
  const { provider, ctx } = await open();
  assertEquals((await provider.suggest("zed", ctx)).map((pick) => pick.label), ["Create operator “zed”"]);
  assertEquals((await provider.suggest("help", ctx)).map((pick) => pick.label), ["Helper"]);
});

Deno.test("picking an operator adds one member and one status line, and picking it again adds nothing", async () => {
  const { provider, ctx, store, room } = await open();
  const [pick] = await provider.suggest("", ctx);
  await provider.add(pick, ctx);
  await provider.add(pick, ctx);
  const trail = await until(store.trail(room.id), (list) => list.length >= 1);
  assertEquals(trail.map((message) => [message.kind, message.content]), [["member.added", "Helper was added"]]);
  assertEquals((await until(store.room(room.id)))?.members, [helper]);
  assertEquals((await provider.suggest("", ctx)).map((each) => each.label), ["Unnamed operator", "Ama"], "someone already in is not offered again");
});

Deno.test("picking a person adds them, and Create operator makes a new operator member", async () => {
  const { provider, ctx, store, room } = await open();
  await provider.add((await provider.suggest("ama", ctx))[0], ctx);
  await provider.add((await provider.suggest("zed", ctx))[0], ctx);
  const added = (await until(store.room(room.id), (each) => (each?.members?.length ?? 0) === 2))?.members ?? [];
  assertEquals(added.map((member) => [member.name, member.type]), [["Ama", "person"], ["zed", OPERATOR]]);
  assertEquals((await until(store.trail(room.id), (list) => list.length === 2)).map((message) => message.content), ["Ama was added", "zed was added"]);
});

Deno.test("the window draws the status line and the address bar opens onto the picker", async () => {
  const { store, view, room, provider, ctx } = await open();
  await provider.add((await provider.suggest("", ctx))[0], ctx);
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await flush(200);
  assert((container.textContent ?? "").includes("Helper was added ·"), "the status line draws centered with its time, like the legacy one");
  const name = [...container.querySelectorAll("button")].find((button) => button.textContent === "Helper");
  assert(name, "a room of one operator is titled with its name");
  await press(name!);
  await flush(200);
  assert(container.querySelector(`[aria-label="Search for someone"], input`), "the picker");
  assertEquals((await until(store.trail(room.id))).length, 1);
  await unmount();
});

Deno.test("a one-to-one room with an operator is titled with its name; a room with two others keeps its own title", async () => {
  const { provider, ctx, store, room } = await open();
  await provider.add((await provider.suggest("help", ctx))[0], ctx);
  const { roomTitle } = await import("@openwork/store");
  assertEquals(roomTitle((await until(store.room(room.id)))!), "Helper");
  await provider.add((await provider.suggest("ama", ctx))[0], ctx);
  assertEquals(roomTitle((await until(store.room(room.id), (each) => (each?.members?.length ?? 0) === 2))!), "Family");
});
