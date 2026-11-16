import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@openwork/kit";
import { useLive } from "./live.ts";
import { devicePorts, type DeviceStore, type FileStore } from "./ports.ts";
import { fileIdOf, objectUrlOf } from "./fileRefs.ts";
import type { Room, SyncStatus, TrailMessage } from "./types.ts";

const currentStatus = { get: () => "current" as SyncStatus, subscribe: () => () => {} };

export const useRooms = (store: DeviceStore): Room[] | undefined => useLive(useMemo(() => store.rooms(), [store]));

export const useDevicePorts = () => {
  const { ports } = useCtx();
  return useMemo(() => devicePorts(ports), [ports]);
};

export const useRoom = (store: DeviceStore, id: string): Room | null | undefined => useLive(useMemo(() => store.room(id), [store, id]));

export const useTrail = (store: DeviceStore, roomId: string): TrailMessage[] | undefined => useLive(useMemo(() => store.trail(roomId), [store, roomId]));

export const useSyncStatus = (store: DeviceStore | undefined): SyncStatus =>
  useLive(useMemo(() => store ? store.syncStatus() : currentStatus, [store])) ?? "current";

/** Resolves a file reference to a local object URL or its server URL and revokes local URLs on change/unmount. */
export function useFileUrl(files: FileStore | undefined, ref: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    let release = () => {};
    setUrl(undefined);
    const id = fileIdOf(ref);
    if (!id) {
      return () => {
        active = false;
      };
    }
    if (!files) {
      setUrl(`/api/files/${encodeURIComponent(id)}`);
      return () => {
        active = false;
      };
    }
    void files.get(id).then((blob) => {
      if (!active) return;
      if (!blob) return setUrl(`/api/files/${encodeURIComponent(id)}`);
      const objectUrl = objectUrlOf(blob);
      release = () => URL.revokeObjectURL(objectUrl);
      setUrl(objectUrl);
    });
    return () => {
      active = false;
      release();
    };
  }, [files, ref]);
  return url;
}
