import type { ReactElement } from "react";
import { ChatMessage, ChatMessageBubble } from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/Stack";
import { copy } from "./copy.ts";

/** An answer is being made: only that it is, never its words as they come. */
export function TypingIndicator(): ReactElement {
  return (
    <ChatMessage sender="assistant">
      <ChatMessageBubble>
        <HStack as="span" className="typing-dots" role="status" aria-label={copy.typing}>
          <HStack as="span" />
          <HStack as="span" />
          <HStack as="span" />
        </HStack>
      </ChatMessageBubble>
    </ChatMessage>
  );
}
