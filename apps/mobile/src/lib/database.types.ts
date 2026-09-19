/**
 * App-facing database types. Everything here is DERIVED from `database.generated.ts`
 * (output of `npm run db:types`; never edit that file by hand). Only the JSON payloads returned by
 * jsonb RPCs are described here, as zod schemas that are validated at runtime in the API layer.
 */
import { z } from 'zod';
import type { Database } from './database.generated';

export type { Database };
type Public = Database['public'];
export type Tables<T extends keyof Public['Tables']> = Public['Tables'][T]['Row'];
export type Enums<T extends keyof Public['Enums']> = Public['Enums'][T];

export type EducationStage = Enums<'education_stage'>;
export type EventType = Enums<'event_type'>;
export type EventFormat = Enums<'event_format'>;
export type RegistrationStatus = Enums<'registration_status'>;
export type GuardianStatus = Enums<'guardian_status'>;
export type OrgMemberRole = Enums<'org_member_role'>;
export type OpportunityType = Enums<'opportunity_type'>;

export type ProfileRow = Tables<'profiles'>;
export type InterestRow = Tables<'interests'>;
export type EventSessionRow = Tables<'event_sessions'>;
export type EventRegistrationRow = Tables<'event_registrations'>;
export type OpportunityRow = Tables<'opportunities'>;
export type TeamRow = Tables<'teams'>;
export type CourseRow = Tables<'courses'>;

/** `events.tone` is a checked text column; narrow it for the design system. */
export type EventTone = 'iris' | 'moss' | 'apricot' | 'ink';
export type EventRow = Omit<Tables<'events'>, 'tone'> & { tone: EventTone };

/** View columns are generated as nullable; this view always returns these as non-null. */
type GuardianView = Public['Views']['my_guardian_requests']['Row'];
export type MyGuardianRequestRow = { [K in keyof GuardianView]: K extends 'confirmed_at' | 'denied_at' | 'revoked_at' | 'last_sent_at' ? GuardianView[K] : NonNullable<GuardianView[K]> };

const registrationStatus = z.enum(['pending_guardian', 'pending_review', 'confirmed', 'waitlisted', 'cancelled', 'rejected', 'expired']);
const orgRole = z.enum(['owner', 'admin', 'editor', 'checkin_staff', 'reviewer']);

export const accountStateSchema = z.object({
  user_id: z.string(), profile_complete: z.boolean(), is_minor: z.boolean().nullable(), is_platform_admin: z.boolean(),
  organization_roles: z.array(z.object({ organization_id: z.string(), role: orgRole })),
});
export type AccountState = z.infer<typeof accountStateSchema>;

export const eventEligibilitySchema = z.object({
  event_id: z.string(), authenticated: z.boolean(), eligible: z.boolean(), reasons: z.array(z.string()), guardian_required: z.boolean(),
  is_full: z.boolean(), waitlist_enabled: z.boolean(), seats_left: z.number().nullable(),
  registration_id: z.string().nullable(), registration_status: registrationStatus.nullable(),
});
export type EventEligibility = z.infer<typeof eventEligibilitySchema>;

export const participationCardSchema = z.object({
  registration_id: z.string(), status: registrationStatus,
  event: z.object({ id: z.string(), title: z.string(), starts_at: z.string(), ends_at: z.string(), city: z.string().nullable(), venue: z.string().nullable(), format: z.enum(['in_person', 'online', 'hybrid']) }),
  holder_name: z.string().nullable(), qr_payload: z.string(), short_code: z.string(), valid_from: z.string(), valid_until: z.string(), checked_in_at: z.string().nullable(),
});
export type ParticipationCard = z.infer<typeof participationCardSchema>;

export const checkInResultSchema = z.object({
  result: z.enum(['checked_in', 'already_checked_in']), registration_id: z.string(), checked_in_at: z.string(), holder_name: z.string().nullable(),
});
export type CheckInResult = z.infer<typeof checkInResultSchema>;
