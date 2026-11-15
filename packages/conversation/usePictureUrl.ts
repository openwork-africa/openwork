import { useEffect, useState } from "react";
import type { Ports } from "@openwork/kit";
import { devicePorts } from "@openwork/store";

const FILE_PREFIX = "file:";

/** A room's picture as something an image can show: an uploaded one is read from the file store, anything else is used as written. */
export function usePictureUrl(ports: Ports, picture: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!picture?.startsWith(FILE_PREFIX)) return setUrl(picture);
    let made: string | undefined;
    let isCurrent = true;
    void devicePorts(ports).files.get(picture.slice(FILE_PREFIX.length)).then((blob) => {
      if (!isCurrent || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      isCurrent = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [ports, picture]);
  return url;
}
