import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parsePayload, toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { EducationStage } from '../../lib/database.types';
import { accountStateKey, useSession } from '../auth/SessionProvider';
import { cvSchema, type Cv } from './cvSchema';
import type { ExperienceKind } from './labels';

export const myProfileKey = (userId: string | null) => ['profile', userId] as const;
export const myCvKey = (userId: string | null) => ['profile', userId, 'cv'] as const;
export const attestingOrgsKey = ['attesting-organizations'] as const;

/** The signed-in user's public profile. Single query shared by Profile and Discover so they can never disagree. */
export function useMyProfile() {
  const { userId } = useSession();
  return useQuery({
    queryKey: myProfileKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId!).single();
      if (error) throw toAppError(error);
      return data;
    },
  });
}

/** The whole CV in one server-built document: declared entries, their attestations, check-in based participations, teams. */
export function useMyCv() {
  const { userId } = useSession();
  return useQuery({
    queryKey: myCvKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Cv> => {
      const { data, error } = await getSupabase().rpc('my_cv');
      if (error) throw toAppError(error);
      return parsePayload(cvSchema, data);
    },
  });
}

/** Switching on always issues a new link; switching off kills the current one at once. The server refuses minors. */
export function useSetCvSharing() {
  const qc = useQueryClient(); const { userId } = useSession();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await getSupabase().rpc('set_cv_sharing', { p_enabled: enabled });
      if (error) throw toAppError(error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: myCvKey(userId) }),
  });
}

/** Everything under ['profile', userId] (profile row + cv) and the account state are refreshed together. */
function useInvalidateProfile() {
  const qc = useQueryClient(); const { userId } = useSession();
  return () => Promise.all([qc.invalidateQueries({ queryKey: myProfileKey(userId) }), qc.invalidateQueries({ queryKey: accountStateKey(userId) })]);
}

export interface ProfilePatch { headline: string | null; bio: string | null; city: string | null; education_stage: EducationStage | null; skills: string[]; discoverable: boolean }

export function useUpdateProfile() {
  const { userId } = useSession(); const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { data, error } = await getSupabase().from('profiles').update(patch).eq('id', userId!).select('id').single();
      if (error) throw toAppError(error);
      return data;
    },
    onSuccess: invalidate,
  });
}

export interface ExperienceInput {
  kind: ExperienceKind; title: string; role: string | null; contribution: string | null; organization_name: string | null; link_url: string | null;
  started_on: string | null; ended_on: string | null; status: 'draft' | 'published'; visibility: 'private' | 'profile';
}

export function useSaveExperience(experienceId?: string) {
  const { userId } = useSession(); const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: async (input: ExperienceInput): Promise<string> => {
      const table = getSupabase().from('experiences');
      const res = experienceId
        ? await table.update(input).eq('id', experienceId).select('id').single()
        : await table.insert({ ...input, user_id: userId! }).select('id').single();
      if (res.error) throw toAppError(res.error);
      return res.data.id;
    },
    onSuccess: invalidate,
  });
}

/** Show on profile / keep private, without touching the verified substance of the entry. */
export function useSetExperiencePublication(experienceId: string) {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: async (publish: boolean) => {
      const { error } = await getSupabase().from('experiences')
        .update(publish ? { status: 'published', visibility: 'profile' } : { visibility: 'private' }).eq('id', experienceId).select('id').single();
      if (error) throw toAppError(error);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteExperience() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: async (experienceId: string) => {
      const { data, error } = await getSupabase().from('experiences').delete().eq('id', experienceId).select('id');
      if (error) throw toAppError(error);
      if (!data.length) throw toAppError({ code: 'PGRST116', message: 'not found' }); // nothing deleted is not a success
    },
    onSuccess: invalidate,
  });
}

export function useAttestingOrganizations(enabled: boolean) {
  return useQuery({
    queryKey: attestingOrgsKey, enabled, staleTime: 600_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('attesting_organizations');
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useRequestAttestation(experienceId: string) {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: async (organizationId: string) => {
      const { error } = await getSupabase().rpc('request_attestation', { p_experience_id: experienceId, p_org_id: organizationId });
      if (error) throw toAppError(error);
    },
    onSuccess: invalidate,
  });
}

/** Own private fields, shown read-only in the editor (birth date is write-once on the server). */
export function useMyBirthDate() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ['profile', userId, 'birth-date'] as const, enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('profile_private').select('birth_date').eq('user_id', userId!).maybeSingle();
      if (error) throw toAppError(error);
      return data?.birth_date ?? null;
    },
  });
}
