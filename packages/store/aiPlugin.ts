import { definePlugin, type Plugin, type Ports, provide, service } from "@openwork/kit";
import { AiBrain } from "./aiBrain.ts";
import type { AiClient } from "./aiClient.ts";
import { answerMessages } from "./aiReplies.ts";
import { type Brain, devicePorts } from "./ports.ts";

/** What answers in a room. The conversation window reads it; without a plugin providing it, the room is a note to self. */
export const brainService = service<Brain>("brain");

const clientOf = (ports: Ports): AiClient | undefined => (ports as { ai?: AiClient }).ai;

/**
 * The AI reply path of the device: provides the brain, and answers the person's messages through the `ai` port
 * (the server's `/api/ai/reply`). With a server that has no AI the brain stays idle and nothing is saved.
 */
export function aiPlugin(): Plugin {
  const brain = new AiBrain();
  return definePlugin({
    id: "ai",
    version: "0.1.0",
    contributes: [],
    provides: [provide(brainService, brain)],
    setup({ ports, notify }) {
      const client = clientOf(ports);
      if (!client) return;
      const { store, clock } = devicePorts(ports);
      brain.connect(client);
      return answerMessages({ store, client, brain, since: clock.now(), onFailure: (message) => notify(message, { status: "error" }) });
    },
  });
}
