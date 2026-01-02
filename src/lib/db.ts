/**
 * Database connection and query utilities
 */
import mysql from 'mysql2/promise';
import { DATABASE_URL } from './config';

let poolInstance: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
  if (!poolInstance) {
    poolInstance = mysql.createPool({
      uri: DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return poolInstance;
}

// Export pool as getDbPool for compatibility
export const pool = getDbPool();

export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  const dbPool = getDbPool();
  const [rows] = await dbPool.execute(sql, params);
  return rows as T;
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
