import { contribute, definePlugin, shellRegion } from "@openwork/kit";
import { panelCover, panelSection, panelTab } from "./slots.ts";

/** The contact panel: the island that draws the covers, sections and tabs other plugins contribute. */
export const panelPlugin = definePlugin({
  id: "panel",
  version: "0.1.0",
  slots: [panelTab, panelCover, panelSection],
  contributes: [
    contribute(shellRegion, {
      id: "panel",
      order: 10,
      region: "panel",
      load: () => import("./ContactPanel.tsx").then((module) => ({ default: module.ContactPanel })),
    }),
  ],
});
