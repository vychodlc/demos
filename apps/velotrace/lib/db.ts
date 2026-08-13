import { Pool, type PoolClient, type QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var velotracePool: Pool | undefined;
}

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL 未配置');
  return value;
}

export const db = global.velotracePool || new Pool({
  connectionString: connectionString(),
  max: Number(process.env.DATABASE_POOL_SIZE || (process.env.VERCEL ? 2 : 10)),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

if (process.env.NODE_ENV !== 'production') global.velotracePool = db;

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return db.query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
