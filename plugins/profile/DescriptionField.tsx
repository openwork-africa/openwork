import { type ReactElement, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { notify } from "@openwork/kit";
import { copy } from "./copy.ts";
import { usePorts } from "./usePorts.ts";

// The room's description, under its name: one flat line, cut to fit; a click turns it into a borderless line typed in
// place, kept when you leave it or press Enter, put back with Escape (as the name above it).
export function DescriptionField({ roomId, description }: { roomId: string; description: string }): ReactElement {
  const { store } = usePorts();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const commit = () => {
    setIsEditing(false);
    if (draft.trim() === description.trim()) return setDraft(description);
    void store.setRoomDescription(roomId, draft.trim() || undefined).catch((error: Error) => notify(error.message, { status: "error" }));
  };
  return isEditing
    ? (
      <TextInput
        className="inline-input description-input"
        label={copy.descriptionLabel}
        isLabelHidden
        placeholder={copy.descriptionPlaceholder}
        size="sm"
        width="100%"
        value={draft}
        onChange={setDraft}
        hasAutoFocus
        onEnter={commit}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          setDraft(description);
          setIsEditing(false);
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
        onClick={() => {
          setDraft(description);
          setIsEditing(true);
        }}
      />
    );
}
