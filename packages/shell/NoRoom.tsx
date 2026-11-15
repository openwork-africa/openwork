import type { ReactElement } from "react";
import { Center } from "@astryxdesign/core/Center";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/Stack";
import { BrandLockup } from "@openwork/ui";
import { copy } from "./copy.ts";

const MARK_WIDTH = "calc(var(--spacing-12) * 4)";

/** The window with no room open: the Openwork logo, the app's own mark. */
export function NoRoom(): ReactElement {
  return (
    <Center width="100%" height="100%">
      <VStack gap={3} align="center" width={MARK_WIDTH}>
        <BrandLockup />
        <Text type="supporting" justify="center">{copy.noRoomTitle}</Text>
      </VStack>
    </Center>
  );
}
