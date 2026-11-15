import { assertEquals } from "@std/assert";
import { satisfies } from "./semver.ts";

Deno.test("caret ranges follow semver", () => {
  const table: [string, string, boolean][] = [
    ["1.2.3", "^1", true],
    ["1.9.0", "^1.2", true],
    ["2.0.0", "^1", false],
    ["1.2.2", "^1.2.3", false],
    ["0.2.5", "^0.2.3", true],
    ["0.3.0", "^0.2.3", false],
    ["0.0.3", "^0.0.3", true],
    ["0.0.4", "^0.0.3", false],
    ["0.9.0", "^0", true],
    ["1.0.0", "^0", false],
    ["3.1.0", "*", true],
    ["1.0.0", "1.0.0", true],
    ["1.0.1", "1.0.0", false],
    ["nonsense", "^1", false],
  ];
  for (const [version, range, expected] of table) assertEquals(satisfies(version, range), expected, `${version} ${range}`);
});
