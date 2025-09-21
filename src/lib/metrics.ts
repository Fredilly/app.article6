const MAX_SAMPLES = 200;

type RouteMetrics = {
  count: number;
  durations: number[];
};

const metricsByRoute = new Map<string, RouteMetrics>();

function calculateP95(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.floor(0.95 * (sorted.length - 1)));
  return sorted[index];
}

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function recordMetric(route: string, durationMs: number, status: number, errorMessage?: string) {
  const metrics = metricsByRoute.get(route) ?? { count: 0, durations: [] };
  metrics.count += 1;
  metrics.durations.push(durationMs);
  if (metrics.durations.length > MAX_SAMPLES) {
    metrics.durations.shift();
  }

  metricsByRoute.set(route, metrics);

  const p95 = calculateP95(metrics.durations);
  const roundedP95 = roundTwoDecimals(p95);
  const roundedLatest = roundTwoDecimals(durationMs);

  const baseLog = `route=${route} count=${metrics.count} p95=${roundedP95}ms latest=${roundedLatest}ms status=${status}`;
  if (errorMessage) {
    console.warn(`[metrics] ${baseLog} error="${errorMessage}"`);
  } else {
    console.info(`[metrics] ${baseLog}`);
  }
}

export function withMetrics(
  route: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async function withMetricsWrapper(req: Request) {
    const start = process.hrtime.bigint();
    let status = 500;
    let errorMessage: string | undefined;

    try {
      const response = await handler(req);
      status = response.status ?? status;
      return response;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      recordMetric(route, durationMs, status, errorMessage);
    }
  };
}
