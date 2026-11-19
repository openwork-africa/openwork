import { type CommandKey, commandKey } from "@openwork/kit";
import type { Room } from "@openwork/store";

/** The commands the rooms plugin provides. Another plugin may run them by name (`ctx.commands["rooms.create"]`) when the product has rooms. */
/** `first` is true when the device opens into its first room; the product's `defaultRoom` applies then. */
export const createRoomCommand: CommandKey<[options?: { first?: boolean }], Promise<void>> = commandKey("rooms.create");
export const deleteRoomCommand: CommandKey<[id: string], Promise<void>> = commandKey("rooms.delete");

/**
 * Opens the room the product opens into: the oldest room that holds every `defaultRoom` member, made (with them in it) when there is none.
 * The shell passes the device's rooms once the first pull is done. `navigate` is false to ensure the room without leaving the page the person asked for.
 */
export const openDefaultRoomCommand: CommandKey<[rooms: readonly Room[], options?: { navigate?: boolean }], Promise<void>> = commandKey("rooms.openDefault");
