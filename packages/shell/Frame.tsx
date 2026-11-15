import { type ReactElement, useRef } from "react";
import { Layout, LayoutPanel } from "@astryxdesign/core/Layout";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { EmptyCard } from "@openwork/ui";
import { copy } from "./copy.ts";
import type { Drawer } from "./drawer.ts";
import { nextDrawer } from "./drawer.ts";
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
  drawer: Drawer;
  onDrawer: (drawer: Drawer) => void;
}

const PHONE = "(max-width: 47.9375rem)";

const listIsDrawer = (): boolean => globalThis.matchMedia?.(PHONE).matches ?? true;

const EmptyCircle = (): ReactElement => (
  <VStack className="convo-circle">
    <EmptyCard art="chat" title={copy.circleEmptyTitle} description={copy.circleEmptyDescription} />
  </VStack>
);

const EmptyPanel = (): ReactElement => (
  <VStack className="contact-panel" align="center" padding={6}>
    <Text type="supporting">{copy.panelEmpty}</Text>
  </VStack>
);

/** The three panes: list | window | panel. On a phone the list and the panel are drawers over the window. */
export function Frame({ circle = EmptyCircle, window = NoRoom, panel = EmptyPanel, roomId, drawer, onDrawer }: FrameProps): ReactElement {
  const shellRef = useRef<HTMLElement | null>(null);
  useSwipe(shellRef, (direction) => onDrawer(nextDrawer(drawer, direction, listIsDrawer())));
  const open = (drawer === "list" ? " is-list-open" : "") + (drawer === "panel" ? " is-panel-open" : "");
  return (
    <HStack ref={shellRef} className={`convo-shell${open}`}>
      <Layout
        start={
          <LayoutPanel width="var(--shell-list-width)" padding={0} isScrollable={false} label={copy.listLabel}>
            <Island name={copy.circleName} region={circle} roomId={roomId} />
          </LayoutPanel>
        }
        end={
          <LayoutPanel width="var(--shell-panel-width)" padding={0} isScrollable={false} label={copy.panelLabel}>
            <Island name={copy.panelName} region={panel} roomId={roomId} resetKey={roomId} />
          </LayoutPanel>
        }
      >
        <Island name={copy.windowName} region={roomId ? window : NoRoom} roomId={roomId} resetKey={roomId} />
      </Layout>
      <VStack className="convo-scrim" aria-hidden="true" onClick={() => onDrawer("none")} />
    </HStack>
  );
}
