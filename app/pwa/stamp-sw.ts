// After `vite build`: writes dist/sw.js from sw.template.js with this build's version and the list of files to
// precache (the shell, every script, style and picture), so an open tab never loses a lazy import to a deploy.
const dist = new URL("../dist/", import.meta.url);
const SKIPPED = [/\.map$/, /^sw\.js$/];
const PRECACHE_MAX_BYTES = 2 * 1024 * 1024;

async function* walk(directory: URL, prefix = ""): AsyncGenerator<{ path: string; size: number }> {
  for await (const entry of Deno.readDir(directory)) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory) yield* walk(new URL(`${entry.name}/`, directory), `${path}/`);
    else yield { path, size: (await Deno.stat(new URL(entry.name, directory))).size };
  }
}

const precache = ["/"];
for await (const { path, size } of walk(dist)) {
  if (SKIPPED.some((pattern) => pattern.test(path))) continue;
  if (size <= PRECACHE_MAX_BYTES) precache.push(path === "index.html" ? "/index.html" : `/${path}`);
}

const version = new Date().toISOString();
const template = await Deno.readTextFile(new URL("./sw.template.js", import.meta.url));
const stamped = template
  .replaceAll("__BUILD_VERSION__", version)
  .replace("__PRECACHE__", JSON.stringify(precache));
await Deno.writeTextFile(new URL("sw.js", dist), stamped);
console.log(`sw.js stamped version ${version}: ${precache.length} precached`);
