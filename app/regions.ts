import { type ComponentType, lazy } from "react";
import type { Regions } from "@openwork/shell";

const region = <Name extends string>(load: () => Promise<Record<Name, ComponentType>>, name: Name) =>
  lazy(() => load().then((module) => ({ default: module[name] })));

/** The base of every product: the conversation window, loaded when the page first draws it. The list and the contact panel come from plugins. */
export const regions: Regions = {
  window: region(() => import("@openwork/conversation"), "ConversationWindow"),
};
