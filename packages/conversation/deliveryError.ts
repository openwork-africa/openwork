import { copy } from "./copy.ts";

/** A fixed, actionable explanation for a message that could not be delivered. */
export function friendlyDeliveryError(why?: string): string {
  if (!why?.trim()) return copy.notDeliveredTryAgain;
  if (/401|unauthori[sz]ed|signed.?out|sign.?in|session.*expir/i.test(why)) return copy.signInAgain;
  if (/reach|unavailable|fetch|network|502|503|504/i.test(why)) return copy.unreachable;
  return copy.notDeliveredTryAgain;
}
