import { type ReactElement, useRef } from "react";
import { Layout, LayoutPanel } from "@astryxdesign/core/Layout";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { ConversationLoading } from "./ConversationLoading.tsx";
import { copy as uiCopy } from "@openwork/ui";
import { copy } from "./copy.ts";
import type { Drawer } from "./drawer.ts";
import { listIsDrawer, nextDrawer } from "./drawer.ts";
import { Island, type Region } from "./Island.tsx";
import { NoRoom } from "./NoRoom.tsx";
import { useSwipe } from "./swipe.ts";

export interface Regions {
  circle?: Region;
  window?: Region;
  panel?: Region;
}

export interface FrameProps extends Regions {
  roomId?: string;
  /** There is no room on the device: the window says so. */
  noRooms?: boolean;
  /** The open room is not on this device: the window shows its loading frame while the shell leaves it. */
  isMissing?: boolean;
  drawer: Drawer;
  onDrawer: (drawer: Drawer) => void;
}

const ClosedWindow = (): ReactElement => <NoRoom />;

/** The panes: list | window | panel. The list and the panel are there only when a plugin gives their region; without them the window stands alone. On a phone they are drawers over the window. */
export function Frame(
  { circle, window = ClosedWindow, panel, roomId, noRooms = false, isMissing = false, drawer, onDrawer }: FrameProps,
): ReactElement {
  const shellRef = useRef<HTMLElement | null>(null);
  useSwipe(shellRef, (direction) => {
    if (!roomId) return;
    const next = nextDrawer(drawer, direction, listIsDrawer());
    if (next === "list" && (noRooms || !circle)) return;
    if (next === "panel" && !panel) return;
    onDrawer(next);
  });
  const open = (drawer === "list" ? " is-list-open" : "") + (drawer === "panel" ? " is-panel-open" : "");
  return (
    <HStack ref={shellRef} className={`convo-shell${open}`}>
      <Layout
        start={circle
          ? (
            <LayoutPanel width="var(--shell-list-width)" padding={0} isScrollable={false} label={uiCopy.conversations}>
              <Island name={copy.circleName} region={circle} roomId={roomId} />
            </LayoutPanel>
          )
          : undefined}
        end={roomId && panel
          ? (
            <LayoutPanel width="var(--shell-panel-width)" padding={0} isScrollable={false} label={uiCopy.contactDetails}>
              <Island name={copy.panelName} region={panel} roomId={roomId} resetKey={roomId} />
            </LayoutPanel>
          )
          : undefined}
      >
        {roomId
          ? isMissing
            ? <ConversationLoading />
            : <Island name={copy.windowName} region={window} roomId={roomId} resetKey={roomId} loading={<ConversationLoading />} />
          : <NoRoom isEmpty={noRooms} />}
      </Layout>
      <VStack className="convo-scrim" aria-hidden="true" onClick={() => onDrawer("none")} />
    </HStack>
  );
}
