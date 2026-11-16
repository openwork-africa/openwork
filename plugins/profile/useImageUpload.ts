import { useState } from "react";
import { notify } from "@openwork/kit";
import { useDevicePorts } from "@openwork/store";
import { imageAccent } from "./imageAccent.ts";
import { problem } from "./problem.ts";
import { pickImage, storeImage } from "./upload.ts";

/** Pick, persist, and apply an uploaded background as one operation. */
export function useImageUpload(roomId: string, apply: (ref: string, accent?: string) => Promise<void>) {
  const ports = useDevicePorts();
  const [uploading, setUploading] = useState(false);
  const upload = async (): Promise<void> => {
    const file = await pickImage();
    if (!file) return;
    setUploading(true);
    try {
      const [ref, accent] = await Promise.all([storeImage(ports, roomId, file), imageAccent(file).catch(() => undefined)]);
      await apply(ref, accent);
    } catch (error) {
      notify(problem(error), { status: "error" });
    } finally {
      setUploading(false);
    }
  };
  return { upload, uploading };
}
