import { definePlugin, type Plugin, provideCommand, type SlotContext } from "@openwork/kit";
import { devicePorts } from "@openwork/store";
import { roomPath } from "@openwork/kit";
import { copy } from "./copy.ts";
import { createRoomCommand, deleteRoomCommand } from "./services.ts";

const ROOT = "/";
const UNDO_HOLD_MS = 8_000;

/** The rooms of this device: the `rooms.create` and `rooms.delete` commands. The list that shows them is the circle plugin's. */
export function rooms(): Plugin {
  const create = async (ctx: SlotContext): Promise<void> => {
    const room = await devicePorts(ctx.ports).store.createRoom(
      copy.newRoomName,
    );
    (ctx.replace ?? ctx.navigate)(roomPath(room.id));
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
    contributes: [],
    provides: [
      provideCommand(createRoomCommand, create),
      provideCommand(deleteRoomCommand, remove),
    ],
  });
}
