import type { ReactElement } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { copy } from "./copy.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { OneLine } from "./OneLine.tsx";

export interface FeedbackAction {
  label: string;
  run: () => void;
}

export interface FeedbackNotice {
  id: string;
  text: string;
  status: "info" | "success" | "warning" | "error";
  action?: FeedbackAction;
  undo?: FeedbackAction;
}

interface FeedbackProps {
  notices: readonly FeedbackNotice[];
  onDismiss: (id: string) => void;
}

function FeedbackStack({ notices, onDismiss }: FeedbackProps): ReactElement | null {
  if (!notices.length) return null;
  return (
    <VStack className="notice-stack">
      {notices.map((notice) => (
        <Banner
          key={notice.id}
          status={notice.status}
          title={<OneLine text={notice.text} />}
          dismissLabel={copy.dismiss}
          container="card"
          elevation="med"
          isDismissable
          onDismiss={() => onDismiss(notice.id)}
          endContent={(notice.action || notice.undo) && (
            <HStack gap={2}>
              {notice.undo && <Button label={notice.undo.label} variant="secondary" size="sm" onClick={notice.undo.run} />}
              {notice.action && <Button label={notice.action.label} variant="primary" size="sm" onClick={notice.action.run} />}
            </HStack>
          )}
        />
      ))}
    </VStack>
  );
}

/** The stack of notices floating at the foot of the screen. A failure inside it drops the stack quietly. */
export function Feedback(props: FeedbackProps): ReactElement {
  return (
    <ErrorBoundary name="notices" fallback={null}>
      <FeedbackStack {...props} />
    </ErrorBoundary>
  );
}
