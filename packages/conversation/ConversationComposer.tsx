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
import { AddMenu } from "./AddMenu.tsx";
import { copy } from "./copy.ts";
import { runBeforeSend } from "./sendChain.ts";

const MOBILE_QUERY = "(max-width: 47.98rem)";

/** Closed, the + menu (no id) or the tray of one add-menu item. */
type Tray = { id?: string } | null;

/**
 * The text field and Send. `composer.beforeSend` handlers run on the draft before the store sends it; `composer.action`
 * puts buttons at the start or end; with `composer.addMenu` contributions there is a + that opens the menu and the
 * `composer.tray` an item opens. With none of them it is the field and Send.
 */
export function ConversationComposer({ roomId }: { roomId: string }): ReactElement {
  const ctx = useCtx();
  const { store } = devicePorts(ctx.ports);
  const [value, setValue] = useState("");
  const [tray, setTray] = useState<Tray>(null);
  const isPhone = useMediaQuery(MOBILE_QUERY);
  const input = useRef<ChatComposerInputHandle | null>(null);
  const addItems = useSlot(composerAddMenu, ctx);
  const trays = useSlot(composerTray, ctx);
  const actions = useSlot(composerAction, ctx);
  const handlers = useSlot(composerBeforeSend, ctx);

  useEffect(() => input.current?.focus(), [roomId]);

  const isAdding = tray !== null;
  const closeTray = () => setTray(null);
  const send = async (text: string): Promise<void> => {
    try {
      const draft = await runBeforeSend(handlers, { text }, ctx);
      if (!draft) return setValue(text);
      const words = draft.text.trim();
      if (!words) return;
      closeTray();
      setValue("");
      await store.send(roomId, words);
    } catch (error) {
      ctx.notify(copy.sendFailed(error instanceof Error ? error.message : String(error)), { status: "error" });
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isAdding) return closeTray(), event.preventDefault();
    if (event.key === "Enter" && !event.shiftKey && isPhone) event.preventDefault();
  };

  const open = trays.find((candidate) => candidate.id === tray?.id);
  const adding = tray && !tray.id
    ? <AddMenu items={addItems} onPick={(item) => (item.opens ? setTray({ id: item.opens }) : (closeTray(), item.run?.(ctx)))} />
    : open?.render(ctx, closeTray);
  const plus = addItems.length > 0 && (
    <ToggleButton
      label={isAdding ? copy.close : copy.addToConversation}
      tooltip={isAdding ? copy.close : copy.addTooltip}
      icon={<Icon icon={isAdding ? X : Plus} />}
      isIconOnly
      isPressed={isAdding}
      onPressedChange={(isOn) => setTray(isOn ? {} : null)}
    />
  );
  const buttonsAt = (placement: "start" | "end") =>
    actions.filter((action) => action.placement === placement).map((action) => (
      <IconButton key={action.id} label={action.label} tooltip={action.label} icon={action.icon} variant="ghost" size={placement === "end" ? "md" : "sm"} onClick={() => action.run(ctx)} />
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
