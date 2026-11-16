import { cpSync, existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const uiAssets = here("../packages/ui/assets");
const MIME: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };

/** The ui package's pictures, served at /assets while developing and copied into the build. */
const uiAssetsPlugin = (): Plugin => ({
  name: "openwork-ui-assets",
  configureServer: (server) =>
    void server.middlewares.use("/assets", (request, response, next) => {
      const file = normalize(join(uiAssets, decodeURIComponent((request.url ?? "").split("?")[0])));
      if (!file.startsWith(uiAssets) || !existsSync(file) || !extname(file)) return next();
      response.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
      response.end(readFileSync(file));
    }),
  writeBundle: (options) => cpSync(uiAssets, join(options.dir ?? here("./dist"), "assets"), { recursive: true }),
});

const SERVER = "http://127.0.0.1:47410";
const workspace = JSON.parse(readFileSync(here("../deno.json"), "utf8")) as { workspace: string[] };
const aliases = workspace.workspace.flatMap((member) => {
  const configPath = here(`../${member}/deno.json`);
  if (!existsSync(configPath)) return [];
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { name?: string; exports?: string | Record<string, string> };
  if (!config.name || !config.exports) return [];
  const exports = typeof config.exports === "string" ? { ".": config.exports } : config.exports;
  return Object.entries(exports).map(([key, target]) => ({
    find: key === "." ? config.name! : `${config.name}/${key.replace(/^\.\//, "")}`,
    replacement: here(`../${member}/${target}`),
  }));
}).sort((a, b) => b.find.length - a.find.length);

export default defineConfig({
  root: here("."),
  plugins: [react(), uiAssetsPlugin()],
  resolve: {
    alias: aliases,
  },
  server: {
    host: "127.0.0.1",
    port: 47411,
    strictPort: true,
    fs: { allow: [here("..")] },
    proxy: { "/api": SERVER, "/healthz": SERVER },
  },
  build: { outDir: here("./dist"), emptyOutDir: true },
});
