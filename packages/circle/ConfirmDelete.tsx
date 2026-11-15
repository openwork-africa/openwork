import type { ReactElement } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { copy } from "./copy.ts";
import { Modal } from "./Modal.tsx";

interface ConfirmDeleteProps {
  name: string;
  /** The danger menu item's label, which is also the confirming button. */
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before deleting: centred on desktop, a bottom sheet on a phone. Cancel has the cursor when it opens: the safe answer is the one Enter gives. */
export function ConfirmDelete(
  { name, label, onConfirm, onCancel }: ConfirmDeleteProps,
): ReactElement {
  return (
    <Modal
      title={copy.confirmTitle}
      onClose={onCancel}
      actions={
        <>
          <Button
            label={copy.cancel}
            variant="ghost"
            onClick={onCancel}
            data-autofocus
          />
          <Button label={label} variant="destructive" onClick={onConfirm} />
        </>
      }
    >
      <Text as="p">{copy.confirmBody(name)}</Text>
    </Modal>
  );
}
