// Sends (or re-sends) the guardian consent e-mail for a request owned by the calling user.
// The single-use token is minted here with the service role and goes ONLY into the e-mail: never back to the app.
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (platform-provided),
//                   RESEND_API_KEY, GUARDIAN_PAGE_URL, MAIL_FROM   (see docs/GUARDIAN-CONSENT.md)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, json, rpcError } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const requestId = crypto.randomUUID();
  const authorization = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;

  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return json(401, { code: 'auth_required', message: 'auth_required', retryable: false, requestId });

  const { request_id } = await req.json().catch(() => ({}));
  // Ownership check through the caller's own RLS-scoped view.
  const { data: own } = await asUser.from('my_guardian_requests').select('id').eq('id', request_id ?? '').maybeSingle();
  if (!own) return json(404, { code: 'guardian_request_not_found', message: 'guardian_request_not_found', retryable: false, requestId });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: issued, error } = await admin.rpc('issue_guardian_token', { p_request_id: request_id });
  if (error) return rpcError(error, requestId);

  const link = `${Deno.env.get('GUARDIAN_PAGE_URL')}#${issued.token}`;
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
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
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('MAIL_FROM'), to: issued.guardian_email, subject: `TechApp · ${issued.participant_first_name || 'Çocuğunuz'} için veli onayı`, html, text }),
  });
  if (!mail.ok) {
    console.error('guardian mail failed', requestId, mail.status); // no addresses or tokens in logs
    return json(502, { code: 'mail_delivery_failed', message: 'mail_delivery_failed', retryable: true, requestId });
  }
  return json(200, { sent: true });
});
