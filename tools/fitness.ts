export interface Violation {
  rule: string;
  file: string;
  message: string;
}

const SCANNED_ROOTS = ["packages", "plugins", "libs", "app", "server/crates"];
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "target", ".git"]);
const MAX_LINES = 300;
const LIFTED_DATA = ["packages/ui/theme/"];
const OWN_COLOURS = ["packages/ui/theme/", "packages/ui/identicon.ts"];

const SOURCE = /\.(ts|tsx)$/;
const CODE = /\.(ts|tsx|css|rs)$/;
const TEST = /\.test\.(ts|tsx)$/;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PIXELS = /\b\d+(?:\.\d+)?px\b/;
const FORBIDDEN = [
  /\bstd\.openwork\.africa\b/,
  /\bservices\.openwork\.africa\b/,
  /@worklyn\//,
  /\bworklyn\.(com|me|africa)\b/i,
];

function walk(directory: string, files: string[] = []): string[] {
  let entries: Deno.DirEntry[];
  try {
    entries = [...Deno.readDirSync(directory)];
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory) walk(path, files);
    else files.push(path);
  }
  return files;
}

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`\\])\/\/.*$/gm, "$1");

const startsWithAny = (path: string, prefixes: string[]): boolean => prefixes.some((prefix) => path.startsWith(prefix));

function importsOf(text: string): string[] {
  return [...text.matchAll(IMPORT)].map((match) => match[1]);
}

function pluginOf(path: string): string | null {
  return path.match(/^plugins\/([^/]+)\//)?.[1] ?? null;
}

function pluginTarget(specifier: string, from: string): { name: string; subpath: string } | null {
  const packaged = specifier.match(/^@openwork\/plugin-([^/]+)\/?(.*)$/);
  if (packaged) return { name: packaged[1], subpath: packaged[2] };
  if (!specifier.startsWith(".")) return null;
  const resolved: string[] = [];
  for (const part of [...from.split("/").slice(0, -1), ...specifier.split("/")]) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  if (resolved[0] !== "plugins" || resolved.length < 3) return null;
  return { name: resolved[1], subpath: resolved.slice(2).join("/") };
}

function declaresRequires(root: string, files: string[], plugin: string, required: string): boolean {
  const pattern = new RegExp(`requires\\s*:\\s*\\{[^}]*["']?${required}["']?\\s*:`);
  return files.some((file) => file.startsWith(`plugins/${plugin}/`) && SOURCE.test(file) && pattern.test(Deno.readTextFileSync(`${root}/${file}`)));
}

function frameImports(file: string, text: string): Violation[] {
  return importsOf(text)
    .filter((specifier) =>
      /(^|\/)plugins\//.test(specifier) || /^@openwork\/(plugin-|app)/.test(specifier) || /(^|\/)app\//.test(specifier) || /openwork\.africa/.test(specifier)
    )
    .map((specifier) => ({ rule: "frame-imports", file, message: `a package must not import "${specifier}"` }));
}

function pluginImports(root: string, files: string[], file: string, text: string): Violation[] {
  const own = pluginOf(file);
  if (!own) return [];
  const found: Violation[] = [];
  for (const specifier of importsOf(text)) {
    const target = pluginTarget(specifier, file);
    if (!target || target.name === own) continue;
    const allowed = /^(slots|services)(\.ts)?$/.test(target.subpath) && declaresRequires(root, files, own, target.name);
    if (!allowed) {
      found.push({
        rule: "plugin-imports",
        file,
        message: `plugin "${own}" must not import "${specifier}" (only slots.ts or services.ts, and only with requires)`,
      });
    }
  }
  return found;
}

function contentRules(file: string, text: string): Violation[] {
  const found: Violation[] = [];
  const lines = text.split("\n").length;
  if (CODE.test(file) && lines > MAX_LINES && !startsWithAny(file, LIFTED_DATA)) {
    found.push({ rule: "file-length", file, message: `${lines} lines, the limit is ${MAX_LINES}` });
  }
  if (!SOURCE.test(file) || TEST.test(file)) return found;
  const code = stripComments(text);
  if (/\.tsx$/.test(file) && /<(div|span)\b/.test(code)) found.push({ rule: "no-raw-layout", file, message: "raw <div> or <span>: use an Astryx component" });
  if (!startsWithAny(file, OWN_COLOURS) && HEX.test(code)) found.push({ rule: "no-hex", file, message: "hex colour: use a token" });
  if (!startsWithAny(file, LIFTED_DATA) && PIXELS.test(code)) found.push({ rule: "no-px", file, message: "px value: use a token" });
  return found;
}

function forbiddenReferences(file: string, text: string): Violation[] {
  const hit = FORBIDDEN.find((pattern) => pattern.test(text));
  return hit ? [{ rule: "no-closed-references", file, message: `names a closed or hosted product (${hit.source})` }] : [];
}

function manifestRules(root: string, files: string[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files.filter((path) => /^(packages|plugins|libs)\/[^/]+\/deno\.json$|^app\/deno\.json$/.test(path))) {
    const manifest = JSON.parse(Deno.readTextFileSync(`${root}/${file}`));
    for (const key of ["name", "version", "exports"]) {
      if (manifest[key] === undefined) found.push({ rule: "manifest", file, message: `missing "${key}"` });
    }
  }
  return found;
}

const TEXT = /\.(ts|tsx|css|rs|json|yml|yaml)$/;

export function checkFitness(root: string): Violation[] {
  const files = SCANNED_ROOTS.flatMap((name) => walk(`${root}/${name}`)).map((path) => path.slice(root.length + 1));
  const found: Violation[] = [];
  for (const file of files.filter((path) => TEXT.test(path))) {
    const text = Deno.readTextFileSync(`${root}/${file}`);
    found.push(...forbiddenReferences(file, text), ...contentRules(file, text));
    if (SOURCE.test(file)) {
      if (file.startsWith("packages/")) found.push(...frameImports(file, text));
      found.push(...pluginImports(root, files, file, text));
    }
  }
  return [...found, ...manifestRules(root, files)];
}
