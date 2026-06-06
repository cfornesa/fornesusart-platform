import { spawn } from "node:child_process";
import { loadRootEnv, root } from "./env.mjs";

loadRootEnv();

if (process.env.REPL_ID !== undefined) {
  // On Replit: the single-server "Start application" workflow already serves
  // everything on port 5000. Run a lightweight proxy so the microblog artifact
  // preview (port 20925) mirrors it without conflicting.
  process.env.TARGET_PORT = process.env.TARGET_PORT ?? "5000";
  process.env.PROXY_PORT = process.env.PROXY_PORT ?? "20925";
  await import("./dev-proxy.mjs");
} else {
  // Local dev: run the Vite dev server directly (hot-reload mode).
  const child = spawn(
    "npm",
    ["run", "dev:vite", "--workspace=@workspace/microblog"],
    { cwd: root, env: process.env, stdio: "inherit" },
  );
  child.on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}
