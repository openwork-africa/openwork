import type { Message } from "@openwork/store";
import { copy } from "./copy.ts";

/** One line of what was said: the person's own words start with "You: ", anyone else's (the assistant's) are the words alone. */
export const previewOf = (message: Pick<Message, "authorId" | "content">): string => {
  const line = message.content.replace(/\s+/g, " ").trim();
  if (!line) return "";
  return message.authorId === "you" ? `${copy.youPrefix}${line}` : line;
};
