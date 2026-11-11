import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { useSession } from '../auth/SessionProvider';
import { fetchFollowedOpportunityIds, opportunityKeys, setFollowed } from './api';

/** Followed calls for the signed-in user. Guests get an empty set and `requiresAuth`. */
export function useFollowedOpportunities() {
  const { userId } = useSession();
  const qc = useQueryClient(); const toast = useToast();
  const query = useQuery({ queryKey: opportunityKeys.followed(userId), queryFn: () => fetchFollowedOpportunityIds(userId!), enabled: !!userId });
  const mutation = useMutation({
    mutationFn: ({ id, follow }: { id: string; follow: boolean }) => setFollowed(userId!, id, follow),
    onSuccess: async (_d, v) => { await qc.invalidateQueries({ queryKey: opportunityKeys.followed(userId) }); toast.show(v.follow ? 'Takibe aldın. Son tarihler ekranında göreceksin.' : 'Takipten çıkarıldı.'); },
    onError: (e) => toast.show(toAppError(e).message, 'danger'),
  });
  const ids = new Set(query.data ?? []);
  return { ids, requiresAuth: !userId, toggle: (id: string) => mutation.mutate({ id, follow: !ids.has(id) }), pending: mutation.isPending };
}
