import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const TARGET_URL = String(__ENV.TARGET_URL || "https://appsaborflow.com.br")
  .trim()
  .replace(/\/+$/, "");

// Proteção deliberada: este pacote foi preparado somente para a infraestrutura
// do SaborFlow. Evita apontar o teste por engano para um domínio de terceiros.
const allowedTarget = /^https:\/\/([a-z0-9-]+\.)*appsaborflow\.com\.br(?::\d+)?$/i;
if (!allowedTarget.test(TARGET_URL)) {
  throw new Error(
    `TARGET_URL recusada por segurança: ${TARGET_URL}. Use apenas appsaborflow.com.br ou subdomínios.`,
  );
}

const LOAD_VUS = positiveInt(__ENV.LOAD_VUS, 25);
const LOAD_DURATION = String(__ENV.LOAD_DURATION || "2m").trim();
const THINK_MIN_MS = positiveInt(__ENV.THINK_MIN_MS, 500);
const THINK_MAX_MS = Math.max(
  THINK_MIN_MS,
  positiveInt(__ENV.THINK_MAX_MS, 1500),
);

export const options = {
  scenarios: {
    storefront_read_only: {
      executor: "constant-vus",
      vus: LOAD_VUS,
      duration: LOAD_DURATION,
      gracefulStop: "15s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    checks: ["rate>0.99"],
    saborflow_errors: ["rate<0.01"],
  },
  userAgent: "SaborFlow-LoadTest/Etapa9",
};

const errors = new Rate("saborflow_errors");
const requests = new Counter("saborflow_requests");
const ttfb = new Trend("saborflow_ttfb_ms", true);

function chooseReadOnlyPath() {
  const sample = Math.random();
  if (sample < 0.45) return "/cardapio";
  if (sample < 0.80) return "/";
  return "/pedir";
}

export default function () {
  const path = chooseReadOnlyPath();
  const response = http.get(`${TARGET_URL}${path}`, {
    redirects: 3,
    tags: { saborflow_page: path },
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Cache-Control": "no-cache",
    },
    timeout: "10s",
  });

  requests.add(1);
  ttfb.add(response.timings.waiting, { saborflow_page: path });

  const ok = check(response, {
    "HTTP 200": (r) => r.status === 200,
    "recebeu HTML": (r) =>
      String(r.headers["Content-Type"] || "").toLowerCase().includes("text/html"),
    "resposta menor que 10s": (r) => r.timings.duration < 10000,
  });

  errors.add(!ok);

  const thinkMs =
    THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS);
  sleep(thinkMs / 1000);
}

export function setup() {
  console.log("[SaborFlow LoadTest] TESTE SOMENTE LEITURA");
  console.log(`[SaborFlow LoadTest] Alvo: ${TARGET_URL}`);
  console.log(`[SaborFlow LoadTest] VUs: ${LOAD_VUS}`);
  console.log(`[SaborFlow LoadTest] Duracao: ${LOAD_DURATION}`);
  console.log("[SaborFlow LoadTest] Rotas: /, /cardapio, /pedir");

  const health = http.get(`${TARGET_URL}/api/health`, {
    timeout: "5s",
    tags: { saborflow_page: "preflight-health" },
  });

  if (health.status !== 200) {
    throw new Error(
      `Preflight falhou: /api/health respondeu HTTP ${health.status}. Teste cancelado.`,
    );
  }

  console.log("[SaborFlow LoadTest] Preflight /api/health OK. Iniciando carga...");
  return { startedAt: new Date().toISOString() };
}

export function teardown(data) {
  const health = http.get(`${TARGET_URL}/api/health`, {
    timeout: "5s",
    tags: { saborflow_page: "postflight-health" },
  });

  console.log(
    `[SaborFlow LoadTest] Finalizado. Health final HTTP ${health.status}. Inicio: ${data.startedAt}`,
  );
}
