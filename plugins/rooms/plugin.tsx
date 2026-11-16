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
import { copy } from "./copy.ts";
import { deviceReadMarks, type ReadMarks } from "./readMarks.ts";
import { roomRows } from "./roomRows.ts";

const ROOT = "/";
const UNDO_HOLD_MS = 8_000;

/** The rooms of this device: the circle's source, delete, and the `rooms.create` and `rooms.delete` commands. */
export function rooms(marks: ReadMarks = deviceReadMarks()): Plugin {
  const create = async (ctx: SlotContext): Promise<void> => {
    const room = await devicePorts(ctx.ports).store.createRoom(
      copy.newRoomName,
    );
    ctx.navigate(roomPath(room.id));
  };
  const remove = async (ctx: SlotContext, id: string): Promise<void> => {
    const { store } = devicePorts(ctx.ports);
    await store.deleteRoom(id);
    if (ctx.roomId === id) ctx.navigate(ROOT);
    offerUndo(ctx, id);
  };
  const offerUndo = (ctx: SlotContext, id: string): void => {
    const undo = (): void => {
      devicePorts(ctx.ports).store.restoreRoom(id).catch(() =>
        ctx.notify(copy.notBroughtBack, {
          status: "error",
          holdMs: UNDO_HOLD_MS,
          action: { label: copy.tryAgain, run: undo },
        })
      );
    };
    ctx.notify(copy.removed, { holdMs: UNDO_HOLD_MS, action: { label: copy.undo, run: undo } });
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
        icon: null,
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
