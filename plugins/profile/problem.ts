/** User-facing profile failure copy; never expose storage or transport errors. */
export function problem(_error: unknown): string {
  return "That didn’t work. Check your connection and try again.";
}
