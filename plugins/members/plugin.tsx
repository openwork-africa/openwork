import { addressAddressee, type Addressee, contribute, definePlugin, type SlotContext, trailBody } from "@openwork/kit";
import { devicePorts, isOperator, JOINED_KIND, type Live, type Member, memberName, OPERATOR, type Room } from "@openwork/store";
import { Text } from "@astryxdesign/core/Text";
import { copy } from "./copy.ts";

const CREATE_PREFIX = "create-operator:";

export interface MembersOptions {
  /** The people and operators the address bar can offer. They come from the product; OSS has none of its own. */
  directory?: readonly Member[];
}

const firstOf = <T,>(live: Live<T>): Promise<T> =>
  new Promise((resolve) => {
    const stop = live.subscribe(() => {
      const value = live.get();
      if (value === undefined) return;
      queueMicrotask(stop);
      resolve(value);
    });
  });

const roomOf = (ctx: SlotContext): Promise<Room | null> => (ctx.roomId ? firstOf(devicePorts(ctx.ports).store.room(ctx.roomId)) : Promise.resolve(null));

const matches = (member: Member, typed: string): boolean => `${memberName(member)} ${member.description ?? ""}`.toLowerCase().includes(typed.toLowerCase());

const addresseeOf = (member: Member): Addressee => ({
  id: member.id,
  label: memberName(member),
  description: member.description || (isOperator(member) ? copy.operatorDescription : undefined),
});

/** The address bar's own invite: who the room does not have yet, from the product's directory, and "Create operator" for a name that matches no one. */
export function members({ directory = [] }: MembersOptions = {}) {
  const suggest = async (typed: string, ctx: SlotContext): Promise<Addressee[]> => {
    const inRoom = new Set(((await roomOf(ctx))?.members ?? []).map((member) => member.id));
    const found = directory.filter((member) => !inRoom.has(member.id) && matches(member, typed.trim()));
    const name = typed.trim();
    const create: Addressee[] = name && !directory.some((member) => matches(member, name))
      ? [{ id: `${CREATE_PREFIX}${name}`, label: copy.createOperator(name), description: copy.createOperatorDescription }]
      : [];
    return [...found.map(addresseeOf), ...create];
  };

  /** The one way into a room: the pick becomes a member row and one status line, through the store. Picking someone already in does nothing. */
  const add = async (pick: Addressee, ctx: SlotContext): Promise<void> => {
    if (!ctx.roomId) return;
    const member = pick.id.startsWith(CREATE_PREFIX)
      ? { id: `operator:${crypto.randomUUID()}`, name: pick.id.slice(CREATE_PREFIX.length), type: OPERATOR }
      : directory.find((each) => each.id === pick.id);
    if (member) await devicePorts(ctx.ports).store.addMember(ctx.roomId, member);
  };

  return definePlugin({
    id: "members",
    version: "0.1.0",
    contributes: [
      contribute(addressAddressee, { id: "members", order: 10, suggest, add }),
      contribute(trailBody, {
        id: "members.joined",
        order: 50,
        kind: JOINED_KIND,
        matches: (message) => message.kind === JOINED_KIND,
        render: (message) => <Text type="supporting" as="p">{message.content}</Text>,
      }),
    ],
  });
}
