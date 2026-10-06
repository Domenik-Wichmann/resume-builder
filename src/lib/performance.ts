import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

type Span = { name: string; ms: number };
const timings = new AsyncLocalStorage<Span[]>();

// Callers supply fixed code labels only: no recruiter text, IDs or provider data.
export async function measure<T>(
  name: string,
  call: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await call();
  } finally {
    timings.getStore()?.push({ name, ms: performance.now() - start });
  }
}

export async function timedResponse(call: () => Promise<Response>) {
  return timings.run([], async () => {
    const response = await measure("total", call);
    const grouped = new Map<string, number>();
    for (const span of timings.getStore() || []) {
      if (!/^[a-z][a-z0-9_]*$/.test(span.name)) continue;
      grouped.set(span.name, (grouped.get(span.name) || 0) + span.ms);
    }
    response.headers.set(
      "Server-Timing",
      [...grouped]
        .map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`)
        .join(", "),
    );
    return response;
  });
}
