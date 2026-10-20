// `bun run dev`: the API server (restarts on change) + Vite (HMR) together.
// Open http://localhost:5173 — Vite proxies /api, /select and /open to the server.
// Extra args go to the server, e.g. `bun run dev -- --root ~/work/my-run`.
//
// `--host <ip>` (or env AIDLC_DEV_HOST) is taken by Vite, not the server: `--host 0.0.0.0`
// opens the UI on every interface (http://<machine-ip>:5173). The API stays on loopback
// and is reached only through Vite's proxy; Vite's own Host check (IPs and localhost
// only, never a name) is what keeps DNS rebinding out. NO AUTHENTICATION — anyone who
// can reach that address sees the dashboard and the folder picker.

import { spawn } from "node:child_process";
import * as path from "node:path";

const ROOT = path.join(import.meta.dir, "..");
// 4329, not the production default 4321, so dev never collides with a running dashboard.
const PORT = process.env.AIDLC_DEV_API_PORT ?? "4329";
const args = process.argv.slice(2);
const hostAt = args.indexOf("--host");
const host = hostAt >= 0 ? args[hostAt + 1] : (process.env.AIDLC_DEV_HOST ?? "127.0.0.1");
if (hostAt >= 0) {
  if (!host || host.startsWith("--")) {
    console.error("--host needs a value, e.g. --host 0.0.0.0");
    process.exit(2);
  }
  args.splice(hostAt, 2);
}
if (host !== "127.0.0.1" && host !== "localhost") {
  console.warn(
    `[dev] UI exposed on ${host}:5173 — no authentication; anyone who can reach it sees the dashboard and the folder picker`,
  );
}

const server = spawn("bun", ["--watch", "server/server.ts", "--port", PORT, ...args], {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    AIDLC_DASHBOARD_LAUNCH_DIR: process.env.AIDLC_DASHBOARD_LAUNCH_DIR ?? process.cwd(),
  },
});
const web = spawn("bun", ["run", "dev", "--host", host], {
  cwd: path.join(ROOT, "web"),
  stdio: "inherit",
  env: { ...process.env, AIDLC_API: `http://127.0.0.1:${PORT}` },
});

const stop = () => {
  server.kill("SIGTERM");
  web.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => code && code !== 0 && stop());
web.on("exit", (code) => code && code !== 0 && stop());
