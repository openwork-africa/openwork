import type { ReactElement } from "react";
import { Center } from "@astryxdesign/core/Center";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { BrandLockup } from "./BrandLockup.tsx";
import { copy } from "./copy.ts";

/**
 * Anything the app is waiting on: the Openwork logo with a bar moving under it. By default it sits in the middle
 * of its space; `inline` places it where it is put, and `size="sm"` is the small one that says what it waits on:
 * its `label` is always under the bar, never beside it.
 */
export function Loading(
  { inline = false, size = "md", label = copy.loading }: { inline?: boolean; size?: "sm" | "md"; label?: string },
): ReactElement {
  const mark = (
    <VStack gap={1} className="loading-mark" data-size={size} role="status">
      <BrandLockup />
      <ProgressBar label={label} isLabelHidden isIndeterminate />
    </VStack>
  );
  if (size === "sm") {
    return (
      <VStack gap={2}>
        {mark}
        <Text type="supporting">{label}</Text>
      </VStack>
    );
  }
  return inline ? mark : <Center width="100%" height="100%">{mark}</Center>;
}
