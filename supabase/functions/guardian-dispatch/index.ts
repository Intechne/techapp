// Sends (or re-sends) the guardian consent e-mail for a request owned by the calling user.
// The single-use token is minted with the service role and goes ONLY into the e-mail: never back to the app.
// Every limit (cooldown, per request / user / recipient) is enforced and audited in public.issue_guardian_token.
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (platform-provided),
//                   RESEND_API_KEY, GUARDIAN_PAGE_URL, MAIL_FROM   (see docs/GUARDIAN-CONSENT.md)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, json } from '../_shared/http.ts';
import { guardianDispatch } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const userClient = (authorization: string) =>
  createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' });
  const requestId = crypto.randomUUID();
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const result = await guardianDispatch({
    authenticate: async (authorization) => (await userClient(authorization).auth.getUser()).data.user?.id ?? null,
    ownsRequest: async (authorization, id) =>
      !!(await userClient(authorization).from('my_guardian_requests').select('id').eq('id', id).maybeSingle()).data,
    issueToken: async (id) => {
      const { data, error } = await admin.rpc('issue_guardian_token', { p_request_id: id });
      return { data, error };
    },
    sendMail: async (mail) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: Deno.env.get('MAIL_FROM'), ...mail }),
      });
      return { ok: res.ok, status: res.status };
    },
    guardianPageUrl: Deno.env.get('GUARDIAN_PAGE_URL')!,
    log: console.error,
  }, req.headers.get('Authorization') ?? '', await req.json().catch(() => null), requestId);
  return json(result.status, result.body);
});
