// How much of a long message shows before "Show more": a few lines, cut where a line or word ends.
export const SHOWN_CHARS = 600;
export const SHOWN_LINES = 10;

/** The start of a message too long to show whole, or null when it fits. Cut at the last line end, else word end, before the limit. */
export const trimmedOf = (text: string, chars: number = SHOWN_CHARS, lines: number = SHOWN_LINES): string | null => {
  const byLines = text.split("\n").slice(0, lines).join("\n");
  const start = byLines.slice(0, chars);
  if (start.length >= text.trimEnd().length) return null;
  const lineEnd = start.lastIndexOf("\n");
  const wordEnd = start.lastIndexOf(" ");
  const cut = lineEnd > chars / 2 ? lineEnd : wordEnd > chars / 2 ? wordEnd : start.length;
  return `${start.slice(0, cut).trimEnd()}…`;
};
