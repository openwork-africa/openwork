import type { ReactElement } from "react";
import { Center } from "@astryxdesign/core/Center";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/Stack";
import { BrandLockup, EmptyState } from "@openwork/ui";
import { copy } from "./copy.ts";

const MARK_WIDTH = "calc(var(--spacing-12) * 4)";

export interface NoRoomProps {
  /** There is no room at all and nothing opens one: an empty card, instead of the logo. */
  isEmpty?: boolean;
}

/** The window with no room open, drawn in the window's own frame: the logo, or with no rooms at all the empty card. */
export function NoRoom({ isEmpty = false }: NoRoomProps): ReactElement {
  return (
    <VStack className={isEmpty ? "convo-loading is-empty" : "convo-loading"}>
      <Center width="100%" height="100%">
        {isEmpty
          ? <EmptyState art="chat" title={copy.noRoomsTitle} description={copy.noRoomsDescription} />
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
