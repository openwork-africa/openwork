import type { ReactElement } from "react";
import { LOCKUP_MARK_PATH, LOCKUP_VIEWBOX, LOCKUP_WORDMARK_OFFSET, LOCKUP_WORDMARK_PATHS } from "./brandPaths.ts";
import { copy } from "./copy.ts";

/** The Openwork mark with its wordmark beside it, in the text colour. */
export function BrandLockup(): ReactElement {
  return (
    <svg className="brand-lockup" viewBox={LOCKUP_VIEWBOX} role="img" aria-label={copy.brandLabel} xmlns="http://www.w3.org/2000/svg">
      <path d={LOCKUP_MARK_PATH} fill="currentColor" fillRule="nonzero" />
      <g transform={LOCKUP_WORDMARK_OFFSET}>
        {LOCKUP_WORDMARK_PATHS.map((path) => <path key={path} d={path} fill="currentColor" fillRule="nonzero" />)}
      </g>
    </svg>
  );
}
