import { addressAddressee, type Addressee, contribute, definePlugin, type SlotContext, trailBody } from "@openwork/kit";
import { devicePorts, type Live, type TrailMessage } from "@openwork/store";
import { Text } from "@astryxdesign/core/Text";
import { copy } from "./copy.ts";

/** The kind of the message that says someone joined the room; its words are the status line itself. */
export const MEMBER_ADDED = "member.added";
const ASSISTANT_ID = "assistant";

const firstOf = <T,>(live: Live<T>): Promise<T> =>
  new Promise((resolve) => {
    const stop = live.subscribe(() => {
      const value = live.get();
      if (value === undefined) return;
      queueMicrotask(stop);
      resolve(value);
    });
  });

/** What the person can add: the assistant (while it matches what they typed), and the name they typed as a person. */
export function suggestions(typed: string): Addressee[] {
  const name = typed.trim();
  const isAssistant = copy.assistantName.toLowerCase().includes(name.toLowerCase());
  const assistant: Addressee[] = isAssistant ? [{ id: ASSISTANT_ID, label: copy.assistantName, description: copy.assistantDescription }] : [];
  const person: Addressee[] = name && !isAssistant ? [{ id: `person:${name.toLowerCase()}`, label: name, description: copy.personDescription }] : [];
  return [...assistant, ...person];
}

const alreadyIn = (trail: readonly TrailMessage[], line: string): boolean => trail.some((message) => message.kind === MEMBER_ADDED && message.content === line);

/** Adds the pick to the room as a member, once: a status line ("Assistant joined") in the room, written like any message. */
async function add(pick: Addressee, ctx: SlotContext): Promise<void> {
  if (!ctx.roomId) return;
  const { store } = devicePorts(ctx.ports);
  const line = copy.joined(pick.label);
  if (alreadyIn(await firstOf(store.trail(ctx.roomId)), line)) return;
  await store.send(ctx.roomId, line, "you", MEMBER_ADDED);
}

/** Inviting into a room from the address bar: the assistant and people by name. One room, add by pick; no removal and no permissions yet. */
export const members = definePlugin({
  id: "members",
  version: "0.1.0",
  contributes: [
    contribute(addressAddressee, { id: "members", order: 10, suggest: suggestions, add }),
    contribute(trailBody, {
      id: "members.added",
      order: 50,
      kind: MEMBER_ADDED,
      matches: (message) => message.kind === MEMBER_ADDED,
      render: (message) => <Text type="supporting" as="p">{message.content}</Text>,
    }),
  ],
});
