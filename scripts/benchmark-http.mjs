// Public GETs or fictional demo POSTs only; never calls providers in live mode.
const base = process.env.PERF_BASE || "http://127.0.0.1:3124";
const mode = await fetch(`${base}/api/workspaces`).then((r) => r.json());
const publicOnly = process.argv.includes("--public-only");
if (mode.mode !== "demo" && !publicOnly)
  throw new Error("HTTP benchmark requires APP_MODE=demo");
const routes = [
  "/",
  "/explore",
  "/resume",
  "/workspace",
  "/projects",
  "/answers",
  "/api/career-catalog",
  "/api/workspaces",
  "/api/ask",
  "/api/match",
];
for (const path of routes) {
  const post = path === "/api/ask" || path === "/api/match";
  if (post && publicOnly) continue;
  for (let i = 0; i < 6; i++) {
    const start = performance.now();
    const response = await fetch(
      `${base}${path}`,
      post
        ? {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: new URL(base).origin,
            },
            body: JSON.stringify({
              input:
                "Synthetic benchmark: TypeScript and SQL software engineering experience",
            }),
          }
        : undefined,
    );
    const bytes = (await response.arrayBuffer()).byteLength;
    console.log(
      JSON.stringify({
        path,
        run: i + 1,
        status: response.status,
        ms: Math.round((performance.now() - start) * 10) / 10,
        bytes,
        timing: response.headers.get("server-timing"),
      }),
    );
    if (!response.ok)
      throw new Error(`Benchmark failed: ${path} (${response.status})`);
  }
}
