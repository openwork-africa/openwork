import type { ReactElement } from "react";
import { Text } from "@astryxdesign/core/Text";

// Feedback copy stays on one line of its card: what does not fit ends in "…", and hovering shows the whole of it.
export function OneLine({ text }: { text: string }): ReactElement {
  return <Text type="inherit" color="inherit" maxLines={1}>{text}</Text>;
}
