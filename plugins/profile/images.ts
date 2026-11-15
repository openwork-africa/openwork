import { type Base, isBase } from "@openwork/ui";
import type { FileStore } from "@openwork/store";

const PREFIX = "file:";

export const fileIdOf = (ref: string | undefined): string | undefined => ref?.startsWith(PREFIX) && ref.length > PREFIX.length ? ref.slice(PREFIX.length) : undefined;

export const refOf = (fileId: string): string => `${PREFIX}${fileId}`;

export const backgroundOf = (background: string | undefined, theme: Base): Base => (isBase(background) ? background : theme);

export const coverPathOf = (base: Base): string => `/assets/covers/${base}.jpg`;

/** The cover's picture: an uploaded one if it has loaded, else the cover of the chosen theme base (or the current theme's). */
export const coverUrlOf = (background: string | undefined, theme: Base, uploaded?: string): string =>
  (fileIdOf(background) && uploaded) || coverPathOf(backgroundOf(background, theme));

export interface ResolvedImage {
  url: string;
  release: () => void;
}

/** An image stored on this device shows from its bytes (an object URL to release); any other from the server. */
export async function resolveImage(files: FileStore, ref: string | undefined): Promise<ResolvedImage | undefined> {
  const id = fileIdOf(ref);
  if (!id) return undefined;
  const bytes = await files.get(id);
  if (!bytes) return { url: `/api/files/${encodeURIComponent(id)}`, release: () => {} };
  const url = URL.createObjectURL(bytes);
  return { url, release: () => URL.revokeObjectURL(url) };
}
