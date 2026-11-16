import type { ReactElement, ReactNode } from "react";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Stack } from "@astryxdesign/core/Stack";
import { DRAWER_PHONE_QUERY, PHONE_QUERY } from "./media.ts";

export function Modal({ title, children, onClose, actions, width = 440, phoneQuery = PHONE_QUERY, label = title }: {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  width?: number | string;
  phoneQuery?: string;
  label?: string;
}): ReactElement {
  const isPhone = useMediaQuery(phoneQuery);
  const onOpenChange = (open: boolean): void => {
    if (!open) onClose();
  };
  const footer = actions ? <Stack direction="horizontal" gap={2} justify="end">{actions}</Stack> : undefined;
  if (isPhone) {
    return (
      <BottomSheet isOpen onOpenChange={onOpenChange} label={label} purpose="info" height="hug">
        <Stack gap={3} padding={3}>
          <Heading level={4}>{title}</Heading>
          {children}
          {footer}
        </Stack>
      </BottomSheet>
    );
  }
  return (
    <Dialog isOpen onOpenChange={onOpenChange} purpose="info" width={width}>
      <Layout
        height="auto"
        header={<DialogHeader title={title} onOpenChange={onClose} />}
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

export const DEFAULT_MODAL_PHONE_QUERY = DRAWER_PHONE_QUERY;
