import type { ReactElement } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { notify } from "@openwork/kit";
import { useDevicePorts } from "@openwork/store";
import { copy } from "./copy.ts";
import { problem } from "./problem.ts";
import { useInlineEdit } from "./useInlineEdit.ts";

// The room's description, under its name: one flat line, cut to fit; a click turns it into a borderless line typed in
// place, kept when you leave it or press Enter, put back with Escape (as the name above it).
export function DescriptionField({ roomId, description }: { roomId: string; description: string }): ReactElement {
  const { store } = useDevicePorts();
  const edit = useInlineEdit(description, (draft) => {
    if (draft.trim() === description.trim()) return;
    void store.setRoomDescription(roomId, draft.trim() || undefined).catch((error: unknown) => notify(problem(error), { status: "error" }));
  });
  return edit.editing
    ? (
      <TextInput
        className="inline-input description-input"
        label={copy.descriptionLabel}
        isLabelHidden
        placeholder={copy.descriptionPlaceholder}
        size="sm"
        width="100%"
        value={edit.draft}
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
        className="description-line"
        label={description.split("\n")[0] || copy.descriptionPlaceholder}
        variant="ghost"
        size="sm"
        tooltip={copy.descriptionTooltip}
        onClick={edit.begin}
      />
    );
}
