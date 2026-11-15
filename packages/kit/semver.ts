type Triple = readonly [number, number, number];

function parse(text: string): { parts: number[] } | null {
  const core = text.trim().replace(/^v/, "").split(/[-+]/)[0];
  if (!/^\d+(\.\d+){0,2}$/.test(core)) return null;
  return { parts: core.split(".").map(Number) };
}

const pad = (parts: number[]): Triple => [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];

function compare(left: Triple, right: Triple): number {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

/** The first version a caret range leaves: ^1.2.3 stops at 2.0.0, ^0.2.3 at 0.3.0, ^0.0.3 at 0.0.4. */
function ceiling(parts: number[]): Triple {
  const [major, minor, patch] = pad(parts);
  if (major > 0 || parts.length === 1) return [major + 1, 0, 0];
  if (minor > 0 || parts.length === 2) return [0, minor + 1, 0];
  return [0, 0, patch + 1];
}

/** Whether `version` satisfies `range`: a caret range (^1, ^1.2, ^1.2.3), `*`, or an exact version. */
export function satisfies(version: string, range: string): boolean {
  const have = parse(version);
  if (!have) return false;
  const wanted = range.trim();
  if (wanted === "*" || wanted === "") return true;
  const base = parse(wanted.replace(/^[\^=]/, ""));
  if (!base) return false;
  const actual = pad(have.parts);
  if (!wanted.startsWith("^")) return compare(actual, pad(base.parts)) === 0;
  return compare(actual, pad(base.parts)) >= 0 && compare(actual, ceiling(base.parts)) < 0;
}
