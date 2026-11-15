import { type ReactElement, useId, useState } from "react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { X } from "lucide-react";
import { panelSection, panelTab, useCtx, useSlot } from "@openwork/kit";
import { roomPath } from "@openwork/shell";
import { copy } from "./copy.ts";

/** The right pane: the sections plugins put in `panel.section`, top to bottom, then a tab bar when a plugin adds a tab. */
export function ContactPanel({ roomId }: { roomId?: string }): ReactElement | null {
  const ctx = useCtx();
  const sections = useSlot(panelSection, ctx);
  const tabs = useSlot(panelTab, ctx);
  const [chosen, setChosen] = useState<string>();
  const panelId = useId();
  if (!roomId) return null;
  const shown = tabs.find((tab) => tab.value === chosen) ?? tabs[0];
  return (
    <VStack as="aside" className="contact-panel" aria-label={copy.panelLabel}>
      <HStack className="contact-close">
        <IconButton label={copy.close} tooltip={copy.close} icon={<Icon icon={X} />} variant="secondary" size="sm" onClick={() => ctx.navigate(roomPath(roomId))} />
      </HStack>
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
