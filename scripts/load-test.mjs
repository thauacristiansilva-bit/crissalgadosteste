const target = process.env.LOAD_TEST_URL;
const durationSeconds = Number(process.env.LOAD_TEST_DURATION_SECONDS ?? "30");
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? "20");
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? "10000");
if (!target) { console.error("Defina LOAD_TEST_URL."); process.exit(1); }

const endAt = Date.now() + durationSeconds * 1000;
const latencies = [];
let requests = 0, success = 0, failed = 0, status4xx = 0, status5xx = 0;

function percentile(values, p) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a,b)=>a-b);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil((p/100)*ordered.length)-1))];
}

async function worker() {
  while (Date.now() < endAt) {
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target, { cache: "no-store", signal: controller.signal });
      requests++;
      if (response.ok) success++; else failed++;
      if (response.status >= 400 && response.status < 500) status4xx++;
      if (response.status >= 500) status5xx++;
      await response.arrayBuffer();
    } catch { requests++; failed++; }
    finally { clearTimeout(timer); latencies.push(performance.now() - start); }
  }
}

const startedAt = Date.now();
await Promise.all(Array.from({length: concurrency}, () => worker()));
const elapsedSeconds = (Date.now() - startedAt) / 1000;
const errorRate = requests ? failed / requests * 100 : 100;
const result = {
  target, elapsedSeconds: Number(elapsedSeconds.toFixed(2)), concurrency, requests, success, failed,
  status4xx, status5xx, errorRatePercent: Number(errorRate.toFixed(2)),
  requestsPerSecond: Number((requests / elapsedSeconds).toFixed(2)),
  latencyMs: {
    p50: Number(percentile(latencies,50).toFixed(2)),
    p95: Number(percentile(latencies,95).toFixed(2)),
    p99: Number(percentile(latencies,99).toFixed(2)),
    max: Number(Math.max(...latencies,0).toFixed(2)),
  },
};
console.log(JSON.stringify(result, null, 2));
if (errorRate > Number(process.env.LOAD_TEST_MAX_ERROR_RATE ?? "1") ||
    result.latencyMs.p95 > Number(process.env.LOAD_TEST_MAX_P95_MS ?? "1000")) process.exitCode = 2;
