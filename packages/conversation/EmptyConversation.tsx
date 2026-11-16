import type { ReactElement } from "react";
import { EmptyState } from "@openwork/ui";
import { copy } from "./copy.ts";

/** What a conversation with nothing said in it shows when no `window.empty` contribution does: a note to yourself. */
export function EmptyConversation(): ReactElement {
  return <EmptyState art="chat" title={copy.emptyTitle} description={copy.emptyDescription} label={copy.emptyScroller} />;
}
