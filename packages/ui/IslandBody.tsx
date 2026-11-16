import type { ReactElement, ReactNode } from "react";

/** Shared loading/empty/content branching for product islands. */
export function IslandBody({ isLoading, isEmpty, loading, empty, children }: {
  isLoading: boolean;
  isEmpty: boolean;
  loading: ReactNode;
  empty: ReactNode;
  children: ReactNode;
}): ReactElement {
  return <>{isLoading ? loading : isEmpty ? empty : children}</>;
}
