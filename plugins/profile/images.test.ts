import { assertEquals } from "@std/assert";
import { MemoryFileStore } from "@openwork/store";
import { backgroundOf, coverUrlOf, fileIdOf, refOf, resolveImage } from "./images.ts";

Deno.test("a file reference round-trips and anything else is not one", () => {
  assertEquals(fileIdOf(refOf("abc")), "abc");
  for (const other of [undefined, "", "white", "file:"]) assertEquals(fileIdOf(other), undefined);
});

Deno.test("the cover is the chosen base, else the current theme's, else the uploaded picture", () => {
  assertEquals(backgroundOf("white", "white"), "white");
  assertEquals(backgroundOf(undefined, "white"), "white");
  assertEquals(backgroundOf("midnight", "white"), "white");
  assertEquals(backgroundOf("not-a-base", "white"), "white");
  assertEquals(coverUrlOf("white", "white"), "/assets/covers/white.jpg");
  assertEquals(coverUrlOf(undefined, "white"), "/assets/covers/white.jpg");
  assertEquals(coverUrlOf("file:abc", "white"), "/assets/covers/white.jpg");
  assertEquals(coverUrlOf("file:abc", "white", "blob:x"), "blob:x");
  assertEquals(coverUrlOf("white", "white", "blob:x"), "/assets/covers/white.jpg");
});

Deno.test("an image stored on this device shows from its bytes, any other from the server", async () => {
  const files = new MemoryFileStore();
  await files.put("here", new Blob(["x"], { type: "image/png" }));
  const local = await resolveImage(files, "file:here");
  assertEquals(local?.url.startsWith("blob:"), true);
  local?.release();
  const remote = await resolveImage(files, "file:elsewhere");
  assertEquals(remote?.url, "/api/files/elsewhere");
  assertEquals(await resolveImage(files, "white"), undefined);
});
