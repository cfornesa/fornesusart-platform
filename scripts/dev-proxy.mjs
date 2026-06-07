/**
 * Lightweight HTTP reverse-proxy for the Replit Canvas preview.
 * Forwards every request on PROXY_PORT → TARGET_PORT.
 *
 * Usage:
 *   TARGET_PORT=5000 PROXY_PORT=20925 node scripts/dev-proxy.mjs
 */

import http from "http";

const TARGET_PORT = Number(process.env.TARGET_PORT ?? 5000);
const PROXY_PORT = Number(process.env.PROXY_PORT ?? 20925);

const server = http.createServer((req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(options, (upRes) => {
    res.writeHead(upRes.statusCode ?? 502, upRes.headers);
    upRes.pipe(res, { end: true });
  });

  proxy.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502);
    }
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxy, { end: true });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[dev-proxy] port ${PROXY_PORT} already in use — another instance is running`);
  } else {
    console.error("[dev-proxy] server error:", err);
    process.exit(1);
  }
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`[dev-proxy] :${PROXY_PORT} → :${TARGET_PORT}`);
});
