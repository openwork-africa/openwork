import { Fragment, type ReactElement, useId, useState } from "react";
import { VStack } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { panelCover, panelSection, panelTab, useCtx, useSlot } from "@openwork/kit";
import { copy } from "./copy.ts";

/** The right pane: the covers plugins put in `panel.cover` above the scroll, then the sections plugins put in `panel.section`, top to bottom, then a tab bar when a plugin adds a tab. */
export function ContactPanel({ roomId }: { roomId?: string }): ReactElement | null {
  const ctx = useCtx();
  const covers = useSlot(panelCover, ctx);
  const sections = useSlot(panelSection, ctx);
  const tabs = useSlot(panelTab, ctx);
  const [chosen, setChosen] = useState<string>();
  const panelId = useId();
  if (!roomId) return null;
  const shown = tabs.find((tab) => tab.value === chosen) ?? tabs[0];
  return (
    <VStack as="aside" className="contact-panel" aria-label={copy.panelLabel}>
      {covers.map((cover) => <Fragment key={cover.id}>{cover.render(ctx)}</Fragment>)}
      <VStack className="contact-scroll enter">
        {sections.map((section) => <VStack key={section.id}>{section.render(ctx)}</VStack>)}
        {shown && (
          <VStack gap={3}>
            <TabList value={shown.value} onChange={setChosen} size="sm" role="tablist" aria-label={copy.panelLabel} hasDivider>
              {tabs.map((tab) => <Tab key={tab.id} value={tab.value} label={tab.label} icon={tab.icon} panelId={panelId} />)}
            </TabList>
            <VStack id={panelId} role="tabpanel">{shown.render(ctx)}</VStack>
          </VStack>
        )}
      </VStack>
    </VStack>
  );
}
