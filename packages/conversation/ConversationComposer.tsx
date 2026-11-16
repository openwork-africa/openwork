import { type KeyboardEvent, type ReactElement, useEffect, useRef, useState } from "react";
import { composerAction, composerAddMenu, composerBeforeSend, composerTray, useCtx, useSlot } from "@openwork/kit";
import { devicePorts } from "@openwork/store";
import { ChatComposer, ChatComposerDrawer, ChatComposerInput, type ChatComposerInputHandle, ChatSendButton } from "@astryxdesign/core/Chat";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { Plus, X } from "lucide-react";
import { copy } from "./copy.ts";
import { PHONE_QUERY } from "@openwork/ui";
import { useComposerTray } from "./useComposerTray.tsx";
import { useSend } from "./useSend.ts";

/**
 * The text field and Send. `composer.beforeSend` handlers run on the draft before the store sends it; `composer.action`
 * puts buttons at the start or end; with `composer.addMenu` contributions there is a + that opens the menu and the
 * `composer.tray` an item opens. With none of them it is the field and Send.
 */
export function ConversationComposer({ roomId }: { roomId: string }): ReactElement {
  const ctx = useCtx();
  const { store } = devicePorts(ctx.ports);
  const [value, setValue] = useState("");
  const isPhone = useMediaQuery(PHONE_QUERY);
  const input = useRef<ChatComposerInputHandle | null>(null);
  const addItems = useSlot(composerAddMenu, ctx);
  const trays = useSlot(composerTray, ctx);
  const actions = useSlot(composerAction, ctx);
  const handlers = useSlot(composerBeforeSend, ctx);
  const { content: adding, isAdding, closeTray, openTray } = useComposerTray(addItems, trays, ctx);
  const send = useSend(roomId, store, handlers, ctx, closeTray, setValue);

  useEffect(() => input.current?.focus(), [roomId]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isAdding) return closeTray(), event.preventDefault();
    if (event.key === "Enter" && !event.shiftKey && isPhone) {
      event.preventDefault();
      input.current?.insertText("\n");
    }
  };

  const plus = addItems.length > 0 && (
    <ToggleButton
      label={isAdding ? copy.close : copy.addToConversation}
      tooltip={isAdding ? copy.close : copy.addTooltip}
      icon={<Icon icon={isAdding ? X : Plus} />}
      isIconOnly
      isPressed={isAdding}
      onPressedChange={openTray}
    />
  );
  const buttonsAt = (placement: "start" | "end") =>
    actions.filter((action) => action.placement === placement).map((action) => (
      <IconButton
        key={action.id}
        label={action.label}
        tooltip={action.label}
        icon={action.icon}
        variant="ghost"
        size={placement === "end" ? "md" : "sm"}
        onClick={() => action.run(ctx)}
      />
    ));
  const field = <ChatComposerInput handleRef={input} maxRows={6} hasHistory={false} onKeyDown={onKeyDown} />;

  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSubmit={(text) => void send(text.trim())}
      placeholder={copy.placeholder}
      density="compact"
      elevation="none"
      drawer={adding && <ChatComposerDrawer>{adding}</ChatComposerDrawer>}
      footerActions={<>{isPhone && plus}{buttonsAt("start")}</>}
      sendActions={buttonsAt("end")}
      sendButton={<ChatSendButton />}
      input={plus && !isPhone
        ? (
          <HStack gap={1} vAlign="end" width="100%">
            {plus}
            <StackItem size="fill">
              <VStack vAlign="center" minHeight="var(--size-element-md)">{field}</VStack>
            </StackItem>
          </HStack>
        )
        : field}
    />
  );
}
