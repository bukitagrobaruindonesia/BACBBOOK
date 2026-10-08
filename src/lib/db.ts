import { Pool } from 'pg';

declare global {
  var _pgPool: Pool | undefined;
}

export const pool = global._pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  keepAlive: false,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});

if (process.env.NODE_ENV !== 'production') global._pgPool = pool;