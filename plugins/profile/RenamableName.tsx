import type { ReactElement } from "react";
import { Button } from "@astryxdesign/core/Button";
import { useDevicePorts } from "@openwork/store";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { copy } from "./copy.ts";
import { notify } from "@openwork/kit";
import { problem } from "./problem.ts";
import { useInlineEdit } from "./useInlineEdit.ts";

export function RenamableName({ roomId, name }: { roomId: string; name: string }): ReactElement {
  const { store } = useDevicePorts();
  const edit = useInlineEdit(name, (draft) => {
    const next = draft.trim();
    if (!next || next === name) return;
    void store.renameRoom(roomId, next).catch((error: unknown) => notify(problem(error), { status: "error" }));
  });
  return edit.editing
    ? (
      <TextInput
        label={copy.renameLabel}
        isLabelHidden
        value={edit.draft}
        placeholder={copy.namePlaceholder}
        onChange={edit.setDraft}
        hasAutoFocus
        onEnter={edit.save}
        onBlur={edit.save}
        onKeyDown={(event) => {
          if (event.key === "Escape") edit.cancel();
        }}
      />
    )
    : (
      <Button
        label={name || copy.nameFallback}
        variant="ghost"
        tooltip={copy.nameTooltip}
        onClick={edit.begin}
      >
        {name || <Text as="span" className="name-placeholder">{copy.namePlaceholder}</Text>}
      </Button>
    );
}
