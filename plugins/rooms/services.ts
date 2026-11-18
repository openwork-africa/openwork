import { type CommandKey, commandKey } from "@openwork/kit";

/** The commands the rooms plugin provides. Another plugin may run them by name (`ctx.commands["rooms.create"]`) when the product has rooms. */
export const createRoomCommand: CommandKey<[], Promise<void>> = commandKey("rooms.create");
export const deleteRoomCommand: CommandKey<[id: string], Promise<void>> = commandKey("rooms.delete");
