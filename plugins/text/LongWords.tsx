import { type ReactElement, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Stack";
import { copy } from "./copy.ts";
import { Markdown } from "./Markdown.tsx";
import { trimmedOf } from "./trimmed.ts";

// Words that show their start when long, with "Show more" for the rest and "Show less" to fold them again.
export function LongWords({ text }: { text: string }): ReactElement {
  const [isOpen, setOpen] = useState(false);
  const start = trimmedOf(text);
  if (!start) return <Markdown>{text}</Markdown>;
  return (
    <VStack gap={0.5} hAlign="start">
      <Markdown>{isOpen ? text : start}</Markdown>
      <Button label={isOpen ? copy.showLess : copy.showMore} variant="ghost" size="sm" onClick={() => setOpen(!isOpen)} />
    </VStack>
  );
}
