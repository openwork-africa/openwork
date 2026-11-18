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
 * (the server's `/api/ai/reply`). With a server that has no AI the one status check at boot says so, no reply is ever asked for, and the brain stays idle.
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
      const since = clock.now();
      let stop = (): void => {};
      let isStopped = false;
      const start = (): void => {
        if (!isStopped) stop = answerMessages({ store, client, brain, since, onFailure: (message) => notify(message, { status: "error" }) });
      };
      // One status check at boot: a server that says it has no AI is never asked for a reply. If it cannot be reached, replies are tried when needed.
      client.status().then((status) => status.configured && start(), start);
      return () => {
        isStopped = true;
        stop();
      };
    },
  });
}
