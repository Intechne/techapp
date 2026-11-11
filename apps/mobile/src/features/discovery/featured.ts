export type FeaturedCandidate = {
  registration_opens_at: string | null;
  registration_closes_at: string;
  capacity: number | null;
  seats_taken: number;
  waitlist_enabled: boolean;
};

/** First event whose registration can actually be taken right now (open window and a seat or a waitlist). */
export function pickFeatured<T extends FeaturedCandidate>(events: T[], now: Date): T | null {
  const t = now.getTime();
  return events.find((e) => {
    const opened = e.registration_opens_at === null || new Date(e.registration_opens_at).getTime() <= t;
    const notClosed = t < new Date(e.registration_closes_at).getTime();
    const hasRoom = e.capacity === null || e.seats_taken < e.capacity || e.waitlist_enabled;
    return opened && notClosed && hasRoom;
  }) ?? null;
}
