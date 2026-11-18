import { type CommandKey, commandKey } from "@openwork/kit";

/** The commands the rooms plugin provides. Another plugin may run them by name (`ctx.commands["rooms.create"]`) when the product has rooms. */
/** `first` is true when the device opens into its first room; the product's `defaultRoom` applies then. */
export const createRoomCommand: CommandKey<[options?: { first?: boolean }], Promise<void>> = commandKey("rooms.create");
export const deleteRoomCommand: CommandKey<[id: string], Promise<void>> = commandKey("rooms.delete");
