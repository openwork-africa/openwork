import type { CSSProperties, ReactElement, ReactNode } from "react";
import { VStack } from "@astryxdesign/core/Stack";

// Words sit in their own selectable layer so they can be picked out (dragged, double-tapped), while the stamp stays
// unselected. Inline style, not only chat.css: it beats the menu's no-select however layers and StyleX specificity fall.
const selectableStyle = { userSelect: "text", WebkitUserSelect: "text", WebkitTouchCallout: "default", cursor: "text" } as const satisfies CSSProperties;

export function Selectable({ children }: { children: ReactNode }): ReactElement {
  return <VStack className="chat-selectable" style={selectableStyle}>{children}</VStack>;
}
