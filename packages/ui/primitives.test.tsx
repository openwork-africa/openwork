import { assert, assertEquals } from "@std/assert";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar, BrandLockup, BrandMark, EmptyCard, ErrorBoundary, Feedback, Loading } from "./mod.ts";
import { LOCKUP_MARK_PATH, LOCKUP_WORDMARK_PATHS, MARK_PATH } from "./brandPaths.ts";

const asset = (name: string) => Deno.readTextFileSync(new URL(`assets/${name}`, import.meta.url));
const pathsOf = (svg: string) => [...svg.matchAll(/ d="([^"]*)"/g)].map((match) => match[1]);

Deno.test("BrandMark is an svg image labelled Openwork, drawn in the text colour", () => {
  const html = renderToStaticMarkup(<BrandMark />);
  assert(html.startsWith("<svg"));
  assert(html.includes('role="img"') && html.includes('aria-label="Openwork"'));
  assert(html.includes('fill="currentColor"') && !html.includes("#"));
});

Deno.test("BrandLockup is the mark and the wordmark, labelled Openwork", () => {
  const html = renderToStaticMarkup(<BrandLockup />);
  assert(html.includes('role="img"') && html.includes('aria-label="Openwork"'));
  assertEquals(html.match(/<path /g)?.length, 9);
  assert(!html.includes("#"));
});

Deno.test("the drawn paths are the ones in the brand SVGs", () => {
  assertEquals(pathsOf(asset("mark.svg")), [MARK_PATH]);
  assertEquals(pathsOf(asset("lockup.svg")), [LOCKUP_MARK_PATH, ...LOCKUP_WORDMARK_PATHS]);
});

Deno.test("Loading shows the mark and a status", () => {
  const html = renderToStaticMarkup(<Loading />);
  assert(html.includes('role="status"') && html.includes('aria-label="Openwork"'));
});

Deno.test("EmptyCard shows its title, description and action", () => {
  const html = renderToStaticMarkup(<EmptyCard art="chat" title="Notes to self" description="Write here." action={<button type="button">New</button>} />);
  for (const text of ["Notes to self", "Write here.", "New", "/assets/empty/chat.png"]) assert(html.includes(text), text);
});

Deno.test("Avatar names itself with a picture drawn from the name", () => {
  const html = renderToStaticMarkup(<Avatar name="Amina" />);
  assert(html.includes("avatar-frame") && html.includes("data:image"));
  assert(renderToStaticMarkup(<Avatar name="Amina" onClick={() => {}} label="Open Amina" />).includes("Open Amina"));
});

Deno.test("Feedback lists its notices in order, with dismiss and action buttons", () => {
  const html = renderToStaticMarkup(
    <Feedback
      notices={[
        { id: "1", text: "Offline", status: "warning", action: { label: "Try again", run: () => {} } },
        { id: "2", text: "Saved", status: "success" },
      ]}
      onDismiss={() => {}}
    />,
  );
  assert(html.includes("notice-stack"));
  assert(html.indexOf("Offline") < html.indexOf("Saved"));
  assert(html.includes("Try again") && html.includes('aria-label="Dismiss"'));
  assertEquals(renderToStaticMarkup(<Feedback notices={[]} onDismiss={() => {}} />), "");
});

Deno.test("ErrorBoundary renders its children when nothing fails", () => {
  assertEquals(
    renderToStaticMarkup(
      <ErrorBoundary name="circle">
        <p>fine</p>
      </ErrorBoundary>,
    ),
    "<p>fine</p>",
  );
});
