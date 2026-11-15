import { contribute, definePlugin, type Plugin, trailAction, trailBody } from "@openwork/kit";
import { Icon } from "@astryxdesign/core/Icon";
import { Copy, Info } from "lucide-react";
import { copyText } from "./clipboard.ts";
import { copy } from "./copy.ts";
import { LongWords } from "./LongWords.tsx";

/** A message is words: drawn as Markdown, with Copy in its menu, and the reason it was not delivered when it was not. */
export const text: Plugin = definePlugin({
  id: "text",
  version: "0.1.0",
  contributes: [
    contribute(trailBody, { id: "markdown", order: 100, kind: "text", matches: () => true, render: (message) => <LongWords text={message.content} /> }),
    contribute(trailAction, {
      id: "copy",
      order: 10,
      label: copy.copy,
      icon: <Icon icon={Copy} />,
      appliesTo: (message) => message.content.trim() !== "",
      run: (message) => void copyText(message.content),
    }),
    contribute(trailAction, {
      id: "error-details",
      order: 20,
      label: copy.errorDetails,
      icon: <Icon icon={Info} />,
      appliesTo: (message) => message.state === "failed",
      run: (_message, ctx) => void ctx.notify(copy.notDelivered, { status: "error" }),
    }),
  ],
});
