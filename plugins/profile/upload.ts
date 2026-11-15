import type { DevicePorts } from "@openwork/store";
import { refOf } from "./images.ts";

/** Opens the browser's own file chooser: the picture chosen, or nothing when it is dismissed. */
export const pickImage = (): Promise<File | undefined> =>
  new Promise((resolve) => {
    const chooser = document.createElement("input");
    chooser.setAttribute("type", "file");
    chooser.accept = "image/*";
    chooser.addEventListener("change", () => resolve(chooser.files?.[0]));
    chooser.addEventListener("cancel", () => resolve(undefined));
    chooser.click();
  });

/** The bytes stay on the device first, then a file record is queued for the server. Answers the `file:` reference. */
export async function storeImage({ store, files }: Pick<DevicePorts, "store" | "files">, roomId: string, file: File): Promise<string> {
  const id = crypto.randomUUID();
  await files.put(id, file);
  await store.putFile({ id, parentId: roomId, name: file.name, mimeType: file.type, size: file.size });
  return refOf(id);
}
