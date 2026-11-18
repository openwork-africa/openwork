import type { Plugin } from "@openwork/kit";
import { members } from "@openwork/plugin-members";
import { rooms } from "@openwork/plugin-rooms";
import { text } from "@openwork/plugin-text";
import { aiPlugin } from "@openwork/store";

export { regions } from "./regions.ts";

/** The bare product: the conversation window with Markdown text, a room to start in, and the AI reply path (idle when the server has no AI). No list, no contact panel. */
export const barePlugins: readonly Plugin[] = [rooms(), text, members, aiPlugin()];
