import type { ReactElement } from "react";
import type { AddMenuValue, Placed } from "@openwork/kit";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { copy } from "./copy.ts";

/** The + menu: one row for each `composer.addMenu` contribution; a row opens its tray or runs its action. */
export function AddMenu({ items, onPick }: { items: readonly (AddMenuValue & Placed)[]; onPick: (item: AddMenuValue & Placed) => void }): ReactElement {
  return (
    <VStack width="100%">
      <List aria-label={copy.addToConversation} density="compact">
        {items.map((item) => (
          <ListItem
            key={item.id}
            label={item.label}
            description={item.description}
            startContent={item.icon}
            onClick={() => onPick(item)}
          />
        ))}
      </List>
    </VStack>
  );
}
