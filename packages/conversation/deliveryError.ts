import { copy } from "./copy.ts";

/** What a person reads for a message that could not be delivered: the server's own plain words, or one that explains a bare failure. */
export function friendlyDeliveryError(why?: string): string {
  if (!why?.trim()) return copy.notDeliveredTryAgain;
  if (/401|unauthori[sz]ed|signed.?out|sign.?in|session.*expir/i.test(why)) return copy.signInAgain;
  if (/reach|unavailable|fetch|network|502|503|504/i.test(why)) return copy.unreachable;
  return why;
}
