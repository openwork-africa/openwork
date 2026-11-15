import type { ReactElement } from "react";
import { EmptyCard } from "@openwork/ui";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { copy } from "./copy.ts";

/** What a conversation with nothing said in it shows when no `window.empty` contribution does: a note to yourself. */
export function EmptyConversation(): ReactElement {
  return (
    <VStack gap={2} align="center" className="conversation-empty-content">
      <HStack className="conversation-empty-scroller" aria-label={copy.emptyScroller}>
        <VStack className="conversation-empty-card">
          <EmptyCard art="chat" title={copy.emptyTitle} description={copy.emptyDescription} />
        </VStack>
      </HStack>
    </VStack>
  );
}
