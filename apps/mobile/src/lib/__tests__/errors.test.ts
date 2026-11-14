import { SIGNUP_CLOSED_HOOK_PREFIX, makeError, toAppError } from '../errors';

describe('toAppError', () => {
  it('maps RPC PTxxx errors to status + machine code + Turkish copy', () => {
    const e = toAppError({ code: 'PT409', message: 'event_full' });
    expect(e).toMatchObject({ code: 'event_full', status: 409, retryable: false });
    expect(e.message).toMatch(/Kontenjan/);
  });
  it('hard caps (*_limit) are never retryable, even though they arrive as 429; a rate limit still is', () => {
    for (const code of ['team_project_limit', 'team_create_limit', 'guardian_send_limit']) {
      expect(toAppError({ code: 'PT429', message: code })).toMatchObject({ code, status: 429, retryable: false });
    }
    expect(toAppError({ code: 'PT429', message: 'rate_limited' })).toMatchObject({ code: 'rate_limited', retryable: true });
  });
  it('short_code_rate_limited (a cool-down, not a cap) stays retryable', () => {
    expect(toAppError({ code: 'PT429', message: 'short_code_rate_limited' })).toMatchObject({ code: 'short_code_rate_limited', status: 429, retryable: true });
  });
  it('distinguishes the account age rule (422) from an event age rule (403)', () => {
    expect(toAppError({ code: 'PT422', message: 'below_min_age' }).message).toMatch(/13 yaş/);
    expect(toAppError({ code: 'PT403', message: 'below_min_age' }).message).toMatch(/yaş grubuna/);
  });
  it('treats network failures as retryable and never as success', () => {
    for (const message of ['Network request failed', 'Failed to fetch', 'fetch failed']) {
      expect(toAppError(new TypeError(message))).toMatchObject({ code: 'network_unreachable', retryable: true, status: 0 });
    }
  });
  it('separates 401/403/404/429/5xx', () => {
    expect(toAppError({ code: 'PT401', message: 'auth_required' }).status).toBe(401);
    expect(toAppError({ code: '42501', message: 'permission denied' })).toMatchObject({ code: 'forbidden', status: 403 });
    expect(toAppError({ code: 'PGRST116', message: 'no rows' })).toMatchObject({ code: 'not_found', status: 404 });
    expect(toAppError({ code: 'over_email_send_rate_limit', message: 'x' })).toMatchObject({ code: 'rate_limited', retryable: true });
    expect(toAppError({ status: 503, message: 'upstream' })).toMatchObject({ code: 'server_error', retryable: true });
  });
  it('never leaks raw backend messages for unknown codes', () => {
    const e = toAppError({ code: 'PT409', message: 'some_new_internal_code: SELECT * FROM secrets' });
    expect(e.message).not.toMatch(/SELECT/);
  });
  it('maps expired OTP', () => expect(toAppError({ code: 'otp_expired', message: 'Token has expired or is invalid' }).code).toBe('otp_expired'));
  it('maps an invalid OTP without a code', () => expect(toAppError({ message: 'Token has expired or is invalid' }).code).toBe('otp_invalid'));
});

describe('error detail (per-member ids)', () => {
  it('keeps the PostgREST details string of a PTxxx error on the AppError, never in the message', () => {
    const e = toAppError({ code: 'PT409', message: 'member_already_registered', details: '["11111111-1111-4111-8111-111111111111"]' });
    expect(e.code).toBe('member_already_registered');
    expect(e.detail).toBe('["11111111-1111-4111-8111-111111111111"]');
    expect(e.message).not.toContain('1111');
  });
  it('an error without details has no detail key', () => {
    expect('detail' in toAppError({ code: 'PT409', message: 'roster_changed', details: null })).toBe(false);
  });
  it('maps the Before User Created hook rejection (closed sign-up) to signup_closed, whatever Auth puts in error_code', () => {
    const msg = 'Kayıtlar henüz açık değil. Pilot ekibindeysen bize yaz: techapp.intechne.com.tr/destek';
    for (const raw of [{ message: msg, status: 403, code: 'hook_rejected' }, { message: msg, status: 403 }, { message: msg, status: 400, code: 'unexpected_failure' }]) {
      const e = toAppError(raw);
      expect([e.code, e.status, e.retryable]).toEqual(['signup_closed', 403, false]);
      expect(e.message).toBe(msg);
    }
  });
  it('the hook message in the migration is exactly the signup_closed sentence (change both together)', () => {
    const { readFileSync, readdirSync } = jest.requireActual<typeof import('fs')>('fs');
    const { join } = jest.requireActual<typeof import('path')>('path');
    const dir = join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations');
    const sql = readFileSync(join(dir, readdirSync(dir).find((f) => f.endsWith('_policy_versions_signup_gate.sql'))!), 'utf8');
    const hookMessage = /'message', '([^']+)'/.exec(sql.slice(sql.indexOf('function public.hook_before_user_created')))?.[1];
    expect(hookMessage).toBe(makeError('signup_closed', 403).message);
    expect(hookMessage!.startsWith(SIGNUP_CLOSED_HOOK_PREFIX)).toBe(true);
  });
});
