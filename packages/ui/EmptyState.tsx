import type { ReactElement, ReactNode } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { EmptyCard, type EmptyArt } from "./EmptyCard.tsx";

export interface EmptyStateProps {
  art: EmptyArt;
  title: string;
  description: string;
  action?: ReactNode;
  /** Names the card's row for assistive technology. */
  label?: string;
}

/** The one empty-state card, centred in the space it is given and never scrolling: what every empty window draws, and what a `window.empty` contribution extends. */
export function EmptyState({ art, title, description, action, label }: EmptyStateProps): ReactElement {
  return (
    <VStack gap={2} align="center" className="conversation-empty-content">
      <HStack className="conversation-empty-scroller is-single" aria-label={label}>
        <VStack className="conversation-empty-card">
          <EmptyCard art={art} title={title} description={description} action={action} />
        </VStack>
      </HStack>
    </VStack>
  );
}
