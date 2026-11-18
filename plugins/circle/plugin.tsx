import { commandKey, contribute, definePlugin, provideCommand, runCommand, shellRegion } from "@openwork/kit";
import { devicePorts } from "@openwork/store";
import { copy } from "./copy.ts";
import { deviceReadMarks, type ReadMarks } from "./readMarks.ts";
import { roomRows } from "./roomRows.ts";
import { circleEmpty, circleRowMenu, circleSource, circleTab } from "./slots.ts";

/** Provided by the rooms plugin when the product has it; the list only runs it by name. */
const deleteRoom = commandKey<[id: string], Promise<void>>("rooms.delete");

/** The conversation list: the circle island, the rooms of this device as its rows with unread counts, and Delete in each row's menu. */
export function circlePlugin(marks: ReadMarks = deviceReadMarks()) {
  return definePlugin({
    id: "circle",
    version: "0.1.0",
    slots: [circleSource, circleTab, circleRowMenu, circleEmpty],
    contributes: [
      contribute(shellRegion, {
        id: "circle",
        order: 10,
        region: "circle",
        load: () => import("./Circle.tsx").then((module) => ({ default: module.Circle })),
      }),
      contribute(circleSource, { id: "rooms", order: 10, rows: (ctx) => roomRows(ctx, marks) }),
      contribute(circleRowMenu, {
        id: "rooms.delete",
        order: 90,
        label: copy.deleteLabel,
        icon: null,
        danger: true,
        when: (ctx) => ctx.commands[deleteRoom.name] !== undefined,
        run: (row, ctx) => void runCommand(ctx, deleteRoom, row.id),
      }),
    ],
    provides: [
      provideCommand("circle.markRead", (ctx, id: string) => {
        const messages = devicePorts(ctx.ports).store.trail(id).get();
        marks.set(id, messages?.at(-1)?.createdAt ?? Date.now());
      }),
    ],
  });
}
