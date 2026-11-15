import type { SlotContext } from "./context.ts";
import { provide, type Provision, service } from "./keys.ts";

/** A command a plugin provides. It runs with the slot context first, then whatever the caller passes. */
export type CommandHandler = (ctx: SlotContext, ...args: never[]) => unknown;

export const COMMAND_PREFIX = "command:";

export const provideCommand = (
  name: string,
  handler: CommandHandler,
): Provision =>
  provide(service<CommandHandler>(COMMAND_PREFIX + name), handler);
