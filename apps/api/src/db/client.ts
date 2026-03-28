import { Pool, type PoolClient } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.databaseUrl.includes("supabase.com") ? 1 : 10,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
  ssl: env.databaseUrl.includes("supabase.com")
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

export async function withTransaction<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await handler(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
