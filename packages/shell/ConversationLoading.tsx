import { type ReactElement, useEffect, useState } from "react";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";

const PLACEHOLDER_AFTER_MS = 120;
const ROW_WIDTHS = ["62%", "84%", "48%", "72%"];

function useAfterAMoment(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), PLACEHOLDER_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return shown;
}

/** The window before it is known which conversation it is: its frame, a title bar and message-shaped rows, so the page keeps the shape of a conversation instead of going blank. */
export function ConversationLoading(): ReactElement | null {
  if (!useAfterAMoment()) return null;
  return (
    <VStack className="convo-loading">
      <HStack className="convo-thread-title" gap={1} vAlign="center">
        <StackItem size="fill">
          <Skeleton width="var(--spacing-24)" height="var(--font-size-lg)" radius={1} />
        </StackItem>
      </HStack>
      <VStack padding={4}>
        <VStack gap={3}>
          {ROW_WIDTHS.map((width, index) => <Skeleton key={index} width={width} height="var(--font-size-xl)" radius="rounded" index={index} />)}
        </VStack>
      </VStack>
    </VStack>
  );
}
