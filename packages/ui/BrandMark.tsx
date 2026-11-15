import type { ReactElement } from "react";
import { MARK_PATH } from "./brandPaths.ts";
import { copy } from "./copy.ts";

/** The Openwork mark wherever the app shows its own (the loader, empty states, the profile's footer), in the text colour. */
export function BrandMark(): ReactElement {
  return (
    <svg className="brand-mark" viewBox="0 0 496 496" role="img" aria-label={copy.brandLabel} xmlns="http://www.w3.org/2000/svg">
      <path d={MARK_PATH} fill="currentColor" fillRule="nonzero" />
    </svg>
  );
}
