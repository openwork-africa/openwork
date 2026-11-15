import type { ReactElement } from "react";
import { Text } from "@astryxdesign/core/Text";
import { contribute, definePlugin, trailExtra, useCtx, useSlot } from "@openwork/kit";
import { greetingLine } from "./greetingSlots.ts";

function Greetings(): ReactElement {
  const lines = useSlot(greetingLine, useCtx());
  return <>{lines.map((line) => <Text key={line.id} type="supporting" as="p">{line.text}</Text>)}</>;
}

/** A toy plugin that opens a slot of its own: it draws every `greeting.line` under each message. */
export const greeting = definePlugin({
  id: "greeting",
  version: "1.0.0",
  slots: [greetingLine],
  contributes: [contribute(trailExtra, { id: "greetings", order: 50, render: () => <Greetings /> })],
});
