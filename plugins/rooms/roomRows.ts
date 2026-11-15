import type { Observable, RowModel, SlotContext } from "@openwork/kit";
import {
  devicePorts,
  type DeviceStore,
  type Live,
  type Room,
  type TrailMessage,
} from "@openwork/store";
import { previewOf } from "./chatRow.ts";
import { roomPictures } from "./pictures.ts";
import type { ReadMarks } from "./readMarks.ts";

export function rowOf(
  room: Room,
  trail: readonly TrailMessage[],
  marks: ReadMarks,
  openId: string | undefined,
  picture: string | undefined,
): RowModel {
  const last = trail.at(-1);
  const newest = last?.createdAt ?? 0;
  if (room.id === openId || marks.get(room.id) === undefined) {
    marks.set(room.id, newest);
  }
  const mark = marks.get(room.id) ?? newest;
  return {
    id: room.id,
    title: room.name,
    preview: last ? previewOf(last.content, true) : "",
    activityAt: last?.createdAt ?? room.activityAt,
    unread: trail.filter((message) => message.createdAt > mark).length,
    picture,
  };
}

/**
 * The rooms on this device as rows, live: each room with its last message, how many messages came after the room was
 * last read here (the open room is read as it goes; a room never seen before starts read), and its picture.
 */
export function roomRows(
  ctx: SlotContext,
  marks: ReadMarks,
): Observable<RowModel[]> {
  const { store, files } = devicePorts(ctx.ports);
  return {
    subscribe(listener) {
      return watchRooms(store, ctx.roomId, marks, listener, files);
    },
  };
}

function watchRooms(
  store: DeviceStore,
  openId: string | undefined,
  marks: ReadMarks,
  listener: (rows: RowModel[]) => void,
  files: Parameters<typeof roomPictures>[0],
): () => void {
  const rooms = store.rooms();
  const trails = new Map<
    string,
    { live: Live<TrailMessage[]>; stop: () => void }
  >();
  const pictures = roomPictures(files, () => emit());
  const emit = (): void => {
    const list = rooms.get();
    if (!list) return;
    for (const [id, trail] of trails) {
      if (list.some((room) => room.id === id)) continue;
      trail.stop();
      trails.delete(id);
    }
    for (const room of list) {
      if (trails.has(room.id)) continue;
      const live = store.trail(room.id);
      trails.set(room.id, { live, stop: live.subscribe(emit) });
    }
    const loaded = list.map((room) => trails.get(room.id)?.live.get());
    if (loaded.some((trail) => trail === undefined)) return;
    listener(
      list.map((room, at) =>
        rowOf(
          room,
          loaded[at] ?? [],
          marks,
          openId,
          pictures.urlOf(room.picture),
        )
      ),
    );
  };
  const stopRooms = rooms.subscribe(emit);
  emit();
  return () => {
    stopRooms();
    trails.forEach((trail) => trail.stop());
    trails.clear();
    pictures.stop();
  };
}
