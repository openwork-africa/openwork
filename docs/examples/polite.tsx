import { contribute, definePlugin } from "@openwork/kit";
import { greetingLine } from "./greetingSlots.ts";

/** A toy plugin on a plugin: it fills the slot `greeting` opened, and is skipped (with a notice) if `greeting` is missing. */
export const polite = definePlugin({
  id: "polite",
  version: "0.1.0",
  requires: { greeting: "^1" },
  contributes: [contribute(greetingLine, { id: "polite", order: 10, text: "Thank you for your message." })],
});
