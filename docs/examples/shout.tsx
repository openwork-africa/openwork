import { Icon } from "@astryxdesign/core/Icon";
import { Megaphone } from "lucide-react";
import { contribute, definePlugin, trailAction } from "@openwork/kit";
import { devicePorts } from "@openwork/store";

/** A toy plugin: a "Shout" item in every message's menu that sends an uppercased copy of it. */
export const shout = definePlugin({
  id: "shout",
  version: "0.1.0",
  contributes: [
    contribute(trailAction, {
      id: "shout",
      order: 50,
      label: "Shout",
      icon: <Icon icon={Megaphone} />,
      appliesTo: (message) => message.content.trim() !== "",
      run: (message, ctx) => void devicePorts(ctx.ports).store.send(message.roomId, message.content.toUpperCase()),
    }),
  ],
});
