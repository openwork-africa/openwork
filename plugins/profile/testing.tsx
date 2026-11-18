import { Fragment, type ReactElement } from "react";
import { VStack } from "@astryxdesign/core/Stack";
import { definePlugin, useCtx, useSlot } from "@openwork/kit";
import { panelCover, panelSection, panelTab } from "@openwork/plugin-panel/slots";
export { flush, mount } from "@openwork/ui/testing";

/** Stands in for the panel plugin (it opens the slots the profile fills), so this plugin is tested without importing that one. */
export const fakePanel = definePlugin({ id: "panel", version: "0.1.0", slots: [panelTab, panelCover, panelSection], contributes: [] });

/** Draws the panel slots the way the panel plugin does, so this plugin is tested without importing that one. */
export function PanelHost(): ReactElement {
  const ctx = useCtx();
  const covers = useSlot(panelCover, ctx);
  const sections = useSlot(panelSection, ctx);
  return (
    <VStack className="contact-panel">
      {covers.map((cover) => <Fragment key={cover.id}>{cover.render(ctx)}</Fragment>)}
      <VStack className="contact-scroll">
        {sections.map((section) => <VStack key={section.id}>{section.render(ctx)}</VStack>)}
      </VStack>
    </VStack>
  );
}
