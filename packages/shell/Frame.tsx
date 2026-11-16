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
  /** With no room on the device, the window offers to start one; without `onStart` it only says so. */
  noRooms?: boolean;
  /** The open room is not on this device: the window shows its loading frame while the shell leaves it. */
  isMissing?: boolean;
  onStart?: () => void;
  drawer: Drawer;
  onDrawer: (drawer: Drawer) => void;
}

const EmptyCircle = (): ReactElement => <VStack className="convo-circle" />;

const ClosedWindow = (): ReactElement => <NoRoom />;

const EmptyPanel = (): ReactElement => <VStack className="contact-panel" />;

/** The three panes: list | window | panel. On a phone the list and the panel are drawers over the window. */
export function Frame(
  { circle = EmptyCircle, window = ClosedWindow, panel = EmptyPanel, roomId, noRooms = false, isMissing = false, onStart, drawer, onDrawer }: FrameProps,
): ReactElement {
  const shellRef = useRef<HTMLElement | null>(null);
  useSwipe(shellRef, (direction) => {
    if (!roomId) return;
    const next = nextDrawer(drawer, direction, listIsDrawer());
    if (next === "list" && noRooms) return;
    onDrawer(next);
  });
  const open = (drawer === "list" ? " is-list-open" : "") + (drawer === "panel" ? " is-panel-open" : "");
  return (
    <HStack ref={shellRef} className={`convo-shell${open}`}>
      <Layout
        start={
          <LayoutPanel width="var(--shell-list-width)" padding={0} isScrollable={false} label={uiCopy.conversations}>
            <Island name={copy.circleName} region={circle} roomId={roomId} />
          </LayoutPanel>
        }
        end={roomId
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
          : <NoRoom isEmpty={noRooms} onStart={onStart} />}
      </Layout>
      <VStack className="convo-scrim" aria-hidden="true" onClick={() => onDrawer("none")} />
    </HStack>
  );
}
