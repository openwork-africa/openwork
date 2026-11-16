import { type ReactElement, useEffect, useState } from "react";
import { VStack } from "@astryxdesign/core/Stack";
import { Skeleton } from "@astryxdesign/core/Skeleton";

const PLACEHOLDER_AFTER_MS = 120;

// How long something has to be missing before a placeholder is shown for it: a switch that lands at once shows none,
// so a placeholder never flashes over a conversation that was about to appear anyway.

const ROW_WIDTHS = ["62%", "84%", "48%", "72%"];

/** True once `waiting` has been true for a moment, and false again the moment it stops, so nothing lingers. */
export function useAfterAMoment(waiting: boolean): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), PLACEHOLDER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);
  return waiting && shown;
}

/** A few message-shaped placeholders, drawn in the trail while a conversation's messages are still being read. */
export function MessagesLoading(): ReactElement {
  return (
    <VStack gap={3}>
      {ROW_WIDTHS.map((width, index) => <Skeleton key={index} width={width} height="var(--font-size-xl)" radius="rounded" index={index} />)}
    </VStack>
  );
}
