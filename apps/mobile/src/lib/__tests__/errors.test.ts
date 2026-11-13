import { toAppError } from '../errors';

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
