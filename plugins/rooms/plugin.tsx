import { Trash2 } from "lucide-react";
import {
  circleRowMenu,
  circleSource,
  contribute,
  definePlugin,
  type Plugin,
  provideCommand,
  type SlotContext,
} from "@openwork/kit";
import { devicePorts } from "@openwork/store";
import { roomPath } from "@openwork/shell";
import { Icon } from "@astryxdesign/core/Icon";
import { copy } from "./copy.ts";
import { deviceReadMarks, type ReadMarks } from "./readMarks.ts";
import { roomRows } from "./roomRows.ts";

const ROOT = "/";

/** The rooms of this device: the circle's source, delete, and the `rooms.create` and `rooms.delete` commands. */
export function rooms(marks: ReadMarks = deviceReadMarks()): Plugin {
  const create = async (ctx: SlotContext): Promise<void> => {
    const room = await devicePorts(ctx.ports).store.createRoom(
      copy.newRoomName,
    );
    ctx.navigate(roomPath(room.id));
  };
  const remove = async (ctx: SlotContext, id: string): Promise<void> => {
    await devicePorts(ctx.ports).store.deleteRoom(id);
    if (ctx.roomId === id) ctx.navigate(ROOT);
  };
  return definePlugin({
    id: "rooms",
    version: "0.1.0",
    contributes: [
      contribute(circleSource, {
        id: "rooms",
        order: 10,
        rows: (ctx) => roomRows(ctx, marks),
      }),
      contribute(circleRowMenu, {
        id: "rooms.delete",
        order: 90,
        label: copy.deleteLabel,
        icon: <Icon icon={Trash2} size="sm" />,
        danger: true,
        run: (row, ctx) =>
          void (ctx.commands["rooms.delete"] as (id: string) => Promise<void>)(
            row.id,
          ),
      }),
    ],
    provides: [
      provideCommand("rooms.create", create),
      provideCommand("rooms.delete", remove),
    ],
  });
}
