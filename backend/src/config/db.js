import 'dotenv/config';
import pg from 'pg';
// One shared pool per backend process; no connections are opened until a query is requested.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});
pool.on('error', () => console.error('Unexpected idle database connection error'));
export default pool;
