import { Fragment, type ReactElement, type ReactNode } from "react";
import { type SlotContext, trailAction, trailBody, trailExtra, useSlot } from "@openwork/kit";
import type { MessageAnswer, TrailMessage } from "@openwork/store";
import { ChatMessageList, ChatSystemMessage } from "@astryxdesign/core/Chat";
import { useChatDensity } from "@openwork/ui";
import { ConversationBubble } from "./ConversationBubble.tsx";
import { dayKeyOf, dayLabelOf, groupOf } from "./messages.ts";

const STILL_LOADING = "Still loading…";

/**
 * The messages of one conversation, a day separator where the day changes. Each bubble's body is the first `trail.body`
 * that matches it, else its plain words; `trail.extra` adds under the body and `trail.action` fills its menu.
 */
export function ConversationTrail(
  { items, ctx, onRetry, isCatchingUp = false, answers, children }: {
    items: readonly TrailMessage[];
    ctx: SlotContext;
    onRetry: (messageId: string) => void;
    isCatchingUp?: boolean;
    answers?: ReadonlyMap<string, MessageAnswer>;
    children?: ReactNode;
  },
): ReactElement {
  const density = useChatDensity();
  const bodies = useSlot(trailBody, ctx);
  const extras = useSlot(trailExtra, ctx);
  const actions = useSlot(trailAction, ctx);
  return (
    <ChatMessageList density={density}>
      {isCatchingUp && items.length === 0 && <ChatSystemMessage>{STILL_LOADING}</ChatSystemMessage>}
      {items.map((message, index) => (
        <Fragment key={message.id}>
          {(index === 0 || dayKeyOf(items[index - 1].createdAt) !== dayKeyOf(message.createdAt)) && (
            <ChatSystemMessage id={`day-${message.id}`}>{dayLabelOf(message.createdAt)}</ChatSystemMessage>
          )}
          <ConversationBubble
            message={message}
            group={groupOf(items, index)}
            ctx={ctx}
            bodies={bodies}
            extras={extras}
            actions={actions}
            onRetry={onRetry}
            answer={answers?.get(message.id)}
          />
        </Fragment>
      ))}
      {children}
    </ChatMessageList>
  );
}
