// Guardian consent e-mail — the logic, independent of the runtime. index.ts wires it to supabase-js + Resend on Deno;
// the database tests and the Docker-free dev gateway wire it to Postgres and a fake mailer. Erasable TS only.
export interface IssuedToken {
  throttled: boolean; code?: string; retry_after_seconds?: number;
  token?: string; guardian_email?: string; guardian_name?: string | null;
  participant_first_name?: string | null; event_title?: string | null; event_starts_at?: string | null;
}
export interface RpcFailure { code?: string; message?: string }
export interface Mail { to: string; subject: string; html: string; text: string }

export interface GuardianDispatchDeps {
  /** The caller's user id from their JWT, or null. */
  authenticate(authorization: string): Promise<string | null>;
  /** Ownership through the caller's own RLS-scoped view (never the service role). */
  ownsRequest(authorization: string, requestId: string): Promise<boolean>;
  /** Service role: public.issue_guardian_token (mints the token, enforces and audits every limit). */
  issueToken(requestId: string): Promise<{ data: IssuedToken | null; error: RpcFailure | null }>;
  sendMail(mail: Mail): Promise<{ ok: boolean; status: number }>;
  guardianPageUrl: string;
  log?: (...args: unknown[]) => void;
}

export interface HandlerResult { status: number; body: Record<string, unknown> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function rpcFailure(error: RpcFailure, requestId: string): HandlerResult {
  const status = /^PT(\d{3})$/.exec(error.code ?? '')?.[1];
  return {
    status: status ? Number(status) : 500,
    body: { code: status ? error.message : 'server_error', message: status ? error.message : 'server_error', retryable: !status || status === '429', requestId },
  };
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function guardianMail(issued: IssuedToken, guardianPageUrl: string): Mail {
  const link = `${guardianPageUrl}#${issued.token}`;
  const who = esc(issued.participant_first_name || 'Çocuğunuz');
  const when = issued.event_starts_at
    ? new Date(issued.event_starts_at).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' }) : '';
  const greeting = issued.guardian_name ? `Merhaba ${esc(issued.guardian_name)},` : 'Merhaba,';
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;color:#20241F">
  <div style="font-weight:800;font-size:20px"><span style="color:#4B46D6">T.</span> techapp</div>
  <h1 style="font-size:24px;line-height:1.2;margin:28px 0 12px">${who} bir etkinliğe katılmak istiyor</h1>
  <p style="color:#666D66;margin:0 0 20px">${greeting} 18 yaşından küçük katılımcılar için velinin onayı gerekiyor. Etkinliği inceleyip kararınızı tek adımda verebilirsiniz.</p>
  <div style="border:1px solid #E3E6DD;border-radius:16px;padding:16px 18px;margin-bottom:24px"><div style="font-weight:700">${esc(issued.event_title)}</div><div style="color:#666D66;font-size:14px">${esc(when)}</div></div>
  <a href="${link}" style="display:block;text-align:center;background:#4B46D6;color:#ffffff;text-decoration:none;font-weight:600;border-radius:14px;padding:16px 20px">Etkinliği incele ve karar ver</a>
  <p style="color:#666D66;font-size:13px;margin-top:24px">Bağlantı 72 saat geçerlidir ve tek kullanımlıktır. Bu isteği tanımıyorsanız hiçbir şey yapmanız gerekmez; onay verilmeden katılım kesinleşmez.</p>
  <p style="color:#9aa19a;font-size:12px">TechApp · Intechne</p></div>`;
  const text = `${greeting}\n\n${issued.participant_first_name || 'Çocuğunuz'} TechApp üzerinden "${issued.event_title ?? 'bir etkinlik'}" etkinliğine katılmak istiyor ve onayınıza ihtiyaç var.\n\nİncelemek ve karar vermek için: ${link}\n\nBağlantı 72 saat geçerlidir ve tek kullanımlıktır. Bu isteği tanımıyorsanız hiçbir şey yapmanız gerekmez.\n\nTechApp · Intechne`;
  return { to: issued.guardian_email ?? '', subject: `TechApp · ${issued.participant_first_name || 'Çocuğunuz'} için veli onayı`, html, text };
}

export async function guardianDispatch(deps: GuardianDispatchDeps, authorization: string, body: unknown, requestId: string): Promise<HandlerResult> {
  const userId = await deps.authenticate(authorization);
  if (!userId) return { status: 401, body: { code: 'auth_required', message: 'auth_required', retryable: false, requestId } };

  const requestIdParam = (body as { request_id?: unknown } | null)?.request_id;
  if (typeof requestIdParam !== 'string' || !UUID.test(requestIdParam) || !(await deps.ownsRequest(authorization, requestIdParam))) {
    return { status: 404, body: { code: 'guardian_request_not_found', message: 'guardian_request_not_found', retryable: false, requestId } };
  }

  const { data: issued, error } = await deps.issueToken(requestIdParam);
  if (error || !issued) return rpcFailure(error ?? {}, requestId);
  // Limits are enforced (and audited) in the database; a throttled call mints no token and sends nothing.
  if (issued.throttled) {
    return { status: 429, body: { code: issued.code, message: issued.code, retryable: true, retryAfterSeconds: issued.retry_after_seconds ?? 0, requestId } };
  }

  const mail = await deps.sendMail(guardianMail(issued, deps.guardianPageUrl));
  if (!mail.ok) {
    deps.log?.('guardian mail failed', requestId, mail.status); // no addresses or tokens in logs
    return { status: 502, body: { code: 'mail_delivery_failed', message: 'mail_delivery_failed', retryable: true, requestId } };
  }
  return { status: 200, body: { sent: true } };
}
