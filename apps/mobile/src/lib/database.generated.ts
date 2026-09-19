export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_status_history: {
        Row: {
          actor_kind: string
          application_id: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: number
          note: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          actor_kind: string
          application_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: never
          note?: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          actor_kind?: string
          application_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          idempotency_key: string
          motivation: string | null
          opportunity_id: string
          shared_fields: string[]
          snapshot: Json
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          idempotency_key: string
          motivation?: string | null
          opportunity_id: string
          shared_fields?: string[]
          snapshot?: Json
          status: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          idempotency_key?: string
          motivation?: string | null
          opportunity_id?: string
          shared_fields?: string[]
          snapshot?: Json
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      attestations: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          experience_id: string
          id: string
          organization_id: string
          requested_at: string
          requested_by: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scope: string | null
          source: string | null
          status: Database["public"]["Enums"]["attestation_status"]
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          experience_id: string
          id?: string
          organization_id: string
          requested_at?: string
          requested_by: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["attestation_status"]
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          experience_id?: string
          id?: string
          organization_id?: string
          requested_at?: string
          requested_by?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["attestation_status"]
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attestations_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          created_at: string
          id: number
          metadata: Json
          organization_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind: string
          created_at?: string
          id?: never
          metadata?: Json
          organization_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          id?: never
          metadata?: Json
          organization_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string
          guardian_request_id: string | null
          id: string
          policy_version: string
          purpose: string
          subject_id: string | null
          subject_type: string | null
          updated_at: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by: string
          guardian_request_id?: string | null
          id?: string
          policy_version: string
          purpose: string
          subject_id?: string | null
          subject_type?: string | null
          updated_at?: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string
          guardian_request_id?: string | null
          id?: string
          policy_version?: string
          purpose?: string
          subject_id?: string | null
          subject_type?: string | null
          updated_at?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_guardian_request_id_fkey"
            columns: ["guardian_request_id"]
            isOneToOne: false
            referencedRelation: "guardian_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_guardian_request_id_fkey"
            columns: ["guardian_request_id"]
            isOneToOne: false
            referencedRelation: "my_guardian_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed_at: string | null
          completed_lesson_ids: string[]
          course_id: string
          created_at: string
          percent: number
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_lesson_ids?: string[]
          course_id: string
          created_at?: string
          percent?: number
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_lesson_ids?: string[]
          course_id?: string
          created_at?: string
          percent?: number
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          approved_by: string | null
          created_at: string
          estimated_minutes: number | null
          id: string
          is_demo: boolean
          lesson_count: number
          level: string
          organization_id: string | null
          poster_line: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["publish_status"]
          summary: string
          title: string
          tone: string
          topic_interest_id: number | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_demo?: boolean
          lesson_count?: number
          level?: string
          organization_id?: string | null
          poster_line?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary: string
          title: string
          tone?: string
          topic_interest_id?: number | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_demo?: boolean
          lesson_count?: number
          level?: string
          organization_id?: string | null
          poster_line?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary?: string
          title?: string
          tone?: string
          topic_interest_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_topic_interest_id_fkey"
            columns: ["topic_interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_install_id: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          provider: Database["public"]["Enums"]["push_provider"]
          push_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_install_id: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform: string
          provider: Database["public"]["Enums"]["push_provider"]
          push_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_install_id?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          provider?: Database["public"]["Enums"]["push_provider"]
          push_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_check_ins: {
        Row: {
          checked_in_by: string
          created_at: string
          id: string
          registration_id: string
          session_id: string | null
        }
        Insert: {
          checked_in_by: string
          created_at?: string
          id?: string
          registration_id: string
          session_id?: string | null
        }
        Update: {
          checked_in_by?: string
          created_at?: string
          id?: string
          registration_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_check_ins_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_check_ins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_courses: {
        Row: {
          course_id: string
          created_at: string
          event_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          event_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_courses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          answers: Json
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          event_id: string
          id: string
          idempotency_key: string
          status: Database["public"]["Enums"]["registration_status"]
          status_reason: string | null
          team_id: string | null
          ticket_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          idempotency_key: string
          status: Database["public"]["Enums"]["registration_status"]
          status_reason?: string | null
          team_id?: string | null
          ticket_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          idempotency_key?: string
          status?: Database["public"]["Enums"]["registration_status"]
          status_reason?: string | null
          team_id?: string | null
          ticket_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          created_at: string
          ends_at: string | null
          event_id: string
          id: string
          location_note: string | null
          sort_order: number
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          event_id: string
          id?: string
          location_note?: string | null
          sort_order?: number
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          event_id?: string
          id?: string
          location_note?: string | null
          sort_order?: number
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          approved_by: string | null
          audience_note: string | null
          cancellation_policy: string | null
          capacity: number | null
          city: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          fee_minor_units: number
          format: Database["public"]["Enums"]["event_format"]
          guardian_required_under: number | null
          id: string
          is_demo: boolean
          max_age: number | null
          min_age: number | null
          online_url: string | null
          organization_id: string
          poster_line: string | null
          published_at: string | null
          registration_closes_at: string
          registration_mode: Database["public"]["Enums"]["registration_mode"]
          registration_opens_at: string | null
          requires_review: boolean
          seats_taken: number
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["publish_status"]
          summary: string
          support_contact: string | null
          timezone: string
          title: string
          tone: string
          topic_interest_id: number | null
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
          venue: string | null
          waitlist_count: number
          waitlist_enabled: boolean
        }
        Insert: {
          approved_by?: string | null
          audience_note?: string | null
          cancellation_policy?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          fee_minor_units?: number
          format: Database["public"]["Enums"]["event_format"]
          guardian_required_under?: number | null
          id?: string
          is_demo?: boolean
          max_age?: number | null
          min_age?: number | null
          online_url?: string | null
          organization_id: string
          poster_line?: string | null
          published_at?: string | null
          registration_closes_at: string
          registration_mode?: Database["public"]["Enums"]["registration_mode"]
          registration_opens_at?: string | null
          requires_review?: boolean
          seats_taken?: number
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary: string
          support_contact?: string | null
          timezone?: string
          title: string
          tone?: string
          topic_interest_id?: number | null
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          venue?: string | null
          waitlist_count?: number
          waitlist_enabled?: boolean
        }
        Update: {
          approved_by?: string | null
          audience_note?: string | null
          cancellation_policy?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          fee_minor_units?: number
          format?: Database["public"]["Enums"]["event_format"]
          guardian_required_under?: number | null
          id?: string
          is_demo?: boolean
          max_age?: number | null
          min_age?: number | null
          online_url?: string | null
          organization_id?: string
          poster_line?: string | null
          published_at?: string | null
          registration_closes_at?: string
          registration_mode?: Database["public"]["Enums"]["registration_mode"]
          registration_opens_at?: string | null
          requires_review?: boolean
          seats_taken?: number
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary?: string
          support_contact?: string | null
          timezone?: string
          title?: string
          tone?: string
          topic_interest_id?: number | null
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          venue?: string | null
          waitlist_count?: number
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_topic_interest_id_fkey"
            columns: ["topic_interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_evidence: {
        Row: {
          caption: string | null
          created_at: string
          experience_id: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          experience_id: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          experience_id?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_evidence_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_evidence_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          contribution: string | null
          created_at: string
          ended_on: string | null
          id: string
          kind: Database["public"]["Enums"]["experience_kind"]
          link_url: string | null
          organization_name: string | null
          role: string | null
          started_on: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          contribution?: string | null
          created_at?: string
          ended_on?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["experience_kind"]
          link_url?: string | null
          organization_name?: string | null
          role?: string | null
          started_on?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          contribution?: string | null
          created_at?: string
          ended_on?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["experience_kind"]
          link_url?: string | null
          organization_name?: string | null
          role?: string | null
          started_on?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      guardian_requests: {
        Row: {
          audit_metadata: Json
          confirmed_at: string | null
          consent_purpose: string
          created_at: string
          decided_name: string | null
          denied_at: string | null
          expires_at: string
          guardian_email: string
          guardian_name: string | null
          id: string
          last_sent_at: string | null
          policy_version: string
          requested_at: string
          revoke_token_hash: string | null
          revoked_at: string | null
          send_count: number
          status: Database["public"]["Enums"]["guardian_status"]
          subject_id: string
          subject_type: string
          token_hash: string | null
          updated_at: string
          user_id: string
          verification_method: string
        }
        Insert: {
          audit_metadata?: Json
          confirmed_at?: string | null
          consent_purpose: string
          created_at?: string
          decided_name?: string | null
          denied_at?: string | null
          expires_at: string
          guardian_email: string
          guardian_name?: string | null
          id?: string
          last_sent_at?: string | null
          policy_version: string
          requested_at?: string
          revoke_token_hash?: string | null
          revoked_at?: string | null
          send_count?: number
          status?: Database["public"]["Enums"]["guardian_status"]
          subject_id: string
          subject_type: string
          token_hash?: string | null
          updated_at?: string
          user_id: string
          verification_method?: string
        }
        Update: {
          audit_metadata?: Json
          confirmed_at?: string | null
          consent_purpose?: string
          created_at?: string
          decided_name?: string | null
          denied_at?: string | null
          expires_at?: string
          guardian_email?: string
          guardian_name?: string | null
          id?: string
          last_sent_at?: string | null
          policy_version?: string
          requested_at?: string
          revoke_token_hash?: string | null
          revoked_at?: string | null
          send_count?: number
          status?: Database["public"]["Enums"]["guardian_status"]
          subject_id?: string
          subject_type?: string
          token_hash?: string | null
          updated_at?: string
          user_id?: string
          verification_method?: string
        }
        Relationships: []
      }
      interests: {
        Row: {
          icon: string
          id: number
          label_tr: string
          slug: string
          sort_order: number
        }
        Insert: {
          icon?: string
          id?: never
          label_tr: string
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string
          id?: never
          label_tr?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      lessons: {
        Row: {
          body: string
          course_id: string
          created_at: string
          estimated_minutes: number | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          course_id: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          sort_order: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          moderator_id: string
          reason: string
          report_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          moderator_id: string
          reason: string
          report_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          moderator_id?: string
          reason?: string
          report_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          target_id: string | null
          target_type: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          target_id?: string | null
          target_type?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          target_id?: string | null
          target_type?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          approved_by: string | null
          audience_note: string | null
          city: string | null
          closes_at: string
          created_at: string
          created_by: string | null
          description: string | null
          guardian_required_under: number | null
          id: string
          is_demo: boolean
          is_remote: boolean
          max_age: number | null
          min_age: number | null
          opens_at: string | null
          organization_id: string
          published_at: string | null
          shared_fields: string[]
          skills: string[]
          slug: string
          status: Database["public"]["Enums"]["publish_status"]
          summary: string
          title: string
          tone: string
          topic_interest_id: number | null
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          audience_note?: string | null
          city?: string | null
          closes_at: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          guardian_required_under?: number | null
          id?: string
          is_demo?: boolean
          is_remote?: boolean
          max_age?: number | null
          min_age?: number | null
          opens_at?: string | null
          organization_id: string
          published_at?: string | null
          shared_fields?: string[]
          skills?: string[]
          slug: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary: string
          title: string
          tone?: string
          topic_interest_id?: number | null
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          audience_note?: string | null
          city?: string | null
          closes_at?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          guardian_required_under?: number | null
          id?: string
          is_demo?: boolean
          is_remote?: boolean
          max_age?: number | null
          min_age?: number | null
          opens_at?: string | null
          organization_id?: string
          published_at?: string | null
          shared_fields?: string[]
          skills?: string[]
          slug?: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary?: string
          title?: string
          tone?: string
          topic_interest_id?: number | null
          type?: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_topic_interest_id_fkey"
            columns: ["topic_interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          about: string | null
          created_at: string
          id: string
          is_demo: boolean
          logo_path: string | null
          name: string
          slug: string
          tagline: string | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
          verification: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          about?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          logo_path?: string | null
          name: string
          slug: string
          tagline?: string | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          about?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          logo_path?: string | null
          name?: string
          slug?: string
          tagline?: string | null
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_interests: {
        Row: {
          created_at: string
          interest_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          interest_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          interest_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private: {
        Row: {
          birth_date: string | null
          birth_date_set_at: string | null
          created_at: string
          legal_name: string | null
          phone: string | null
          school_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          birth_date_set_at?: string | null
          created_at?: string
          legal_name?: string | null
          phone?: string | null
          school_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          birth_date_set_at?: string | null
          created_at?: string
          legal_name?: string | null
          phone?: string | null
          school_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          city: string | null
          created_at: string
          discoverable: boolean
          display_name: string | null
          education_stage: Database["public"]["Enums"]["education_stage"] | null
          headline: string | null
          id: string
          onboarded_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          discoverable?: boolean
          display_name?: string | null
          education_stage?:
            | Database["public"]["Enums"]["education_stage"]
            | null
          headline?: string | null
          id: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          discoverable?: boolean
          display_name?: string | null
          education_stage?:
            | Database["public"]["Enums"]["education_stage"]
            | null
          headline?: string | null
          id?: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_applications: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          post_id: string
          status: Database["public"]["Enums"]["recruitment_application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["recruitment_application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["recruitment_application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_applications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "recruitment_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_posts: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_open: boolean
          role_label: string | null
          skills: string[]
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_open?: boolean
          role_label?: string | null
          skills?: string[]
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_open?: boolean
          role_label?: string | null
          skills?: string[]
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_posts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_memberships: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          about: string | null
          accepts_join_requests: boolean
          category: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["team_kind"]
          member_count: number
          moderation_status: string
          name: string
          organization_id: string | null
          slug: string
          tagline: string | null
          tone: string
          topic_interest_id: number | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          accepts_join_requests?: boolean
          category?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["team_kind"]
          member_count?: number
          moderation_status?: string
          name: string
          organization_id?: string | null
          slug: string
          tagline?: string | null
          tone?: string
          topic_interest_id?: number | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          accepts_join_requests?: boolean
          category?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["team_kind"]
          member_count?: number
          moderation_status?: string
          name?: string
          organization_id?: string | null
          slug?: string
          tagline?: string | null
          tone?: string
          topic_interest_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_topic_interest_id_fkey"
            columns: ["topic_interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      experiences_with_status: {
        Row: {
          contribution: string | null
          created_at: string | null
          ended_on: string | null
          id: string | null
          is_verified: boolean | null
          kind: Database["public"]["Enums"]["experience_kind"] | null
          link_url: string | null
          organization_name: string | null
          role: string | null
          started_on: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          visibility: string | null
        }
        Insert: {
          contribution?: string | null
          created_at?: string | null
          ended_on?: string | null
          id?: string | null
          is_verified?: never
          kind?: Database["public"]["Enums"]["experience_kind"] | null
          link_url?: string | null
          organization_name?: string | null
          role?: string | null
          started_on?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          visibility?: string | null
        }
        Update: {
          contribution?: string | null
          created_at?: string | null
          ended_on?: string | null
          id?: string | null
          is_verified?: never
          kind?: Database["public"]["Enums"]["experience_kind"] | null
          link_url?: string | null
          organization_name?: string | null
          role?: string | null
          started_on?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      my_guardian_requests: {
        Row: {
          confirmed_at: string | null
          consent_purpose: string | null
          denied_at: string | null
          expires_at: string | null
          guardian_email_masked: string | null
          id: string | null
          last_sent_at: string | null
          policy_version: string | null
          requested_at: string | null
          revoked_at: string | null
          send_count: number | null
          status: Database["public"]["Enums"]["guardian_status"] | null
          subject_id: string | null
          subject_type: string | null
        }
        Insert: {
          confirmed_at?: string | null
          consent_purpose?: string | null
          denied_at?: string | null
          expires_at?: string | null
          guardian_email_masked?: never
          id?: string | null
          last_sent_at?: string | null
          policy_version?: string | null
          requested_at?: string | null
          revoked_at?: string | null
          send_count?: number | null
          status?: Database["public"]["Enums"]["guardian_status"] | null
          subject_id?: string | null
          subject_type?: string | null
        }
        Update: {
          confirmed_at?: string | null
          consent_purpose?: string | null
          denied_at?: string | null
          expires_at?: string | null
          guardian_email_masked?: never
          id?: string | null
          last_sent_at?: string | null
          policy_version?: string | null
          requested_at?: string | null
          revoked_at?: string | null
          send_count?: number | null
          status?: Database["public"]["Enums"]["guardian_status"] | null
          subject_id?: string | null
          subject_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_event_registrations: {
        Args: { p_event_id: string }
        Returns: {
          checked_in_at: string
          confirmed_at: string
          created_at: string
          display_name: string
          guardian_status: Database["public"]["Enums"]["guardian_status"]
          registration_id: string
          status: Database["public"]["Enums"]["registration_status"]
          status_reason: string
        }[]
      }
      application_share_preview: {
        Args: { p_opportunity_id: string }
        Returns: Json
      }
      apply_to_recruitment: {
        Args: { p_message?: string; p_post_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          post_id: string
          status: Database["public"]["Enums"]["recruitment_application_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "recruitment_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_event_registration: {
        Args: { p_registration_id: string }
        Returns: {
          answers: Json
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          event_id: string
          id: string
          idempotency_key: string
          status: Database["public"]["Enums"]["registration_status"]
          status_reason: string | null
          team_id: string | null
          ticket_version: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_in_participant: {
        Args: {
          p_expected_event_id?: string
          p_session_id?: string
          p_token: string
        }
        Returns: Json
      }
      complete_lesson: {
        Args: { p_lesson_id: string }
        Returns: {
          completed_at: string | null
          completed_lesson_ids: string[]
          course_id: string
          created_at: string
          percent: number
          started_at: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "course_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_profile_bootstrap: {
        Args: {
          p_birth_date: string
          p_display_name: string
          p_education_stage: Database["public"]["Enums"]["education_stage"]
          p_interest_slugs?: string[]
        }
        Returns: {
          avatar_path: string | null
          bio: string | null
          city: string | null
          created_at: string
          discoverable: boolean
          display_name: string | null
          education_stage: Database["public"]["Enums"]["education_stage"] | null
          headline: string | null
          id: string
          onboarded_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_guardian_request: {
        Args: {
          p_guardian_email: string
          p_guardian_name?: string
          p_registration_id: string
        }
        Returns: string
      }
      create_team: {
        Args: {
          p_category?: string
          p_kind?: Database["public"]["Enums"]["team_kind"]
          p_name: string
          p_tagline?: string
        }
        Returns: {
          about: string | null
          accepts_join_requests: boolean
          category: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["team_kind"]
          member_count: number
          moderation_status: string
          name: string
          organization_id: string | null
          slug: string
          tagline: string | null
          tone: string
          topic_interest_id: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_attestation: {
        Args: {
          p_attestation_id: string
          p_decision: Database["public"]["Enums"]["attestation_status"]
          p_note?: string
          p_scope?: string
          p_source?: string
          p_valid_until?: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          experience_id: string
          id: string
          organization_id: string
          requested_at: string
          requested_by: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scope: string | null
          source: string | null
          status: Database["public"]["Enums"]["attestation_status"]
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attestations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_recruitment_application: {
        Args: { p_accept: boolean; p_application_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          post_id: string
          status: Database["public"]["Enums"]["recruitment_application_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "recruitment_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_team_join: {
        Args: { p_accept: boolean; p_membership_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "team_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      event_eligibility: { Args: { p_event_id: string }; Returns: Json }
      get_participation_card: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      guardian_decide: {
        Args: {
          p_approve: boolean
          p_guardian_full_name: string
          p_policy_version: string
          p_token: string
        }
        Returns: Json
      }
      guardian_request_preview: { Args: { p_token: string }; Returns: Json }
      guardian_revoke: { Args: { p_revoke_token: string }; Returns: Json }
      issue_guardian_token: { Args: { p_request_id: string }; Returns: Json }
      leave_team: {
        Args: { p_team_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "team_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_account_state: { Args: never; Returns: Json }
      register_device: {
        Args: {
          p_app_version?: string
          p_install_id: string
          p_platform: string
          p_provider: Database["public"]["Enums"]["push_provider"]
          p_push_token: string
        }
        Returns: {
          app_version: string | null
          created_at: string
          device_install_id: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          provider: Database["public"]["Enums"]["push_provider"]
          push_token: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "devices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_for_event: {
        Args: {
          p_answers?: Json
          p_event_id: string
          p_idempotency_key: string
        }
        Returns: {
          answers: Json
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          event_id: string
          id: string
          idempotency_key: string
          status: Database["public"]["Enums"]["registration_status"]
          status_reason: string | null
          team_id: string | null
          ticket_version: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_team_member: {
        Args: { p_membership_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "team_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_attestation: {
        Args: { p_experience_id: string; p_org_id: string; p_scope?: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          experience_id: string
          id: string
          organization_id: string
          requested_at: string
          requested_by: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scope: string | null
          source: string | null
          status: Database["public"]["Enums"]["attestation_status"]
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attestations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_team_join: {
        Args: { p_message?: string; p_team_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "team_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_event_registration: {
        Args: {
          p_approve: boolean
          p_reason?: string
          p_registration_id: string
        }
        Returns: {
          answers: Json
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          event_id: string
          id: string
          idempotency_key: string
          status: Database["public"]["Enums"]["registration_status"]
          status_reason: string | null
          team_id: string | null
          ticket_version: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_attestation: {
        Args: { p_attestation_id: string; p_reason: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          experience_id: string
          id: string
          organization_id: string
          requested_at: string
          requested_by: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scope: string | null
          source: string | null
          status: Database["public"]["Enums"]["attestation_status"]
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attestations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_application_status: {
        Args: {
          p_application_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["application_status"]
        }
        Returns: {
          created_at: string
          decided_at: string | null
          id: string
          idempotency_key: string
          motivation: string | null
          opportunity_id: string
          shared_fields: string[]
          snapshot: Json
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_team_member_role: {
        Args: {
          p_membership_id: string
          p_role: Database["public"]["Enums"]["team_role"]
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "team_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_team_task_status: {
        Args: {
          p_status: Database["public"]["Enums"]["task_status"]
          p_task_id: string
        }
        Returns: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          team_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "team_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_application: {
        Args: {
          p_idempotency_key: string
          p_motivation?: string
          p_opportunity_id: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          id: string
          idempotency_key: string
          motivation: string | null
          opportunity_id: string
          shared_fields: string[]
          snapshot: Json
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      team_roster: {
        Args: { p_team_id: string }
        Returns: {
          display_name: string
          membership_id: string
          message: string
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }[]
      }
      unregister_device: { Args: { p_install_id: string }; Returns: number }
      withdraw_application: {
        Args: { p_application_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          id: string
          idempotency_key: string
          motivation: string | null
          opportunity_id: string
          shared_fields: string[]
          snapshot: Json
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_team_join: {
        Args: { p_membership_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "team_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      application_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "info_requested"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "closed"
      attestation_status:
        | "requested"
        | "verified"
        | "changes_requested"
        | "rejected"
        | "revoked"
      education_stage:
        | "middle_school"
        | "high_school"
        | "university"
        | "graduate"
        | "other"
      event_format: "in_person" | "online" | "hybrid"
      event_type:
        | "hackathon"
        | "competition"
        | "workshop"
        | "conference"
        | "meetup"
        | "social_impact"
        | "training"
        | "festival"
      experience_kind:
        | "project"
        | "competition"
        | "volunteering"
        | "work"
        | "education"
        | "event_participation"
        | "other"
      guardian_status: "pending" | "approved" | "denied" | "expired" | "revoked"
      membership_status: "pending" | "active" | "rejected" | "left" | "removed"
      opportunity_type:
        | "internship"
        | "volunteering"
        | "entrepreneurship"
        | "talent_program"
        | "project_call"
      org_member_role:
        | "owner"
        | "admin"
        | "editor"
        | "checkin_staff"
        | "reviewer"
      org_type:
        | "intechne"
        | "company"
        | "university"
        | "school"
        | "ngo"
        | "community"
        | "public_institution"
      publish_status:
        | "draft"
        | "in_review"
        | "published"
        | "cancelled"
        | "archived"
      push_provider: "apns" | "fcm" | "hms"
      recruitment_application_status:
        | "submitted"
        | "accepted"
        | "rejected"
        | "withdrawn"
      registration_mode: "individual" | "team" | "both"
      registration_status:
        | "pending_guardian"
        | "pending_review"
        | "confirmed"
        | "waitlisted"
        | "cancelled"
        | "rejected"
        | "expired"
      task_status: "todo" | "doing" | "done"
      team_kind: "team" | "community"
      team_role: "captain" | "mentor" | "member"
      verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
        | "revoked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      application_status: [
        "draft",
        "submitted",
        "in_review",
        "info_requested",
        "accepted",
        "declined",
        "withdrawn",
        "closed",
      ],
      attestation_status: [
        "requested",
        "verified",
        "changes_requested",
        "rejected",
        "revoked",
      ],
      education_stage: [
        "middle_school",
        "high_school",
        "university",
        "graduate",
        "other",
      ],
      event_format: ["in_person", "online", "hybrid"],
      event_type: [
        "hackathon",
        "competition",
        "workshop",
        "conference",
        "meetup",
        "social_impact",
        "training",
        "festival",
      ],
      experience_kind: [
        "project",
        "competition",
        "volunteering",
        "work",
        "education",
        "event_participation",
        "other",
      ],
      guardian_status: ["pending", "approved", "denied", "expired", "revoked"],
      membership_status: ["pending", "active", "rejected", "left", "removed"],
      opportunity_type: [
        "internship",
        "volunteering",
        "entrepreneurship",
        "talent_program",
        "project_call",
      ],
      org_member_role: [
        "owner",
        "admin",
        "editor",
        "checkin_staff",
        "reviewer",
      ],
      org_type: [
        "intechne",
        "company",
        "university",
        "school",
        "ngo",
        "community",
        "public_institution",
      ],
      publish_status: [
        "draft",
        "in_review",
        "published",
        "cancelled",
        "archived",
      ],
      push_provider: ["apns", "fcm", "hms"],
      recruitment_application_status: [
        "submitted",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      registration_mode: ["individual", "team", "both"],
      registration_status: [
        "pending_guardian",
        "pending_review",
        "confirmed",
        "waitlisted",
        "cancelled",
        "rejected",
        "expired",
      ],
      task_status: ["todo", "doing", "done"],
      team_kind: ["team", "community"],
      team_role: ["captain", "mentor", "member"],
      verification_status: [
        "unverified",
        "pending",
        "verified",
        "rejected",
        "revoked",
      ],
    },
  },
} as const
