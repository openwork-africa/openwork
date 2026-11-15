import type { ReactElement, ReactNode } from "react";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Stack } from "@astryxdesign/core/Stack";
import { copy } from "./copy.ts";

const PHONE = "(max-width: 47.98rem)";
const CARD_WIDTH = "22.5rem";

interface ModalProps {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}

/** An overlay for a short answer: an Astryx Dialog centred on desktop, a BottomSheet rising from the bottom edge on a phone. */
export function Modal(
  { title, children, onClose, actions }: ModalProps,
): ReactElement {
  const isPhone = useMediaQuery(PHONE);
  const onOpenChange = (open: boolean): void => {
    if (!open) onClose();
  };
  const footer = actions
    ? <Stack direction="horizontal" gap={2} justify="end">{actions}</Stack>
    : undefined;
  if (isPhone) {
    return (
      <BottomSheet
        isOpen
        onOpenChange={onOpenChange}
        label={title || copy.dialogLabel}
        purpose="info"
        height="hug"
      >
        <Stack gap={3} padding={3}>
          <Heading level={4}>{title}</Heading>
          {children}
          {footer}
        </Stack>
      </BottomSheet>
    );
  }
  return (
    <Dialog
      isOpen
      onOpenChange={onOpenChange}
      purpose="info"
      width={CARD_WIDTH}
    >
      <Layout
        height="auto"
        header={<DialogHeader title={title} onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            <Stack gap={3}>{children}</Stack>
          </LayoutContent>
        }
        footer={footer ? <LayoutFooter>{footer}</LayoutFooter> : undefined}
      />
    </Dialog>
  );
}
