import { createContext, type ReactElement, type ReactNode, useContext } from "react";
import { Link } from "@astryxdesign/core/Link";
import { Markdown as AstryxMarkdown, type MarkdownInlinePlugin } from "@astryxdesign/core/Markdown";
import { bareLinkPattern, hrefOf } from "./links.ts";

// Whether what is being drawn is already the words of a link: a site named there is not made a link of its own.
const InLink = createContext(false);

// Links in a message open in a new tab rather than navigating away from the conversation. Astryx already refuses
// unsafe destinations (`javascript:`, `data:`), so nothing needs sanitizing here.
function MessageLink({ href, children }: { href: string; children: ReactNode }): ReactElement {
  return (
    <InLink.Provider value>
      <Link href={href} target="_blank" type="inherit" hasUnderline onClick={(event) => (event.preventDefault(), globalThis.open(href, "_blank", "noopener,noreferrer"))}>{children}</Link>
    </InLink.Provider>
  );
}

function BareLink({ written }: { written: string }): ReactElement {
  return useContext(InLink) ? <>{written}</> : <MessageLink href={hrefOf(written)}>{written}</MessageLink>;
}

// A site written without its scheme ("example.com/notes") is a link too; GFM alone links only what starts with a scheme or "www.".
const BARE_LINKS: MarkdownInlinePlugin[] = [{ pattern: bareLinkPattern(), render: (match, key) => <BareLink key={key} written={match[0]} /> }];
const COMPONENTS = { link: MessageLink };

/**
 * Renders `children` with Astryx's Markdown: CommonMark plus GFM tables, task lists and strikethrough, straight to
 * components, never `dangerouslySetInnerHTML`. The defaults every message shares (compact rhythm, full bubble width,
 * bare URLs linked) are stated once, here.
 */
export function Markdown({ children }: { children: string }): ReactElement {
  return (
    <AstryxMarkdown density="compact" contentWidth="100%" autolink="gfm" inlinePlugins={BARE_LINKS} components={COMPONENTS} headingLevelStart={3}>
      {children}
    </AstryxMarkdown>
  );
}
