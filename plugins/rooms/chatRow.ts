import { copy } from "./copy.ts";

/** One line of what was said, with "You: " in front when it was you. */
export const previewOf = (
  text: string | undefined,
  fromMe: boolean,
): string => {
  const line = (text ?? "").replace(/\s+/g, " ").trim();
  if (!line) return "";
  return fromMe ? `${copy.youPrefix}${line}` : line;
};
