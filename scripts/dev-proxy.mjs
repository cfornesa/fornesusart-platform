import http from "node:http";
import { loadRootEnv } from "./env.mjs";

loadRootEnv();

const PROXY_PORT = Number(process.env.PROXY_PORT ?? "20925");
const TARGET_PORT = Number(process.env.TARGET_PORT ?? "5000");

async function waitForPort(port, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const req = http.request(
        { hostname: "localhost", port, path: "/api/healthz", method: "GET" },
        () => resolve(true),
      );
      req.on("error", () => resolve(false));
      req.end();
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for port ${port}`);
}

console.log(`dev-proxy: waiting for port ${TARGET_PORT}…`);
await waitForPort(TARGET_PORT);
console.log(`dev-proxy: port ${TARGET_PORT} ready, proxying from ${PROXY_PORT}`);

const server = http.createServer((req, res) => {
  const options = {
    hostname: "localhost",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${TARGET_PORT}` },
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxy.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });

  req.pipe(proxy, { end: true });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(
      `dev-proxy: port ${PROXY_PORT} already in use — another proxy instance is serving it`,
    );
    // Keep the process alive so the workflow stays healthy.
    setInterval(() => {}, 1 << 30);
  } else {
    throw err;
  }
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`dev-proxy: listening on port ${PROXY_PORT}`);
});
