/** What the clipboard gets: words alone, never a status. Answers whether the clipboard took them. */
export const copyText = (words: string): Promise<boolean> => navigator.clipboard.writeText(words).then(() => true, () => false);
