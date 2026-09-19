// Deletes the calling user's account. auth.users → profiles/registrations/consents cascade in the database.
// audit_events keep only ids and machine codes. Evidence files are removed from storage first.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const requestId = crypto.randomUUID();
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return json(401, { code: 'auth_required', message: 'auth_required', retryable: false, requestId });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  for (const bucket of ['evidence', 'avatars']) {
    const { data: files } = await admin.storage.from(bucket).list(auth.user.id, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${auth.user!.id}/${f.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) { console.error('delete-account failed', requestId, error.status); return json(500, { code: 'server_error', message: 'server_error', retryable: true, requestId }); }
  return json(200, { deleted: true });
});
