import type { FileStore } from "@openwork/store";
import { fileIdOf, objectUrlOf } from "@openwork/store";

/** Turns a room's `file:<id>` picture into an object URL, once per picture, and calls `changed` when one is ready. */
export function roomPictures(
  files: FileStore | undefined,
  changed: () => void,
): { urlOf(picture: string | undefined): string | undefined; stop(): void } {
  const urls = new Map<string, string>();
  const asked = new Set<string>();
  let active = true;
  return {
    urlOf(picture) {
      if (!picture) return undefined;
      const id = fileIdOf(picture);
      if (!id) return picture;
      if (!urls.has(picture) && !asked.has(picture) && files) {
        asked.add(picture);
        void files.get(id).then((blob) => {
          if (!blob || !active) return;
          urls.set(picture, objectUrlOf(blob));
          changed();
        });
      }
      return urls.get(picture);
    },
    stop() {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    },
  };
}
