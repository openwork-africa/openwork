import { type ReactElement, useState } from "react";
import { StackItem, VStack, HStack } from "@astryxdesign/core/Stack";
import type { Room } from "@openwork/store";
import { Avatar } from "@openwork/ui";
import { ContactCover } from "./ContactCover.tsx";
import { copy } from "./copy.ts";
import { DescriptionField } from "./DescriptionField.tsx";
import { ProfileImagePicker } from "./ProfileImagePicker.tsx";
import { RenamableName } from "./RenamableName.tsx";
import { useImageUrl } from "./useImageUrl.ts";
import { usePorts } from "./usePorts.ts";

export function ContactHeroBody({ room }: { room: Room }): ReactElement {
  const { files } = usePorts();
  const [isPicking, setIsPicking] = useState(false);
  const imageUrl = useImageUrl(files, room.picture);
  return (
    <VStack gap={0} className="contact-hero-body">
      <HStack gap={2} vAlign="start" paddingInline={4}>
        <VStack className="profile-avatar-wrap">
          <VStack className="profile-avatar">
            <Avatar id={room.id} name={room.name} imageUrl={imageUrl} size={96} shape="rounded" onClick={() => setIsPicking(true)} label={copy.changeImage} />
          </VStack>
        </VStack>
        <StackItem size="fill">
          <VStack gap={0.5} hAlign="start" paddingBlockStart={10}>
            <HStack gap={2} vAlign="start" width="100%">
              <StackItem size="fill">
                <RenamableName key={room.id} roomId={room.id} name={room.name} />
              </StackItem>
            </HStack>
            <DescriptionField key={`${room.id}:${room.description ?? ""}`} roomId={room.id} description={room.description ?? ""} />
          </VStack>
        </StackItem>
      </HStack>
      {isPicking && <ProfileImagePicker roomId={room.id} onClose={() => setIsPicking(false)} />}
    </VStack>
  );
}

export function ContactHero({ room }: { room: Room }): ReactElement {
  return (
    <VStack gap={0}>
      <ContactCover roomId={room.id} background={room.background} />
      <ContactHeroBody room={room} />
    </VStack>
  );
}
