import { type ComponentType, lazy } from "react";
import type { Plugin } from "@openwork/kit";
import { profilePlugin } from "@openwork/plugin-profile";
import { rooms } from "@openwork/plugin-rooms";
import { text } from "@openwork/plugin-text";
import { aiPlugin } from "@openwork/store";
import type { Regions } from "@openwork/shell";

/** The product's composition file: the plugins it is made of, in any order. Adding or removing one is the whole change. */
export const openPlugins: readonly Plugin[] = [rooms(), text, profilePlugin, aiPlugin()];

const region = <Name extends string>(load: () => Promise<Record<Name, ComponentType>>, name: Name) =>
  lazy(() => load().then((module) => ({ default: module[name] })));

/** The three islands of the frame, loaded when the page first draws them. */
export const regions: Regions = {
  circle: region(() => import("@openwork/circle"), "Circle"),
  window: region(() => import("@openwork/conversation"), "ConversationWindow"),
  panel: region(() => import("@openwork/panel"), "ContactPanel"),
};
