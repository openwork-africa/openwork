import type { SlotContext } from "./context.ts";
import { provide, type Provision, service } from "./keys.ts";

/** A command a plugin provides. It runs with the slot context first, then whatever the caller passes. */
export type CommandHandler = (ctx: SlotContext, ...args: never[]) => unknown;

/** A command's name with the types of what it takes and gives back, so callers need no cast. */
export interface CommandKey<Args extends unknown[], Result> {
  readonly name: string;
  readonly __type?: (...args: Args) => Result;
}

export const COMMAND_PREFIX = "command:";

export const commandKey = <Args extends unknown[], Result>(name: string): CommandKey<Args, Result> => ({ name });

export function provideCommand<Args extends unknown[], Result>(
  key: CommandKey<Args, Result>,
  handler: (ctx: SlotContext, ...args: Args) => Result,
): Provision;
export function provideCommand(name: string, handler: CommandHandler): Provision;
export function provideCommand(key: string | CommandKey<never[], unknown>, handler: CommandHandler): Provision {
  const name = typeof key === "string" ? key : key.name;
  return provide(service<CommandHandler>(COMMAND_PREFIX + name), handler);
}

/** Runs a command a plugin provides; `undefined` when nobody provides it. */
export function runCommand<Args extends unknown[], Result>(
  ctx: Pick<SlotContext, "commands">,
  key: CommandKey<Args, Result>,
  ...args: Args
): Result | undefined {
  const command = ctx.commands[key.name] as ((...args: Args) => Result) | undefined;
  return command?.(...args);
}
