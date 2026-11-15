import type { ReactElement, ReactNode } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

export type EmptyArt = "chat" | "calendar";

/** What a view with nothing in it shows: one card in the middle, its picture above what belongs here and what to do next. */
export function EmptyCard({ art, title, description, action }: { art: EmptyArt; title: string; description: string; action?: ReactNode }): ReactElement {
  return (
    <Card variant="muted" padding={6} className="empty-card">
      <VStack gap={3} align="center">
        <img className="empty-card-art" src={`/assets/empty/${art}.png`} alt="" />
        <VStack gap={1} align="center">
          <Heading level={3}>{title}</Heading>
          <Text color="secondary" justify="center" as="p">{description}</Text>
        </VStack>
        {action}
      </VStack>
    </Card>
  );
}
