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
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM'), to: issued.guardian_email, subject: 'TechApp · Veli onayı isteği',
      text: `Merhaba${issued.guardian_name ? ' ' + issued.guardian_name : ''},\n\nÇocuğunuz TechApp üzerinden bir etkinliğe katılmak istiyor ve onayınıza ihtiyaç var.\nEtkinlik bilgilerini görmek ve kararınızı vermek için:\n\n${link}\n\nBağlantı 72 saat geçerlidir ve tek kullanımlıktır. Bu isteği tanımıyorsanız hiçbir şey yapmanız gerekmez.\n\nTechApp · Intechne`,
    }),
  });
  if (!mail.ok) {
    console.error('guardian mail failed', requestId, mail.status); // no addresses or tokens in logs
    return json(502, { code: 'mail_delivery_failed', message: 'mail_delivery_failed', retryable: true, requestId });
  }
  return json(200, { sent: true });
});
