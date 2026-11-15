import type { ReactElement } from "react";
import { EmptyCard } from "@openwork/ui";
import { copy } from "./copy.ts";

/** What the circle shows with no rooms: the empty card, pointing at New. */
export function RoomsEmpty(): ReactElement {
  return (
    <EmptyCard
      art="chat"
      title={copy.emptyTitle}
      description={copy.emptyDescription}
    />
  );
}
