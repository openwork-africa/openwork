import type { Member, Room } from "./types.ts";

/** The `type` of a member that is an AI: an operator. Anything else is just someone. */
export const OPERATOR = "operator";
const UNNAMED_OPERATOR = "Unnamed operator";
const UNNAMED = "Unnamed";

export const isOperator = (member: Member): boolean => member.type === OPERATOR;

export const memberName = (member: Member): string => member.name.trim() || (isOperator(member) ? UNNAMED_OPERATOR : UNNAMED);

export const operatorsOf = (room: Pick<Room, "members">): Member[] => (room.members ?? []).filter(isOperator);

export const joinedLine = (member: Member): string => `${memberName(member)} was added`;

/** A room with at most one other in it is one-to-one; when that one is an operator the room is called by its name, else by the room's own name. */
export function roomTitle(room: Pick<Room, "name" | "members">): string {
  const others = room.members ?? [];
  return others.length === 1 && isOperator(others[0]) ? memberName(others[0]) : room.name;
}
