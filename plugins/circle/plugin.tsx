import { circleRowMenu, circleSource, contribute, definePlugin, deleteRoomCommand, provideCommand, runCommand, shellRegion } from "@openwork/kit";
import { devicePorts } from "@openwork/store";
import { copy } from "./copy.ts";
import { deviceReadMarks, type ReadMarks } from "./readMarks.ts";
import { roomRows } from "./roomRows.ts";

/** The conversation list: the circle island, the rooms of this device as its rows with unread counts, and Delete in each row's menu. */
export function circlePlugin(marks: ReadMarks = deviceReadMarks()) {
  return definePlugin({
    id: "circle",
    version: "0.1.0",
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
        when: (ctx) => ctx.commands[deleteRoomCommand.name] !== undefined,
        run: (row, ctx) => void runCommand(ctx, deleteRoomCommand, row.id),
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
