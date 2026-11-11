import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { AVOID_PORTS, DEFAULT_PORT, freePort } from './global-setup';

const servers: Server[] = [];
const occupy = () => new Promise<number>((resolve) => {
  const srv = createServer();
  servers.push(srv);
  srv.listen(0, '127.0.0.1', () => resolve((srv.address() as { port: number }).port));
});
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r)))); });

describe('test Postgres port choice', () => {
  it('prefers a port no other local project uses, and never Keşif’s 54329', () => {
    expect(DEFAULT_PORT).toBe(54339);
    expect(AVOID_PORTS).toContain(54329);
    expect(AVOID_PORTS).not.toContain(DEFAULT_PORT);
  });
  it('falls back to another free port when the preferred one is taken', async () => {
    const taken = await occupy();
    const port = await freePort(taken);
    expect(port).not.toBe(taken);
    expect(port).toBeGreaterThan(0);
  });
  it('never picks an avoided port, even as the preferred one', async () => {
    const free = await freePort(0, []);
    expect(await freePort(free, [free])).not.toBe(free);
  });
});
