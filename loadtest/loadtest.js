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

const rawBasePath = String(__ENV.STOREFRONT_BASE_PATH || "").trim();
const STOREFRONT_BASE_PATH = rawBasePath
  ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}`
  : "";

const allowedTarget = /^https:\/\/([a-z0-9-]+\.)*appsaborflow\.com\.br(?::\d+)?$/i;
if (!allowedTarget.test(TARGET_URL)) {
  throw new Error(
    `TARGET_URL recusada por seguranca: ${TARGET_URL}. Use apenas appsaborflow.com.br ou subdominios.`,
  );
}

if (STOREFRONT_BASE_PATH && !/^\/loja\/[a-z0-9-]+$/i.test(STOREFRONT_BASE_PATH)) {
  throw new Error(
    `STOREFRONT_BASE_PATH invalido: ${STOREFRONT_BASE_PATH}. Esperado: /loja/SEU-SLUG`,
  );
}

const LOAD_VUS = positiveInt(__ENV.LOAD_VUS, 25);
const LOAD_DURATION = String(__ENV.LOAD_DURATION || "2m").trim();
const THINK_MIN_MS = positiveInt(__ENV.THINK_MIN_MS, 500);
const THINK_MAX_MS = Math.max(
  THINK_MIN_MS,
  positiveInt(__ENV.THINK_MAX_MS, 1500),
);

const pages = [
  { name: "inicio", path: `${STOREFRONT_BASE_PATH}/` },
  { name: "cardapio", path: `${STOREFRONT_BASE_PATH}/cardapio` },
  { name: "pedir", path: `${STOREFRONT_BASE_PATH}/pedir` },
];

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
  userAgent: "SaborFlow-LoadTest/Etapa9-RotasCorrigidas",
};

const errors = new Rate("saborflow_errors");
const requests = new Counter("saborflow_requests");
const ttfb = new Trend("saborflow_ttfb_ms", true);

function choosePage() {
  const sample = Math.random();
  if (sample < 0.45) return pages[1];
  if (sample < 0.80) return pages[0];
  return pages[2];
}

function assertPage200(page) {
  const response = http.get(`${TARGET_URL}${page.path}`, {
    redirects: 3,
    timeout: "10s",
    tags: { saborflow_page: `preflight-${page.name}` },
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  if (response.status !== 200) {
    throw new Error(
      `Preflight falhou em ${page.path}: HTTP ${response.status}. Corrija STOREFRONT_BASE_PATH antes do teste.`,
    );
  }

  const contentType = String(response.headers["Content-Type"] || "").toLowerCase();
  if (!contentType.includes("text/html")) {
    throw new Error(
      `Preflight falhou em ${page.path}: resposta nao e HTML (${contentType || "sem Content-Type"}).`,
    );
  }
}

export default function () {
  const page = choosePage();
  const response = http.get(`${TARGET_URL}${page.path}`, {
    redirects: 3,
    tags: { saborflow_page: page.name },
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Cache-Control": "no-cache",
    },
    timeout: "10s",
  });

  requests.add(1, { saborflow_page: page.name });
  ttfb.add(response.timings.waiting, { saborflow_page: page.name });

  const ok = check(response, {
    "HTTP 200": (r) => r.status === 200,
    "recebeu HTML": (r) =>
      String(r.headers["Content-Type"] || "").toLowerCase().includes("text/html"),
    "resposta menor que 10s": (r) => r.timings.duration < 10000,
  }, { saborflow_page: page.name });

  errors.add(!ok, { saborflow_page: page.name });

  const thinkMs = THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS);
  sleep(thinkMs / 1000);
}

export function setup() {
  console.log("[SaborFlow LoadTest] TESTE SOMENTE LEITURA");
  console.log(`[SaborFlow LoadTest] Dominio: ${TARGET_URL}`);
  console.log(`[SaborFlow LoadTest] Base da loja: ${STOREFRONT_BASE_PATH || "/ (dominio proprio da loja)"}`);
  console.log(`[SaborFlow LoadTest] VUs: ${LOAD_VUS}`);
  console.log(`[SaborFlow LoadTest] Duracao: ${LOAD_DURATION}`);
  console.log(`[SaborFlow LoadTest] Rotas: ${pages.map((p) => p.path).join(", ")}`);

  const health = http.get(`${TARGET_URL}/api/health`, {
    timeout: "5s",
    tags: { saborflow_page: "preflight-health" },
  });

  if (health.status !== 200) {
    throw new Error(
      `Preflight falhou: /api/health respondeu HTTP ${health.status}. Teste cancelado.`,
    );
  }

  for (const page of pages) assertPage200(page);

  console.log("[SaborFlow LoadTest] Preflight OK: health + 3 paginas responderam HTTP 200.");
  console.log("[SaborFlow LoadTest] Iniciando carga...");
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
