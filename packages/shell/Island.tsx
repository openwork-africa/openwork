import { type ComponentType, type ReactElement, Suspense } from "react";
import { ErrorBoundary, Loading, SectionError } from "@openwork/ui";

export interface RegionProps {
  roomId?: string;
}

/** A region the product fills in. It may be lazy: `React.lazy(...)` components fit. */
export type Region = ComponentType<RegionProps>;

interface IslandProps {
  name: string;
  region: Region;
  roomId?: string;
  resetKey?: unknown;
}

/** One region of the frame as its own island: if it fails, it shows a note with Try again and the rest carries on. */
export function Island({ name, region: Content, roomId, resetKey }: IslandProps): ReactElement {
  return (
    <ErrorBoundary name={name} resetKey={resetKey} fallback={(error, retry) => <SectionError name={name} error={error} retry={retry} />}>
      <Suspense fallback={<Loading />}>
        <Content roomId={roomId} />
      </Suspense>
    </ErrorBoundary>
  );
}
