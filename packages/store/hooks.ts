import { useMemo } from "react";
import { useLive } from "./live.ts";
import type { DeviceStore } from "./ports.ts";
import type { Room, SyncStatus, TrailMessage } from "./types.ts";

export const useRooms = (store: DeviceStore): Room[] | undefined => useLive(useMemo(() => store.rooms(), [store]));

export const useRoom = (store: DeviceStore, id: string): Room | null | undefined => useLive(useMemo(() => store.room(id), [store, id]));

export const useTrail = (store: DeviceStore, roomId: string): TrailMessage[] | undefined =>
  useLive(useMemo(() => store.trail(roomId), [store, roomId]));

export const useSyncStatus = (store: DeviceStore): SyncStatus => useLive(useMemo(() => store.syncStatus(), [store])) ?? "current";

