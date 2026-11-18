import { contribute, definePlugin, type Plugin, trailAction, trailBody } from "@openwork/kit";
import { Icon } from "@astryxdesign/core/Icon";
import { Copy } from "lucide-react";
import { copyText } from "./clipboard.ts";
import { copy } from "./copy.ts";
import { LongWords } from "./LongWords.tsx";

/** The "text" kind: messages that are words, drawn as Markdown, with Copy in their menu. */
export const text: Plugin = definePlugin({
  id: "text",
  version: "0.1.0",
  contributes: [
    contribute(trailBody, {
      id: "markdown",
      order: 100,
      kind: "text",
      matches: (message) => (message.kind ?? "text") === "text",
      render: (message) => <LongWords text={message.content} />,
    }),
    contribute(trailAction, {
      id: "copy",
      order: 10,
      label: copy.copy,
      icon: <Icon icon={Copy} />,
      appliesTo: (message) => message.content.trim() !== "",
      run: (message) => void copyText(message.content),
    }),
  ],
});
