import type { FileStore } from "@openwork/store";

const FILE = "file:";

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
      if (!picture.startsWith(FILE)) return picture;
      if (!urls.has(picture) && !asked.has(picture) && files) {
        asked.add(picture);
        void files.get(picture.slice(FILE.length)).then((blob) => {
          if (!blob || !active) return;
          urls.set(picture, URL.createObjectURL(blob));
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
