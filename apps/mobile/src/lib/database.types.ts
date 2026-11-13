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
/**
 * `teams` / `recruitment_posts`: the API roles may SELECT every column except `created_by` (migration
 * 20261112000300_hide_creator_columns). Read them with TEAM_PUBLIC_COLUMNS / RECRUITMENT_POST_COLUMNS (features/teams/api.ts).
 */
export type TeamRow = Omit<Tables<'teams'>, 'created_by'>;
export type RecruitmentPostRow = Omit<Tables<'recruitment_posts'>, 'created_by'>;
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

const teamRegistrationStatus = z.enum(['pending_members', 'pending_review', 'confirmed', 'waitlisted', 'cancelled', 'rejected', 'expired']);
/** A team the caller can register for an event: active captain or mentor. Ids, name and counts only: no member names. */
export const manageableTeamSchema = z.object({
  team_id: z.string(), name: z.string(), role: z.enum(['captain', 'mentor']), active_member_count: z.number(),
  registration_id: z.string().nullable(), registration_status: teamRegistrationStatus.nullable(),
});
export type ManageableTeam = z.infer<typeof manageableTeamSchema>;

export const eventEligibilitySchema = z.object({
  event_id: z.string(), authenticated: z.boolean(), eligible: z.boolean(), reasons: z.array(z.string()), guardian_required: z.boolean(),
  is_full: z.boolean(), waitlist_enabled: z.boolean(), seats_left: z.number().nullable(),
  registration_id: z.string().nullable(), registration_status: registrationStatus.nullable(),
  // Added by 20261113000600; defaults keep an older server readable.
  registration_mode: z.enum(['individual', 'team', 'both']).default('individual'),
  team_seats_left: z.number().nullable().default(null),
  manageable_teams: z.array(manageableTeamSchema).default([]),
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

/** `team_public_profile(p_team_id)`: counts and the adult captains/mentors who chose to be discoverable. Never user ids. */
export const teamPublicProfileSchema = z.object({
  member_count: z.number(),
  role_counts: z.object({ captain: z.number(), mentor: z.number(), member: z.number() }),
  leaders: z.array(z.object({ display_name: z.string(), role: z.enum(['captain', 'mentor']) })),
  projects_count: z.number(),
  events: z.array(z.object({ id: z.string(), title: z.string(), starts_at: z.string().nullable().optional() })),
});
export type TeamPublicProfile = z.infer<typeof teamPublicProfileSchema>;

export type TeamRegistrationStatus = z.infer<typeof teamRegistrationStatus>;
export type TeamMemberStep = 'invited' | 'guardian' | 'ready' | 'declined';

/** team_registration_detail (20261113000700): the registration as the team's circle sees it. No e-mail, birth date or guardian data. */
export const teamRegistrationDetailSchema = z.object({
  id: z.string(), status: teamRegistrationStatus, hold_expires_at: z.string().nullable(), roster_version: z.number(), can_edit: z.boolean(),
  event: z.object({ id: z.string(), title: z.string(), starts_at: z.string() }),
  team: z.object({ id: z.string(), name: z.string() }),
  members: z.array(z.object({
    member_id: z.string(), display_name: z.string().nullable(), role_at_submit: z.enum(['captain', 'mentor', 'member']),
    state: z.enum(['invited', 'accepted', 'declined', 'removed']), step: z.enum(['invited', 'guardian', 'ready', 'declined']),
  })),
});
export type TeamRegistrationDetail = z.infer<typeof teamRegistrationDetailSchema>;
