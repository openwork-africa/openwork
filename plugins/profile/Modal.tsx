import type { ReactElement, ReactNode } from "react";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Stack } from "@astryxdesign/core/Stack";

const PHONE = "(max-width: 47.9375rem)";
const PANEL_WIDTH = "calc(var(--spacing-10) * 11)";

/** An overlay for a list of choices: a dialog on a desktop, a sheet rising from the bottom edge on a phone. The owner closes it by unmounting. */
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }): ReactElement {
  const isPhone = useMediaQuery(PHONE);
  const onOpenChange = (open: boolean) => !open && onClose();
  if (isPhone) {
    return (
      <BottomSheet isOpen onOpenChange={onOpenChange} label={title} purpose="info" height="hug">
        <Stack gap={3} padding={3}>
          <Heading level={4}>{title}</Heading>
          {children}
        </Stack>
      </BottomSheet>
    );
  }
  return (
    <Dialog isOpen onOpenChange={onOpenChange} purpose="info" width={PANEL_WIDTH}>
      <Layout
        height="auto"
        header={<DialogHeader title={title} onOpenChange={() => onClose()} />}
        content={<LayoutContent><Stack gap={3}>{children}</Stack></LayoutContent>}
      />
    </Dialog>
  );
}
