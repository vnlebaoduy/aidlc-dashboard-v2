import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: Vite serves the UI with HMR on :5173 and proxies the JSON API to the Bun server
// (`bun run dev` at the repo root starts both). Build: static files in web/dist, served
// by the Bun server in production.
const API = process.env.AIDLC_API ?? "http://127.0.0.1:4329";
const root = import.meta.dirname;

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // Types and pure helpers shared with the server (status, formatters, locale).
      "@server": path.resolve(root, "..", "server"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [path.resolve(root, "..")] },
    // `changeOrigin` rewrites Host to the loopback API, so the API's own Host guard passes
    // for a page opened by IP. The rebinding guard in dev is Vite's `allowedHosts` check,
    // which runs before the proxy and admits only localhost and literal IPs. The Origin /
    // Sec-Fetch-Site headers are forwarded untouched, so the API's cross-site guard on
    // /select, /open and /api/refresh still applies.
    proxy: {
      "/api": { target: API, changeOrigin: true },
      "/select": { target: API, changeOrigin: true },
      "/open": { target: API, changeOrigin: true },
      "/healthz": { target: API, changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 700 },
});
