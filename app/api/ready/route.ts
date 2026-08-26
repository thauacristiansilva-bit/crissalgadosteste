import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

declare global {
  // eslint-disable-next-line no-var
  var __saborflowHealthPool: Pool | undefined;
}

function getHealthPool() {
  if (!global.__saborflowHealthPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
    global.__saborflowHealthPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: Number(process.env.HEALTHCHECK_DB_TIMEOUT_MS ?? "3000"),
      application_name: "saborflow-healthcheck",
    });
  }
  return global.__saborflowHealthPool;
}

async function checkDatabase() {
  const start = Date.now();
  try {
    await getHealthPool().query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      detail: error instanceof Error ? error.message : "Erro desconhecido no PostgreSQL.",
    };
  }
}

async function checkMedia() {
  const start = Date.now();
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!baseUrl) return { ok: true, latencyMs: 0, detail: "R2_PUBLIC_BASE_URL não configurada; verificação ignorada." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.HEALTHCHECK_R2_TIMEOUT_MS ?? "3000"));
  try {
    const response = await fetch(baseUrl, { method: "HEAD", cache: "no-store", signal: controller.signal });
    return { ok: response.status < 500, latencyMs: Date.now() - start, detail: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - start, detail: error instanceof Error ? error.message : "Erro desconhecido no R2/CDN." };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [database, media] = await Promise.all([checkDatabase(), checkMedia()]);
  const ready = database.ok;
  const body = {
    ok: ready,
    service: "saborflow",
    status: ready ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks: { database, media },
    railway: {
      replicaId: process.env.RAILWAY_REPLICA_ID ?? null,
      region: process.env.RAILWAY_REPLICA_REGION ?? null,
      deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
    },
  };
  if (!ready) console.error("[SaborFlow][READY] Serviço não está pronto.", body);
  return NextResponse.json(body, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } });
}
