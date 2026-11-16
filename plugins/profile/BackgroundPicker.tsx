import type { ReactElement } from "react";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Badge } from "@astryxdesign/core/Badge";
import { Center } from "@astryxdesign/core/Center";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { useDevicePorts } from "@openwork/store";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ImagePlus } from "lucide-react";
import { type Base, baseLabel, DRAWER_PHONE_QUERY, Modal, THEME_BASES } from "@openwork/ui";
import { copy } from "./copy.ts";
import { coverPathOf } from "./images.ts";
import { useImageUpload } from "./useImageUpload.ts";

export function BackgroundPicker({ roomId, current, onClose }: { roomId: string; current: Base; onClose: () => void }): ReactElement {
  const ports = useDevicePorts();
  const { upload, uploading } = useImageUpload(roomId, async (background, accent) => {
    await ports.store.setRoomBackground(roomId, background, accent);
    onClose();
  });
  const pick = (base: Base) => {
    void ports.store.setRoomBackground(roomId, base).finally(onClose);
  };
  return (
    <Modal title={copy.chooseBackground} onClose={onClose} width={440} phoneQuery={DRAWER_PHONE_QUERY}>
      <Grid className="background-picker-grid" columns={2} gap={3} aria-label={copy.backgrounds}>
        <ClickableCard
          className="background-picker-upload"
          key="upload"
          label={copy.uploadPicture}
          variant="cyan"
          padding={1}
          isDisabled={uploading}
          onClick={upload}
        >
          <VStack gap={1.5}>
            <Center className="background-picker-upload-art" width="100%">
              <Icon icon={ImagePlus} size="md" />
            </Center>
            <HStack className="background-picker-caption" gap={1} vAlign="center" hAlign="between">
              <Text size="sm" weight="semibold" maxLines={1}>{uploading ? copy.uploading : copy.upload}</Text>
            </HStack>
          </VStack>
        </ClickableCard>
        {THEME_BASES.map((base) => (
          <ClickableCard
            className={`background-picker-theme${base === current ? " is-current" : ""}`}
            key={base}
            label={copy.backgroundOf(baseLabel(base))}
            padding={1}
            onClick={() => pick(base)}
          >
            <VStack gap={1.5}>
              <AspectRatio className="background-picker-cover" ratio={16 / 9} fit="cover">
                <img src={coverPathOf(base)} alt="" loading="lazy" draggable={false} />
              </AspectRatio>
              <HStack className="background-picker-caption" gap={1} vAlign="center" hAlign="between">
                <Text size="sm" weight={base === current ? "semibold" : undefined} maxLines={1}>{baseLabel(base)}</Text>
                {base === current && <Badge label={copy.current} variant="info" />}
              </HStack>
            </VStack>
          </ClickableCard>
        ))}
      </Grid>
    </Modal>
  );
}
