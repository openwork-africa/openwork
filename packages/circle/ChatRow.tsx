import type { ReactElement } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import {
  ContextMenu,
  type ContextMenuItemData,
} from "@astryxdesign/core/ContextMenu";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Avatar } from "@openwork/ui";
import { copy } from "./copy.ts";

interface ChatRowProps {
  name: string;
  preview: string;
  /** When the last message was sent (epoch ms), shown as a relative time. */
  at?: number;
  imageUrl?: string;
  active: boolean;
  /** Messages you have not read here; none shows nothing. */
  unread?: number;
  onSelect: () => void;
  /** Right-click or long-press on the row; without items the row has no menu. */
  menuItems?: ContextMenuItemData[];
}

const unreadText = (
  unread: number,
): string => (unread > copy.unreadMax ? `${copy.unreadMax}+` : String(unread));

const notAhead = (at: number): string =>
  new Date(Math.min(at, Date.now())).toISOString();

/**
 * One conversation in the list: a large avatar beside the name and time, with the last message under them. The open
 * conversation takes the muted fill and its avatar the accent ring. What you have not read is counted at the end of
 * the last message, which is then set heavier. Every measure is a spacing token.
 */
export function ChatRow(
  { name, preview, at, imageUrl, active, unread = 0, onSelect, menuItems }:
    ChatRowProps,
): ReactElement {
  const row = (
    <ClickableCard
      label={name}
      variant={active ? "muted" : "transparent"}
      padding={0}
      onClick={onSelect}
    >
      <HStack gap={2} vAlign="center" paddingBlock={1.5} paddingInline={2}>
        <Avatar name={name} imageUrl={imageUrl} size="lg" selected={active} />
        <StackItem size="fill">
          <VStack>
            <HStack gap={1} vAlign="center" hAlign="between">
              <StackItem size="fill">
                <Text
                  type="large"
                  weight="bold"
                  color="secondary"
                  maxLines={1}
                  hasTruncateTooltip={false}
                >
                  {name}
                </Text>
              </StackItem>
              {at !== undefined && (
                <StackItem>
                  <Timestamp value={notAhead(at)} format="relative_short" />
                </StackItem>
              )}
            </HStack>
            <HStack gap={1} vAlign="center" hAlign="between">
              <StackItem size="fill">
                <Text
                  size="sm"
                  weight={unread > 0 ? "semibold" : undefined}
                  maxLines={1}
                  hasTruncateTooltip={false}
                >
                  {preview}
                </Text>
              </StackItem>
              {unread > 0 && (
                <Badge
                  className="chat-unread"
                  variant="info"
                  label={unreadText(unread)}
                  aria-label={copy.unreadLabel(unread)}
                />
              )}
            </HStack>
          </VStack>
        </StackItem>
      </HStack>
    </ClickableCard>
  );
  return menuItems?.length
    ? (
      <ContextMenu
        items={menuItems}
        presentation="adaptive"
        label={copy.menuLabel(name)}
      >
        {row}
      </ContextMenu>
    )
    : row;
}

/** Rows shaped like ChatRow, shimmering, while what goes in them is still being read: the avatar, a name, a last message. */
export function ChatRowsLoading(
  { count = 3 }: { count?: number },
): ReactElement {
  return (
    <VStack gap={3} role="status" aria-label={copy.loadingLabel}>
      {Array.from(
        { length: count },
        (_, at) => (
          <HStack
            key={at}
            gap={2}
            vAlign="center"
            paddingBlock={1.5}
            paddingInline={2}
          >
            <Skeleton
              width="var(--spacing-12)"
              height="var(--spacing-12)"
              radius="rounded"
              index={at}
            />
            <StackItem size="fill">
              <VStack gap={1}>
                <Skeleton
                  width="40%"
                  height="var(--font-size-lg)"
                  radius={1}
                  index={at}
                />
                <Skeleton
                  width="70%"
                  height="var(--font-size-sm)"
                  radius={1}
                  index={at}
                />
              </VStack>
            </StackItem>
          </HStack>
        ),
      )}
    </VStack>
  );
}
