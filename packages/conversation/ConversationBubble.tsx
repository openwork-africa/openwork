import { Fragment, memo, type ReactElement } from "react";
import type { SlotContext, TrailActionValue, TrailBodyValue, TrailExtraValue, Placed } from "@openwork/kit";
import type { TrailMessage } from "@openwork/store";
import { ChatMessage as AxMessage, ChatMessageBubble } from "@astryxdesign/core/Chat";
import { ContextMenu } from "@astryxdesign/core/ContextMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Info, RotateCcw } from "lucide-react";
import { copy } from "./copy.ts";
import { DeliveryTicks } from "./DeliveryTicks.tsx";
import { dropReleaseClick } from "./heldMenu.ts";
import { type BubbleGroup, timeFormatOf } from "./messages.ts";
import { Selectable } from "./Selectable.tsx";

export interface BubbleProps {
  message: TrailMessage;
  group: BubbleGroup;
  ctx: SlotContext;
  bodies: readonly (TrailBodyValue & Placed)[];
  extras: readonly (TrailExtraValue & Placed)[];
  actions: readonly (TrailActionValue & Placed)[];
  onRetry: (messageId: string) => void;
}

function Stamp({ message }: { message: TrailMessage }): ReactElement {
  const isOwn = message.authorId === "you";
  return (
    <HStack className="chat-stamp" gap={1} hAlign="end" vAlign="center">
      {message.state === "failed" && <Text type="supporting" size="xsm" color="inherit">{copy.notDelivered}</Text>}
      <Timestamp value={message.createdAt} format={timeFormatOf(message.createdAt, Date.now())} size="xsm" color="inherit" hasTooltip={false} />
      {isOwn && <DeliveryTicks state={message.state} reason={message.failureReason} />}
    </HStack>
  );
}

function Bubble({ message, group, ctx, bodies, extras, actions, onRetry }: BubbleProps): ReactElement {
  const isFailed = message.state === "failed";
  const body = bodies.find((candidate) => candidate.matches(message));
  const words = body ? body.render(message, ctx) : <Text as="p">{message.content}</Text>;
  const sendAgain = () => onRetry(message.id);
  const menuItems = [
    ...actions.filter((action) => action.appliesTo?.(message) ?? true).map((action) => ({ label: action.label, icon: action.icon, onClick: () => action.run(message, ctx) })),
    ...(isFailed ? [{ label: copy.retry, icon: <Icon icon={RotateCcw} />, onClick: sendAgain }] : []),
  ];
  const shown = (
    <AxMessage id={`msg-${message.id}`} sender={message.authorId === "you" ? "user" : "assistant"}>
      <ChatMessageBubble group={group}>
        <VStack gap={0.5}>
          <Selectable>{words}</Selectable>
          {extras.map((extra) => <Fragment key={extra.id}>{extra.render(message, ctx)}</Fragment>)}
          <Stamp message={message} />
        </VStack>
      </ChatMessageBubble>
      {isFailed && (
        <HStack gap={1} vAlign="center">
          {message.failureReason && (
            <IconButton className="chat-hover-action" label={copy.errorDetails} tooltip={message.failureReason} icon={<Icon icon={Info} size="sm" />} variant="ghost" size="sm" onClick={() => {}} />
          )}
          <IconButton className="chat-hover-action" label={copy.sendAgain} tooltip={copy.sendAgain} icon={<Icon icon={RotateCcw} size="sm" />} variant="ghost" size="sm" onClick={sendAgain} />
        </HStack>
      )}
    </AxMessage>
  );
  if (menuItems.length === 0) return shown;
  return <ContextMenu items={menuItems} presentation="adaptive" label={copy.messageActions} onOpenChange={dropReleaseClick}>{shown}</ContextMenu>;
}

export const ConversationBubble = memo(Bubble);
