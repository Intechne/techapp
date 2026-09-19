import { z } from 'zod';

/** Shape of the jsonb returned by the `my_cv()` RPC (supabase/migrations/20260920000200_titles_cv_sharing.sql). */
export const attestationStatus = z.enum(['requested', 'verified', 'changes_requested', 'rejected', 'revoked']);
export const experienceKind = z.enum(['project', 'competition', 'volunteering', 'work', 'education', 'event_participation', 'other']);

export const cvAttestationSchema = z.object({
  id: z.string(), status: attestationStatus, scope: z.string().nullable(), source: z.string().nullable(), decided_at: z.string().nullable(),
  decision_note: z.string().nullable(), valid_until: z.string().nullable(), organization: z.string().nullable(),
});
export const cvExperienceSchema = z.object({
  id: z.string(), kind: experienceKind, title: z.string(), role: z.string().nullable(), contribution: z.string().nullable(),
  organization_name: z.string().nullable(), link_url: z.string().nullable(), started_on: z.string().nullable(), ended_on: z.string().nullable(),
  status: z.enum(['draft', 'published']), visibility: z.enum(['private', 'profile']), attestation: cvAttestationSchema.nullable(),
});
export const cvSchema = z.object({
  profile: z.object({
    id: z.string(), display_name: z.string().nullable(), headline: z.string().nullable(), bio: z.string().nullable(), city: z.string().nullable(),
    education_stage: z.enum(['middle_school', 'high_school', 'university', 'graduate', 'other']).nullable(), discoverable: z.boolean(), skills: z.array(z.string()),
  }),
  interests: z.array(z.string()),
  experiences: z.array(cvExperienceSchema),
  participations: z.array(z.object({ event_id: z.string(), title: z.string(), type: z.string(), starts_at: z.string(), organizer: z.string().nullable(), checked_in_at: z.string() })),
  volunteering: z.array(z.object({ event_id: z.string(), title: z.string(), starts_at: z.string(), duty: z.string().nullable(), organizer: z.string().nullable() })),
  teams: z.array(z.object({ team_id: z.string(), name: z.string(), kind: z.enum(['team', 'community']), role: z.enum(['captain', 'mentor', 'member']),
    title: z.string().nullable().default(null), since: z.string().nullable() })),
  /** Present only while the owner has link sharing switched on. */
  share_token: z.string().nullable().default(null),
});
export type Cv = z.infer<typeof cvSchema>;
export type CvExperience = z.infer<typeof cvExperienceSchema>;
export type CvAttestation = z.infer<typeof cvAttestationSchema>;
