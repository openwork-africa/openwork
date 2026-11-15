import { assertEquals } from "@std/assert";
import { frameSlotIds, frameSlots } from "./mod.ts";

Deno.test("every frame-owned slot of the catalogue has a unique key", () => {
  const expected = [
    "shell.page", "shell.rail", "shell.shortcut", "shell.overlay",
    "circle.source", "circle.tab", "circle.rowMenu", "circle.empty",
    "address.addressee", "address.action",
    "composer.addMenu", "composer.tray", "composer.action", "composer.beforeSend",
    "trail.body", "trail.extra", "trail.action",
    "window.empty", "window.banner",
    "panel.tab", "panel.section", "settings.row",
  ];
  assertEquals(frameSlots.map((key) => key.id), expected);
  assertEquals(frameSlotIds.size, expected.length);
});
