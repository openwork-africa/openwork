import type { Plugin } from "@openwork/kit";
import { circlePlugin } from "@openwork/plugin-circle";
import { panelPlugin } from "@openwork/plugin-panel";
import { profilePlugin } from "@openwork/plugin-profile";
import { members } from "@openwork/plugin-members";
import { rooms } from "@openwork/plugin-rooms";
import { text } from "@openwork/plugin-text";
import { aiPlugin } from "@openwork/store";

export { regions } from "./regions.ts";

/** The full product's composition file: the plugins it is made of, in any order. Adding or removing one is the whole change. */
export const openPlugins: readonly Plugin[] = [rooms(), text, profilePlugin, circlePlugin(), panelPlugin, members, aiPlugin()];
