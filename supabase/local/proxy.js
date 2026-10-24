// A tiny stand-in for Supabase's API gateway, for testing only: sends /auth/v1, /rest/v1 and
// /storage/v1 to the local containers from docker-compose.yml, and allows browser requests.
// Run: node supabase/local/proxy.js   (listens on http://localhost:54321)
const http = require("http");

const ROUTES = { "/auth/v1": 9999, "/rest/v1": 3000, "/storage/v1": 5000 };

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const prefix = Object.keys(ROUTES).find((p) => req.url.startsWith(p));
  if (!prefix) { res.writeHead(404); return res.end(); }
  const headers = { ...req.headers, host: "localhost" };
  if (prefix === "/storage/v1") headers["x-forwarded-prefix"] = "/storage/v1";
  const up = http.request({ host: "127.0.0.1", port: ROUTES[prefix], path: req.url.slice(prefix.length) || "/", method: req.method, headers }, (r) => {
    const out = { ...r.headers };
    delete out["access-control-allow-origin"];
    res.writeHead(r.statusCode, out);
    r.pipe(res);
  });
  up.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(up);
}).listen(54321, () => console.log("Local Supabase on http://localhost:54321"));
