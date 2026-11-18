import type { ReactElement } from "react";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { HStack } from "@astryxdesign/core/Stack";
import { copy } from "./copy.ts";

export interface TabView {
  id: string;
  label: string;
}

interface ChatTabsProps {
  tabs: readonly TabView[];
  value: string;
  onChange: (tab: string) => void;
  panelId: string;
}

/** Above the conversations, when the product has two or more tabs: one tab each, on a rail that parts them from the list. */
export function ChatTabs(
  { tabs, value, onChange, panelId }: ChatTabsProps,
): ReactElement | null {
  if (tabs.length < 2) return null;
  return (
    <HStack className="convo-tabs" paddingInline={1} gap={0}>
      <TabList
        value={value}
        onChange={onChange}
        size="sm"
        role="tablist"
        aria-label={copy.tabsLabel}
        hasDivider
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={tab.label}
            panelId={panelId}
          />
        ))}
      </TabList>
    </HStack>
  );
}
