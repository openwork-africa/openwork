import { useEffect, useState } from "react";
import type { Placed, RowModel, SlotContext, SourceValue } from "@openwork/kit";

type Source = SourceValue & Placed;

export type RowsBySource = Readonly<
  Record<string, readonly RowModel[] | undefined>
>;

/** What each source has said so far; a source that has not answered yet is `undefined`, which is loading, not empty. */
export function useSourceRows(
  sources: readonly Source[],
  ctx: SlotContext,
): RowsBySource {
  const [rows, setRows] = useState<RowsBySource>({});
  useEffect(() => {
    const stops = sources.map((source) => source.rows(ctx).subscribe((next) => setRows((known) => ({ ...known, [source.id]: next }))));
    return () => stops.forEach((stop) => stop());
  }, [sources, ctx]);
  return rows;
}

export const isLoading = (
  sources: readonly Source[],
  rows: RowsBySource,
): boolean => sources.some((source) => rows[source.id] === undefined);

/** Every source's rows as one list, most recent first; a row id a earlier source already listed is left out. */
export function mergeRows(
  sources: readonly Source[],
  rows: RowsBySource,
): RowModel[] {
  const merged = new Map<string, RowModel>();
  for (const source of sources) {
    for (const row of rows[source.id] ?? []) {
      if (!merged.has(row.id)) merged.set(row.id, row);
    }
  }
  return [...merged.values()].sort((a, b) => b.activityAt - a.activityAt);
}
