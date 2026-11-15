import { type ReactElement, useCallback, useRef } from "react";
import { type RegionProps } from "@openwork/shell";
import { devicePorts, useRoom, useTrail } from "@openwork/store";
import { useCtx, useSlot, windowBanner, windowEmpty } from "@openwork/kit";
import { ChatLayout } from "@astryxdesign/core/Chat";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { AddressBar } from "./AddressBar.tsx";
import { useWorking } from "./brain.ts";
import { ConversationComposer } from "./ConversationComposer.tsx";
import { MessagesLoading, useAfterAMoment } from "./ConversationLoading.tsx";
import { ConversationTrail } from "./ConversationTrail.tsx";
import { EmptyConversation } from "./EmptyConversation.tsx";
import { TypingIndicator } from "./TypingIndicator.tsx";
import { useFollowNewest } from "./useFollowNewest.ts";

function Conversation({ roomId }: { roomId: string }): ReactElement | null {
  const ctx = useCtx();
  const { store } = devicePorts(ctx.ports);
  const room = useRoom(store, roomId);
  const trail = useTrail(store, roomId);
  const isWorking = useWorking(ctx.ports, roomId);
  const banners = useSlot(windowBanner, ctx);
  const [empty] = useSlot(windowEmpty, ctx);
  const frame = useRef<HTMLElement | null>(null);
  const retry = useCallback((messageId: string) => void store.retry(messageId), [store]);
  const isEmpty = trail?.length === 0 && !isWorking;
  const showLoading = useAfterAMoment(trail === undefined);
  useFollowNewest(frame, !showLoading && !isEmpty && roomId);

  if (room === null) return null;
  return (
    <VStack ref={frame} className="convo-window">
      <HStack className="convo-thread-title" gap={1} vAlign="center">
        <StackItem size="fill">{room && <AddressBar room={room} />}</StackItem>
      </HStack>
      {banners.map((banner) => <VStack key={banner.id}>{banner.render(ctx)}</VStack>)}
      <ChatLayout
        density="spacious"
        emptyState={<VStack className="convo-empty-pin">{empty ? empty.render(ctx) : <EmptyConversation />}</VStack>}
        composer={<ConversationComposer roomId={roomId} />}
      >
        {showLoading
          ? <MessagesLoading />
          : !isEmpty && trail && <ConversationTrail items={trail} ctx={ctx} onRetry={retry}>{isWorking && <TypingIndicator />}</ConversationTrail>}
      </ChatLayout>
    </VStack>
  );
}

/** The window region: the room's address bar, its trail of messages and the composer. With no room open it draws nothing. */
export function ConversationWindow({ roomId }: RegionProps): ReactElement | null {
  return roomId ? <Conversation key={roomId} roomId={roomId} /> : null;
}
