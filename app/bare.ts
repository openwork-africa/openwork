import type { Plugin } from "@openwork/kit";
import { rooms } from "@openwork/plugin-rooms";
import { text } from "@openwork/plugin-text";

export { regions } from "./regions.ts";

/** The bare product: the conversation window with Markdown text and a way to start a room. No list, no contact panel. */
export const barePlugins: readonly Plugin[] = [rooms(), text];
