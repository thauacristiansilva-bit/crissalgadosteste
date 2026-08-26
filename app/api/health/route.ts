import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "saborflow",
      status: "alive",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "unknown",
      railway: {
        replicaId: process.env.RAILWAY_REPLICA_ID ?? null,
        region: process.env.RAILWAY_REPLICA_REGION ?? null,
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
