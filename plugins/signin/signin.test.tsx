import { assert, assertEquals } from "@std/assert";
import { ConversationWindow } from "@openwork/conversation";
import { labelled, mount, press, rig, until } from "@openwork/conversation/testing";
import { signIn } from "./mod.ts";

const notice = { title: "Sign in to continue", description: "Keep your chats.", actionLabel: "Continue" };

async function open(signedIn: boolean) {
  const calls: string[] = [];
  const device = rig([signIn({ signedIn, onSignIn: () => void calls.push("in"), notice })]);
  const room = await device.store.createRoom("Notes");
  const { container, unmount } = await mount(device.view(<ConversationWindow roomId={room.id} />, room.id));
  await until(() => container.querySelector(".astryx-chat-composer [contenteditable]") !== null);
  return { calls, container, unmount };
}

const button = (container: HTMLElement, text: string) => [...container.querySelectorAll("button")].find((each) => each.textContent?.includes(text)) ?? null;

Deno.test("a guest sees the notice above the composer and Sign in in the + menu", async () => {
  const { container, unmount, calls } = await open(false);
  const text = container.textContent ?? "";
  assert(text.includes("Sign in to continue") && text.includes("Keep your chats."));
  const composer = container.querySelector(".astryx-chat-composer")!;
  assert(!composer.contains(button(container, "Continue")), "the notice is outside the composer");
  assert(button(container, "Continue")!.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING, "and above it");
  await press(labelled(container, "Add to this conversation"));
  assert(button(container, "Sign in"), "the + menu has a Sign in row");
  await press(button(container, "Continue"));
  assertEquals(calls, ["in"]);
  await unmount();
});

Deno.test("clicking Sign in in the + menu calls onSignIn", async () => {
  const { container, unmount, calls } = await open(false);
  await press(labelled(container, "Add to this conversation"));
  await press(button(container, "Sign in"));
  assertEquals(calls, ["in"]);
  await unmount();
});

Deno.test("signed in, there is no notice and no + menu", async () => {
  const { container, unmount } = await open(true);
  assert(!(container.textContent ?? "").includes("Sign in to continue"));
  assertEquals(labelled(container, "Add to this conversation"), null);
  await unmount();
});
