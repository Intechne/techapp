import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const PORT = Number(process.env.TECHAPP_TEST_PG_PORT ?? 54329);
const MIGRATIONS = join(__dirname, '..', 'migrations');

export default async function setup() {
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
