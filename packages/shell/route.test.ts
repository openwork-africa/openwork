import { assertEquals } from "@std/assert";
import { matchPath, parseRoute, pathOf, profilePath, roomPath } from "./route.ts";
import { createRouter } from "./router.ts";
import { memoryEnv } from "./testing.tsx";

const memory = (start: string) => {
  const env = memoryEnv(start);
  return { env, history: env.history, back: env.back };
};

Deno.test("paths parse to routes: home, a room, its profile, anything else", () => {
  assertEquals(parseRoute("/"), { name: "home" });
  assertEquals(parseRoute("/c/abc"), { name: "room", roomId: "abc" });
  assertEquals(parseRoute("/c/abc/"), { name: "room", roomId: "abc" });
  assertEquals(parseRoute("/c/abc/profile?tab=1"), { name: "profile", roomId: "abc" });
  assertEquals(parseRoute("/settings"), { name: "other", path: "/settings" });
  assertEquals(parseRoute("/c/a%20b"), { name: "room", roomId: "a b" });
});

Deno.test("a route's path parses back to the same route", () => {
  for (const route of [{ name: "home" }, { name: "room", roomId: "a b" }, { name: "profile", roomId: "x" }, { name: "other", path: "/settings" }] as const) {
    assertEquals(parseRoute(pathOf(route)), route);
  }
  assertEquals([roomPath("a"), profilePath("a")], ["/c/a", "/c/a/profile"]);
});

Deno.test("page patterns match with params", () => {
  assertEquals(matchPath("/settings", "/settings"), {});
  assertEquals(matchPath("/u/:name", "/u/amina"), { name: "amina" });
  assertEquals(matchPath("/u/:name", "/u"), null);
  assertEquals(matchPath("/settings", "/other"), null);
});

Deno.test("navigate pushes a history entry and tells listeners; back comes through the env", () => {
  const { env, history, back } = memory("/");
  const router = createRouter(env);
  const seen: string[] = [];
  const stop = router.subscribe(() => seen.push(router.path()));
  router.navigate("/c/a");
  router.navigate("/c/a");
  router.navigate("/c/a/profile");
  assertEquals([history, seen], [["/", "/c/a", "/c/a/profile"], ["/c/a", "/c/a", "/c/a/profile"]]);
  back();
  assertEquals(seen.at(-1), "/c/a");
  stop();
  router.navigate("/");
  assertEquals(seen.length, 4);
});
