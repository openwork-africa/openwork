import { assertEquals } from "@std/assert";
import { renderToStaticMarkup } from "react-dom/server";
import { dismiss, getNotices, notify, useNotices } from "./mod.ts";
import { clearNotices } from "./testing.ts";

Deno.test("notify adds a notice with its status and dismiss removes it", () => {
  clearNotices();
  const id = notify("Saved", { status: "success", holdMs: 0 });
  assertEquals(getNotices().map((notice) => [notice.text, notice.status]), [["Saved", "success"]]);
  dismiss(id);
  assertEquals(getNotices(), []);
});

Deno.test("an action takes its notice away when it runs", () => {
  clearNotices();
  let ran = 0;
  notify("Offline", { status: "warning", action: { label: "Try again", run: () => ran++ } });
  const [notice] = getNotices();
  assertEquals(notice.action?.label, "Try again");
  notice.action?.run();
  assertEquals([ran, getNotices().length], [1, 0]);
});

Deno.test("warnings and errors stay, info goes by itself", async () => {
  clearNotices();
  notify("Heads up", { holdMs: 5 });
  notify("Broken", { status: "error" });
  assertEquals(getNotices().length, 2);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assertEquals(getNotices().map((notice) => notice.text), ["Broken"]);
  clearNotices();
});

Deno.test("useNotices reads the current notices", () => {
  clearNotices();
  notify("One", { holdMs: 0 });
  function List() {
    return <ul>{useNotices().map((notice) => <li key={notice.id}>{notice.text}</li>)}</ul>;
  }
  assertEquals(renderToStaticMarkup(<List />), "<ul><li>One</li></ul>");
  clearNotices();
});
