import pg from "pg";
const { Pool } = pg;
const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!connectionString) { console.error("Defina DATABASE_PUBLIC_URL ou DATABASE_URL."); process.exit(1); }
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000, application_name: "saborflow-metrics-cli" });
try {
  const size = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size");
  const connections = await pool.query("SELECT count(*)::int total, count(*) FILTER (WHERE state='active')::int active, count(*) FILTER (WHERE state='idle')::int idle FROM pg_stat_activity WHERE datname=current_database()");
  const cache = await pool.query("SELECT CASE WHEN (blks_hit+blks_read)=0 THEN 100 ELSE round(100.0*blks_hit/(blks_hit+blks_read),2) END cache_hit_percent FROM pg_stat_database WHERE datname=current_database()");
  const longQueries = await pool.query("SELECT pid, now()-query_start duration, state, wait_event_type, wait_event, left(query,180) query FROM pg_stat_activity WHERE datname=current_database() AND state<>'idle' AND pid<>pg_backend_pid() AND query_start < now()-interval '2 seconds' ORDER BY query_start LIMIT 10");
  console.log(JSON.stringify({ timestamp:new Date().toISOString(), databaseSize:size.rows[0]?.database_size, connections:connections.rows[0], cache:cache.rows[0], longQueries:longQueries.rows }, null, 2));
} finally { await pool.end(); }
