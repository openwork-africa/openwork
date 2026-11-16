import { type ReactElement, useEffect, useId, useRef, useState } from "react";
import type { ContextMenuItemData } from "@astryxdesign/core/ContextMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Plus } from "lucide-react";
import {
  circleEmpty,
  circleRowMenu,
  circleSource,
  circleTab,
  createRoomCommand,
  type RowMenuValue,
  type RowModel,
  runCommand,
  type SlotContext,
  useCtx,
  useSlot,
} from "@openwork/kit";
import { type DeviceStore, useSyncStatus } from "@openwork/store";
import { roomPath } from "@openwork/kit";
import { ErrorBoundary } from "@openwork/ui";
import { copy as uiCopy } from "@openwork/ui";
import { IslandBody } from "@openwork/ui";
import { useDrawerState } from "@openwork/shell";
import { ChatRow, ChatRowsLoading } from "./ChatRow.tsx";
import { ChatTabs } from "./ChatTabs.tsx";
import { isLoading, mergeRows, useSourceRows } from "./circleRows.ts";
import { ConfirmDelete } from "./ConfirmDelete.tsx";
import { copy } from "./copy.ts";

interface Asked {
  row: RowModel;
  item: RowMenuValue;
}

const useCatchingUp = (ctx: SlotContext): boolean => {
  const store = ctx.ports.store as DeviceStore | undefined;
  return useSyncStatus(store) === "catchingUp";
};

/**
 * Your circle: the rows every source has, most recent first, and a New button at the foot. A product with two or
 * more tabs gets a tab bar above them. A row's menu holds what plugins add to it; a danger item asks first.
 */
export function Circle({ roomId }: { roomId?: string }): ReactElement {
  const ctx = useCtx();
  const drawerState = useDrawerState();
  const activeId = roomId ?? ctx.roomId;
  const sources = useSlot(circleSource, ctx);
  const tabs = useSlot(circleTab, ctx);
  const menu = useSlot(circleRowMenu, ctx);
  const empties = useSlot(circleEmpty, ctx);
  const bySource = useSourceRows(sources, ctx);
  const catchingUp = useCatchingUp(ctx);
  const [chosen, setChosen] = useState<string | undefined>();
  const [asked, setAsked] = useState<Asked | undefined>();
  const listRef = useRef<HTMLElement | null>(null);
  const panelId = useId();
  const tab = tabs.find((each) => each.id === chosen) ?? tabs[0];
  const rows = mergeRows(sources, bySource).filter((
    row,
  ) => (tabs.length > 1 && tab ? tab.filter(row) : true));
  const create = ctx.commands[createRoomCommand.name] ? () => runCommand(ctx, createRoomCommand) : undefined;
  const isEmptyDevice = !isLoading(sources, bySource) && mergeRows(sources, bySource).length === 0;

  useEffect(() => {
    listRef.current?.querySelector(".avatar-frame[data-selected]")
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const itemsOf = (row: RowModel): ContextMenuItemData[] =>
    menu.map((item) => ({
      label: item.label,
      icon: item.icon,
      variant: item.danger ? "destructive" : undefined,
      onClick: () => (item.danger ? setAsked({ row, item }) : item.run(row, ctx)),
    }));

  const body = (
    <IslandBody
      isLoading={isLoading(sources, bySource)}
      isEmpty={!rows.length}
      loading={<ChatRowsLoading />}
      empty={empties.map((empty) => <HStack key={empty.id}>{empty.render(ctx)}</HStack>)}
    >
      {rows.map((row) => (
        <ErrorBoundary key={row.id} name={copy.circleName} fallback={null}>
          <ChatRow
            name={row.title}
            preview={row.preview ?? ""}
            at={row.activityAt}
            imageUrl={row.picture}
            active={row.id === activeId}
            unread={row.id === activeId ? 0 : row.unread}
            onSelect={() => {
              drawerState?.setDrawer("none");
              (ctx.replace ?? ctx.navigate)(roomPath(row.id));
            }}
            onMarkRead={() => void ctx.commands["rooms.markRead"]?.(row.id as never)}
            menuItems={itemsOf(row)}
          />
        </ErrorBoundary>
      ))}
    </IslandBody>
  );

  return (
    <nav className="convo-circle" aria-label={uiCopy.conversations} aria-busy={catchingUp}>
      <ChatTabs
        tabs={tabs}
        value={tab?.id ?? ""}
        onChange={setChosen}
        panelId={panelId}
      />
      <VStack
        className="convo-circle-list"
        ref={listRef}
        id={panelId}
        role={tabs.length > 1 ? "tabpanel" : undefined}
      >
        <VStack gap={3} padding={2}>{body}</VStack>
      </VStack>
      {create && !isEmptyDevice && (
        <HStack className="convo-new">
          <IconButton
            label={copy.newLabel}
            tooltip={copy.newLabel}
            icon={<Icon icon={Plus} size="sm" />}
            variant="primary"
            size="lg"
            onClick={() => void create()}
          />
        </HStack>
      )}
      {asked && (
        <ConfirmDelete
          name={asked.row.title}
          label={asked.item.label}
          onCancel={() => setAsked(undefined)}
          onConfirm={() => {
            asked.item.run(asked.row, ctx);
            setAsked(undefined);
          }}
        />
      )}
    </nav>
  );
}
