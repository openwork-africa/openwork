import { type ComponentType, type ReactElement, type ReactNode, Suspense } from "react";
import { ErrorBoundary, SectionError } from "@openwork/ui";

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
  /** What shows while the region loads; nothing by default. */
  loading?: ReactNode;
}

/** One region of the frame as its own island: if it fails, it shows a note with Try again and the rest carries on. */
export function Island({ name, region: Content, roomId, resetKey, loading = null }: IslandProps): ReactElement {
  return (
    <ErrorBoundary name={name} resetKey={resetKey} fallback={(_error, retry) => <SectionError name={name} retry={retry} />}>
      <Suspense fallback={loading}>
        <Content roomId={roomId} />
      </Suspense>
    </ErrorBoundary>
  );
}
