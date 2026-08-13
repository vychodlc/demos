import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
await client.connect();
try {
  await client.query(await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8'));
  console.log('VELOTRACE database migrated');
} finally {
  await client.end();
}
