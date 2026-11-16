import type { ReactElement } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Center } from "@astryxdesign/core/Center";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { BrandLockup, EmptyCard } from "@openwork/ui";
import { copy } from "./copy.ts";

const MARK_WIDTH = "calc(var(--spacing-12) * 4)";

export interface NoRoomProps {
  /** There is no room at all: an empty card with a way to start one, instead of the logo. */
  isEmpty?: boolean;
  onStart?: () => void;
}

/** The window with no room open, drawn in the window's own frame: the logo, or with no rooms at all the card to start one. */
export function NoRoom({ isEmpty = false, onStart }: NoRoomProps): ReactElement {
  return (
    <VStack className={isEmpty ? "convo-loading is-empty" : "convo-loading"}>
      <Center width="100%" height="100%">
        {isEmpty
          ? (
            <VStack gap={2} align="center" className="conversation-empty-content">
              <HStack className="conversation-empty-scroller">
                <VStack className="conversation-empty-card">
                  <EmptyCard
                    art="chat"
                    title={copy.noRoomsTitle}
                    description={copy.noRoomsDescription}
                    action={onStart && <Button label={copy.startLabel} variant="primary" onClick={onStart} />}
                  />
                </VStack>
              </HStack>
            </VStack>
          )
          : (
            <VStack gap={3} align="center" width={MARK_WIDTH}>
              <BrandLockup />
              <Text type="supporting" justify="center">{copy.noRoomTitle}</Text>
            </VStack>
          )}
      </Center>
    </VStack>
  );
}
