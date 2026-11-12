import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { hasErrorCopy, makeError, toAppError } from '../errors';

// Every machine code the database can raise with app.fail(<status>, '<code>') needs a Turkish sentence in errors.ts COPY,
// otherwise the user sees a generic fallback and screens that branch on the code never match.
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

interface Raised { status: number; code: string; prefix: boolean }

/** Map key is `status:code`: the same code raised with two statuses must be reported twice, not overwritten. */
function collectRaised(sql: string, out: Map<string, Raised> = new Map()): Map<string, Raised> {
  for (const m of sql.matchAll(/app\.fail\(\s*(\d{3})\s*,\s*'([a-z0-9_]+)'(\s*\|\|)?/g)) {
    const prefix = m[3] !== undefined; // e.g. 'guardian_request_' || g.status
    out.set(`${m[1]}:${m[2]}${prefix ? '*' : ''}`, { status: Number(m[1]), code: m[2]!, prefix });
  }
  return out;
}
function raisedCodes(): Map<string, Raised> {
  const out = new Map<string, Raised>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) collectRaised(readFileSync(join(MIGRATIONS, file), 'utf8'), out);
  return out;
}
/** Allow-list / copy key of a raised code (prefix codes end in `*`). */
const copyKey = (r: Raised) => (r.prefix ? `${r.code}*` : r.code);
const byCopyKey = (raised: Map<string, Raised>, key: string) => [...raised.values()].filter((r) => copyKey(r) === key);

const LOCK = 'guards a server-owned column the app never writes; 403 falls back to the generic "yetkin yok" sentence';
const WEB = 'raised only by the anonymous guardian page RPCs; copy lives in apps/web/app/veli/GuardianConsent.tsx';
const ADMIN = 'raised only by organiser/platform RPCs the app never calls; copy lives in apps/admin/src/lib.ts';

/** Codes without an app sentence, on purpose. Keep it short; each reason is checked below where it can be. */
const ALLOWED: Record<string, string> = {
  cv_token_locked: LOCK, event_counters_locked: LOCK, event_field_locked: LOCK, event_tenant_locked: LOCK,
  experience_owner_locked: LOCK, field_locked: LOCK, task_team_locked: LOCK, team_counters_locked: LOCK,
  team_field_locked: LOCK, tenant_locked: LOCK, org_verification_forbidden: LOCK, cover_write_forbidden: LOCK,
  'guardian_request_*': WEB, guardian_request_expired: WEB, guardian_token_invalid: WEB, guardian_name_required: WEB,
  policy_version_mismatch: WEB,
  publish_requires_platform_approval: ADMIN, event_status_transition_invalid: ADMIN, review_forbidden: ADMIN,
  registration_not_pending_review: ADMIN, application_review_forbidden: ADMIN, application_transition_invalid: ADMIN,
  cannot_review_own_application: ADMIN, attestation_forbidden: ADMIN, attestation_decision_invalid: ADMIN,
  attestation_not_pending: ADMIN, attestation_not_verified: ADMIN, attestation_scope_required: ADMIN,
  self_attestation_forbidden: ADMIN, revoke_reason_required: ADMIN, volunteer_withdrawn: ADMIN,
};
const ELSEWHERE: Record<string, string> = { [WEB]: 'apps/web/app/veli/GuardianConsent.tsx', [ADMIN]: 'apps/admin/src/lib.ts' };

describe('error copy coverage', () => {
  const raised = raisedCodes();

  it('finds the database codes (sanity)', () => {
    expect(raised.size).toBeGreaterThan(100);
    expect(raised.get('403:team_members_only')).toEqual({ status: 403, code: 'team_members_only', prefix: false });
  });

  it('the same code raised with two different statuses is reported under both', () => {
    const out = collectRaised(`perform app.fail(403, 'dup_code'); perform app.fail(409, 'dup_code'); perform app.fail(404, 'pre_' || x);`);
    expect([...out.keys()].sort()).toEqual(['403:dup_code', '404:pre_*', '409:dup_code']);
  });

  it('every app.fail code has Turkish copy in errors.ts, or an allow-list reason', () => {
    const missing = [...new Set([...raised.values()].map(copyKey))].filter((key) => !hasErrorCopy(key) && !(key in ALLOWED)).sort();
    expect(missing).toEqual([]);
  });

  it('the allow-list stays honest: no stale entry, no entry that already has copy', () => {
    const stale = Object.keys(ALLOWED).filter((key) => byCopyKey(raised, key).length === 0 || hasErrorCopy(key));
    expect(stale).toEqual([]);
  });

  it('allow-listed lock codes are all 403 and fall back to the generic forbidden sentence', () => {
    for (const [key, reason] of Object.entries(ALLOWED)) {
      if (reason !== LOCK) continue;
      expect([key, byCopyKey(raised, key).map((r) => r.status)]).toEqual([key, byCopyKey(raised, key).map(() => 403)]);
      expect([key, makeError(key, 403).code]).toEqual([key, 'forbidden']);
    }
  });

  it('codes whose copy lives in another app really have copy there', () => {
    for (const [key, reason] of Object.entries(ALLOWED)) {
      const file = ELSEWHERE[reason];
      if (!file) continue;
      const source = readFileSync(join(ROOT, file), 'utf8');
      const needle = key.endsWith('*') ? key.slice(0, -1) : `${key}:`;
      expect([key, source.includes(needle)]).toEqual([key, true]);
    }
  });

  it('a code with copy survives toAppError, so screens can branch on it', () => {
    const fallback = makeError('unknown').message;
    for (const { status, code, prefix } of raised.values()) {
      if (prefix || !hasErrorCopy(code)) continue;
      const e = toAppError({ code: `PT${status}`, message: code });
      expect([code, e.code, e.status]).toEqual([code, code, status]);
      expect([code, e.message === fallback]).toEqual([code, false]);
    }
  });
});
