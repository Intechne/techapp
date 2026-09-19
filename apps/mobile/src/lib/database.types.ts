/**
 * Hand-maintained subset of the database contract used by the mobile app.
 * Replace with `supabase gen types typescript` output once a Supabase project is linked (docs/DATABASE.md).
 * Source of truth: supabase/migrations/*.sql
 */
export type EducationStage = 'middle_school' | 'high_school' | 'university' | 'graduate' | 'other';
export type EventType = 'hackathon' | 'competition' | 'workshop' | 'conference' | 'meetup' | 'social_impact' | 'training' | 'festival';
export type EventFormat = 'in_person' | 'online' | 'hybrid';
export type RegistrationStatus = 'pending_guardian' | 'pending_review' | 'confirmed' | 'waitlisted' | 'cancelled' | 'rejected' | 'expired';
export type GuardianStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'revoked';
export type OrgMemberRole = 'owner' | 'admin' | 'editor' | 'checkin_staff' | 'reviewer';
export type EventTone = 'iris' | 'moss' | 'apricot' | 'ink';

export type ProfileRow = {
  id: string; display_name: string | null; headline: string | null; bio: string | null; city: string | null;
  education_stage: EducationStage | null; avatar_path: string | null; discoverable: boolean;
  onboarded_at: string | null; created_at: string; updated_at: string;
}
export type InterestRow = { id: number; slug: string; label_tr: string; icon: string; sort_order: number }
export type OrganizationRow = { id: string; slug: string; name: string; type: string; tagline: string | null; verification: string; logo_path: string | null; is_demo: boolean }
export type EventRow = {
  id: string; organization_id: string; slug: string; title: string; poster_line: string | null; summary: string;
  description: string | null; type: EventType; format: EventFormat; topic_interest_id: number | null; tone: EventTone;
  city: string | null; venue: string | null; online_url: string | null; starts_at: string; ends_at: string; timezone: string;
  registration_opens_at: string | null; registration_closes_at: string; capacity: number | null; waitlist_enabled: boolean;
  requires_review: boolean; registration_mode: 'individual' | 'team' | 'both'; min_age: number | null; max_age: number | null;
  guardian_required_under: number | null; audience_note: string | null; fee_minor_units: number;
  cancellation_policy: string | null; support_contact: string | null; status: string; seats_taken: number;
  waitlist_count: number; is_demo: boolean;
}
export type EventSessionRow = { id: string; event_id: string; title: string; starts_at: string; ends_at: string | null; location_note: string | null; sort_order: number }
export type EventRegistrationRow = {
  id: string; event_id: string; user_id: string; team_id: string | null; status: RegistrationStatus; status_reason: string | null;
  idempotency_key: string; answers: Record<string, unknown>; confirmed_at: string | null; cancelled_at: string | null;
  created_at: string; updated_at: string;
}
export type MyGuardianRequestRow = {
  id: string; consent_purpose: string; subject_type: string; subject_id: string; status: GuardianStatus; policy_version: string;
  requested_at: string; expires_at: string; confirmed_at: string | null; denied_at: string | null; revoked_at: string | null;
  send_count: number; last_sent_at: string | null; guardian_email_masked: string;
}

export type OpportunityRow = {
  id: string; organization_id: string; title: string; summary: string; type: 'internship' | 'volunteering' | 'entrepreneurship' | 'talent_program' | 'project_call';
  tone: EventTone; city: string | null; is_remote: boolean; audience_note: string | null; skills: string[]; min_age: number | null;
  closes_at: string; shared_fields: string[]; status: string; is_demo: boolean;
}
export type TeamRow = {
  id: string; slug: string; name: string; kind: 'team' | 'community'; category: string | null; tagline: string | null; city: string | null;
  tone: EventTone; accepts_join_requests: boolean; member_count: number; is_demo: boolean;
}
export type CourseRow = { id: string; title: string; poster_line: string | null; summary: string; level: string; tone: EventTone; estimated_minutes: number | null; lesson_count: number; status: string }

export type AccountState = {
  user_id: string; profile_complete: boolean; is_minor: boolean | null; is_platform_admin: boolean;
  organization_roles: { organization_id: string; role: OrgMemberRole }[];
}
export type EventEligibility = {
  event_id: string; authenticated: boolean; eligible: boolean; reasons: string[]; guardian_required: boolean;
  is_full: boolean; waitlist_enabled: boolean; seats_left: number | null;
  registration_id: string | null; registration_status: RegistrationStatus | null;
}
export type ParticipationCard = {
  registration_id: string; status: RegistrationStatus;
  event: { id: string; title: string; starts_at: string; ends_at: string; city: string | null; venue: string | null; format: EventFormat };
  holder_name: string | null; qr_payload: string; short_code: string; valid_from: string; valid_until: string; checked_in_at: string | null;
}
export type CheckInResult = { result: 'checked_in' | 'already_checked_in'; registration_id: string; checked_in_at: string; holder_name: string | null }

type Table<Row, Writable = never> = { Row: Row; Insert: Writable; Update: Partial<Writable>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Pick<ProfileRow, 'display_name' | 'headline' | 'bio' | 'city' | 'education_stage' | 'discoverable'>>;
      interests: Table<InterestRow>;
      profile_interests: Table<{ user_id: string; interest_id: number; created_at: string }, { user_id: string; interest_id: number }>;
      organizations: Table<OrganizationRow>;
      events: Table<EventRow>;
      event_sessions: Table<EventSessionRow>;
      event_registrations: Table<EventRegistrationRow>;
      opportunities: Table<OpportunityRow>;
      teams: Table<TeamRow>;
      courses: Table<CourseRow>;
    };
    Views: { my_guardian_requests: { Row: MyGuardianRequestRow; Relationships: [] } };
    Functions: {
      my_account_state: { Args: Record<string, never>; Returns: AccountState | null };
      complete_profile_bootstrap: { Args: { p_display_name: string; p_education_stage: EducationStage; p_birth_date: string; p_interest_slugs: string[] }; Returns: ProfileRow };
      event_eligibility: { Args: { p_event_id: string }; Returns: EventEligibility };
      register_for_event: { Args: { p_event_id: string; p_idempotency_key: string; p_answers?: Record<string, unknown> }; Returns: EventRegistrationRow };
      cancel_event_registration: { Args: { p_registration_id: string }; Returns: EventRegistrationRow };
      get_participation_card: { Args: { p_registration_id: string }; Returns: ParticipationCard };
      check_in_participant: { Args: { p_token: string; p_session_id?: string }; Returns: CheckInResult };
      create_guardian_request: { Args: { p_registration_id: string; p_guardian_email: string; p_guardian_name?: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
