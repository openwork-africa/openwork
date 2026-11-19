import { assert, assertEquals } from "@std/assert";
import { rooms } from "@openwork/plugin-rooms";
import { text } from "@openwork/plugin-text";
import type { Member } from "@openwork/store";
import { until } from "@openwork/store/testing";
import { bootProduct, flush } from "./harness.tsx";

const agent: Member = { id: "5f0c7a52-3b1e-4d6a-9a47-8e2c1b0d6f31", name: "Agent", type: "operator" };
const plugins = [rooms({ defaultRoom: { members: [agent] } }), text];

const carrying = <T extends { members?: Member[] }>(list: T[]) => list.filter((room) => room.members?.some((each) => each.id === agent.id));

Deno.test("default room: no operator and no room makes one room with the operator, and opens it", async () => {
  const app = await bootProduct(plugins, "/");
  await flush();
  const list = await until(app.store.rooms(), (each) => each.length === 1);
  assertEquals(list[0].members, [agent]);
  assert(app.path().startsWith(`/c/${list[0].id}`));
  await app.stop();
});

Deno.test("default room: the operator's room already there makes nothing and opens it, not the newer room", async () => {
  const app = await bootProduct(plugins, "/", async (store) => {
    await store.createRoom("With agent", { members: [agent] });
    await store.createRoom("Newer, empty");
  });
  await flush();
  const list = await until(app.store.rooms(), (each) => each.length >= 2);
  assertEquals(list.length, 2, "nothing made");
  const [home] = carrying(list);
  assert(app.path().startsWith(`/c/${home.id}`), `landed on the operator room, got ${app.path()}`);
  await app.stop();
});

Deno.test("default room: rooms without the operator get one room with it, the others stay", async () => {
  const app = await bootProduct(plugins, "/", async (store) => {
    await store.createRoom("Plain");
  });
  await flush();
  const list = await until(app.store.rooms(), (each) => each.length >= 2);
  assertEquals(list.length, 2);
  assertEquals(carrying(list).length, 1);
  assert(app.path().startsWith(`/c/${carrying(list)[0].id}`));
  await app.stop();
});

Deno.test("default room: a /c/<id> link is respected, and the operator room is still made", async () => {
  const PLAIN = "b1a7e8f0-0000-4000-8000-000000000001";
  const app = await bootProduct(plugins, `/c/${PLAIN}`, async (store) => {
    const uuid = crypto.randomUUID;
    crypto.randomUUID = () => PLAIN as `${string}-${string}-${string}-${string}-${string}`;
    try {
      await store.createRoom("Plain");
    } finally {
      crypto.randomUUID = uuid;
    }
  });
  await flush();
  const list = await until(app.store.rooms(), (each) => each.length >= 2);
  assertEquals(carrying(list).length, 1);
  assert(app.path().startsWith(`/c/${PLAIN}`), `stayed on the linked room, got ${app.path()}`);
  await app.stop();
});

Deno.test("default room: a second boot on the same device makes nothing more", async () => {
  const app = await bootProduct(plugins, "/");
  await flush();
  const [made] = await until(app.store.rooms(), (each) => each.length === 1);
  await app.stop();
  const again = await bootProduct(plugins, "/", async (store) => {
    await store.createRoom(made.name, { members: [agent] });
  });
  await flush();
  const list = await until(again.store.rooms(), (each) => each.length >= 1);
  assertEquals(list.length, 1);
  assertEquals(carrying(list).length, 1);
  await again.stop();
});
