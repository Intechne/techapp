// Deletes the calling user's account. The decision logic (and its tests) live in handler.ts.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, json } from '../_shared/http.ts';
import { deleteAccount } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' });
  const requestId = crypto.randomUUID();
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const result = await deleteAccount({
    authenticate: async (authorization) => {
      const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
      return (await asUser.auth.getUser()).data.user?.id ?? null;
    },
    audit: async (action, userId) => {
      await admin.from('audit_events').insert({ actor_id: action === 'account.deleted' ? null : userId, actor_kind: action === 'account.deleted' ? 'service' : 'user', action, target_type: 'user', target_id: userId });
    },
    removeFiles: async (userId) => {
      for (const bucket of ['evidence', 'avatars']) {
        const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
        if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      }
    },
    deleteUser: async (userId) => ({ error: (await admin.auth.admin.deleteUser(userId)).error }),
    hasModerationHistory: async (userId) =>
      ((await admin.from('moderation_actions').select('id', { count: 'exact', head: true }).eq('moderator_id', userId)).count ?? 0) > 0,
    log: console.error,
  }, req.headers.get('Authorization') ?? '', requestId);
  return json(result.status, result.body);
});
