import { type ReactElement, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { ImagePlus } from "lucide-react";
import { notify } from "@openwork/kit";
import { copy } from "./copy.ts";
import { Modal } from "./Modal.tsx";
import { pickImage, storeImage } from "./upload.ts";
import { usePorts } from "./usePorts.ts";

export function ProfileImagePicker({ roomId, onClose }: { roomId: string; onClose: () => void }): ReactElement {
  const ports = usePorts();
  const [uploading, setUploading] = useState(false);
  const upload = async () => {
    const file = await pickImage();
    if (!file) return;
    setUploading(true);
    try {
      await ports.store.setRoomPicture(roomId, await storeImage(ports, roomId, file));
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), { status: "error" });
    } finally {
      setUploading(false);
    }
  };
  return (
    <Modal title={copy.changeImage} onClose={onClose}>
      <Button label={copy.uploadImage} icon={<Icon icon={ImagePlus} size="sm" />} isDisabled={uploading} onClick={() => void upload()} />
    </Modal>
  );
}
