import { useQuery } from '@tanstack/react-query';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import { useSession } from '../auth/SessionProvider';

export const myProfileKey = (userId: string | null) => ['profile', userId] as const;

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
