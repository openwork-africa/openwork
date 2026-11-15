// A site written the way people write one: "example.com/notes". Only endings people do write this way, so a file
// name (notes.md, index.ts) is not taken for a site; never part of a mail address or of a longer address.
const BARE = String.raw`(?<![\w@/.:-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|africa|co\.za|org\.za|co\.uk|co|io|dev|app|ai|me|tv|info|edu|gov|xyz)(?![a-z0-9-]|\.[a-z0-9])(?:[/?#][^\s<>]*[^\s<>.,!?:;)*_~'"])?`;
export const bareLinkPattern = (): RegExp => new RegExp(BARE, "gi");

/** Where text written as a site goes: itself when it names its scheme, else over https. */
export const hrefOf = (written: string): string => (/^https?:\/\//i.test(written) ? written : `https://${written}`);
