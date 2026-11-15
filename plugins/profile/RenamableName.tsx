import { type ReactElement, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { copy } from "./copy.ts";
import { usePorts } from "./usePorts.ts";

export function RenamableName({ roomId, name }: { roomId: string; name: string }): ReactElement {
  const { store } = usePorts();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const commit = () => {
    setIsEditing(false);
    const next = draft.trim();
    if (!next || next === name) return setDraft(name);
    void store.renameRoom(roomId, next);
  };
  return isEditing
    ? (
      <TextInput
        label={copy.renameLabel}
        isLabelHidden
        value={draft}
        placeholder={copy.namePlaceholder}
        onChange={setDraft}
        hasAutoFocus
        onEnter={commit}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          setDraft(name);
          setIsEditing(false);
        }}
      />
    )
    : (
      <Button
        label={name || copy.nameFallback}
        variant="ghost"
        tooltip={copy.nameTooltip}
        onClick={() => {
          setDraft(name);
          setIsEditing(true);
        }}
      >
        {name || <Text as="span" className="name-placeholder">{copy.namePlaceholder}</Text>}
      </Button>
    );
}
