import type { TrailMessage } from "@openwork/store";
import { copy } from "./copy.ts";

export const RUN_WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BubbleGroup = "first" | "middle" | "last" | undefined;

export const dayKeyOf = (createdAt: number): string => new Date(createdAt).toDateString();

export const dayLabelOf = (createdAt: number, now: Date = new Date()): string => {
  const date = new Date(createdAt);
  const daysAgo = Math.round((new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / DAY_MS);
  if (daysAgo === 0) return copy.today;
  if (daysAgo === 1) return copy.yesterday;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
};

export const timeFormatOf = (createdAt: number, now: number): "time" | "date_time" => (now - createdAt < DAY_MS ? "time" : "date_time");

const continues = (a?: TrailMessage, b?: TrailMessage): boolean => !!a && !!b && a.authorId === b.authorId && Math.abs(b.createdAt - a.createdAt) <= RUN_WINDOW_MS;

/** One speaker's messages in a row, close in time, read as one group: only its first and last bubble keep their outer corners. */
export function groupOf(items: readonly TrailMessage[], index: number): BubbleGroup {
  const [joinsPrevious, joinsNext] = [continues(items[index - 1], items[index]), continues(items[index], items[index + 1])];
  return joinsPrevious && joinsNext ? "middle" : joinsPrevious ? "last" : joinsNext ? "first" : undefined;
}
