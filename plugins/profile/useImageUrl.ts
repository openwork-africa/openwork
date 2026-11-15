import { useEffect, useState } from "react";
import type { FileStore } from "@openwork/store";
import { resolveImage } from "./images.ts";

/** The address an image reference shows from, kept for as long as the reference holds; undefined until it resolves. */
export function useImageUrl(files: FileStore, ref: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let release = () => {};
    let stale = false;
    setUrl(undefined);
    void resolveImage(files, ref).then((image) => {
      if (!image) return;
      if (stale) return image.release();
      release = image.release;
      setUrl(image.url);
    });
    return () => {
      stale = true;
      release();
    };
  }, [files, ref]);
  return url;
}
