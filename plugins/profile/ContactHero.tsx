import { type ReactElement } from "react";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import type { Room } from "@openwork/store";
import { Avatar } from "@openwork/ui";
import { DescriptionField } from "./DescriptionField.tsx";
import { RenamableName } from "./RenamableName.tsx";

export function ContactHeroBody({ room }: { room: Room }): ReactElement {
  return (
    <VStack gap={0} className="contact-hero-body">
      <HStack gap={2} vAlign="start" paddingInline={4}>
        <VStack className="profile-avatar-wrap">
          <VStack className="profile-avatar">
            <Avatar name={room.name} size={96} shape="rounded" />
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
    </VStack>
  );
}
