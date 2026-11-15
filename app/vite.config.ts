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

export default defineConfig({
  root: here("."),
  plugins: [react(), uiAssetsPlugin()],
  resolve: {
    alias: [
      { find: /^@openwork\/kit$/, replacement: here("../packages/kit/mod.ts") },
      { find: /^@openwork\/ui$/, replacement: here("../packages/ui/mod.ts") },
      { find: /^@openwork\/ui\/css$/, replacement: here("../packages/ui/css/index.css") },
      { find: /^@openwork\/store$/, replacement: here("../packages/store/mod.ts") },
      { find: /^@openwork\/shell\/app$/, replacement: here("../packages/shell/createApp.tsx") },
      { find: /^@openwork\/shell$/, replacement: here("../packages/shell/mod.ts") },
    ],
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
