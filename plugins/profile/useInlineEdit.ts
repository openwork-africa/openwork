import { useState } from "react";

/** Shared state machine for editing a room field in place. */
export function useInlineEdit(value: string, commit: (value: string) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const begin = (): void => {
    setDraft(value);
    setEditing(true);
  };
  const cancel = (): void => {
    setDraft(value);
    setEditing(false);
  };
  const save = (): void => {
    setEditing(false);
    commit(draft);
  };
  return { editing, draft, setDraft, begin, cancel, save };
}
