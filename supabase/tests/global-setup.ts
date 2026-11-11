import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

/**
 * Preferred port for the throwaway test Postgres. Not 54329: that is Keşif's local Postgres, and if it happened to be stopped
 * the tests would start on it and could be mistaken for (or block) the neighbour. Override with TECHAPP_TEST_PG_PORT.
 */
export const DEFAULT_PORT = 54339;
/** Ports of other local projects that the auto-fallback must never pick either. */
export const AVOID_PORTS: readonly number[] = [54329];

function tryListen(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(null));
    srv.listen(port, '127.0.0.1', () => {
      const bound = (srv.address() as { port: number }).port;
      srv.close(() => resolve(bound));
    });
  });
}

/** Returns `preferred` if it is free, otherwise an OS-assigned free port that is not in `avoid`. */
export async function freePort(preferred: number, avoid: readonly number[] = AVOID_PORTS): Promise<number> {
  if (!avoid.includes(preferred)) {
    const ok = await tryListen(preferred);
    if (ok !== null) return ok;
  }
  for (let i = 0; i < 10; i += 1) {
    const any = await tryListen(0);
    if (any !== null && !avoid.includes(any)) return any;
  }
  throw new Error('No free TCP port available for test Postgres');
}

const MIGRATIONS = join(__dirname, '..', 'migrations');

export default async function setup() {
  const PORT = process.env.TECHAPP_TEST_PG_PORT
    ? Number(process.env.TECHAPP_TEST_PG_PORT)
    : await freePort(DEFAULT_PORT);
  const dir = mkdtempSync(join(tmpdir(), 'techapp-pg-'));
  const server = new EmbeddedPostgres({
    databaseDir: dir, user: 'postgres', password: 'postgres', port: PORT, persistent: false,
    onLog: () => {}, onError: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase('techapp_test');

  const url = `postgres://postgres:postgres@127.0.0.1:${PORT}/techapp_test`;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(readFileSync(join(__dirname, 'supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await client.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  await client.end();
  process.env.TECHAPP_TEST_DB_URL = url;

  return async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
