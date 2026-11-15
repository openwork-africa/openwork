import { type ReactElement, useState } from "react";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Badge } from "@astryxdesign/core/Badge";
import { Center } from "@astryxdesign/core/Center";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ImagePlus } from "lucide-react";
import { notify } from "@openwork/kit";
import type { Base } from "@openwork/ui";
import { baseLabel, THEMES } from "./bases.ts";
import { copy } from "./copy.ts";
import { coverPathOf } from "./images.ts";
import { Modal } from "./Modal.tsx";
import { pickImage, storeImage } from "./upload.ts";
import { usePorts } from "./usePorts.ts";

export function BackgroundPicker({ roomId, current, onClose }: { roomId: string; current: Base; onClose: () => void }): ReactElement {
  const ports = usePorts();
  const [uploading, setUploading] = useState(false);
  const pick = (base: Base) => {
    void ports.store.setRoomBackground(roomId, base).finally(onClose);
  };
  const upload = async () => {
    const file = await pickImage();
    if (!file) return;
    setUploading(true);
    try {
      await ports.store.setRoomBackground(roomId, await storeImage(ports, roomId, file));
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), { status: "error" });
    } finally {
      setUploading(false);
    }
  };
  return (
    <Modal title={copy.chooseBackground} onClose={onClose}>
      <Grid columns={3} gap={2} aria-label={copy.backgrounds}>
        <ClickableCard key="upload" label={copy.uploadPicture} variant="cyan" padding={1} isDisabled={uploading} onClick={upload}>
          <Center width="100%" style={{ aspectRatio: "16 / 10" }}>
            <VStack gap={0.5} hAlign="center">
              <Icon icon={ImagePlus} size="sm" />
              <Text size="sm" as="div" maxLines={1}>{uploading ? copy.uploading : copy.upload}</Text>
            </VStack>
          </Center>
        </ClickableCard>
        {THEMES.map((base) => (
          <ClickableCard key={base} label={copy.backgroundOf(baseLabel(base))} padding={1} onClick={() => pick(base)}>
            <VStack gap={1}>
              <AspectRatio ratio={1536 / 456} fit="cover">
                <img src={coverPathOf(base)} alt="" loading="lazy" draggable={false} />
              </AspectRatio>
              <HStack gap={1} vAlign="center">
                <Text size="sm" maxLines={1}>{baseLabel(base)}</Text>
                {base === current && <Badge label={copy.current} variant="neutral" />}
              </HStack>
            </VStack>
          </ClickableCard>
        ))}
      </Grid>
    </Modal>
  );
}
