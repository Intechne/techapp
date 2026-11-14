import type { NavigatorScreenParams } from '@react-navigation/native';
import type { EventFiltersTarget, EventListParams } from '../features/events/filters';
import type { SearchGroupKey } from '../features/search/api';
import type { ReportSubject } from '../features/reports/ReportSheet';

/** Screens reachable from more than one tab (event journey). Registered in every stack that needs them. */
export type SharedEventParamList = {
  EventDetail: { eventId: string };
  EventRegistration: { eventId: string };
  RegistrationStatus: { registrationId: string; fresh?: boolean };
  GuardianRequest: { registrationId: string };
  /** Takım kaydı (kaptan veya mentor), behind features.teamRegistration. `teamRegistrationId`: edit that registration's roster. */
  TeamRegistration: { eventId: string; teamRegistrationId?: string };
  TeamRegistrationStatus: { teamRegistrationId: string };
  /** Üye daveti (Katılımlarım opens it by member id; a notification only has the team registration id), behind features.teamRegistration. */
  TeamInvite: { memberId?: string; teamRegistrationId?: string };
  ParticipationCard: { registrationId: string };
  MyRegistrations: undefined;
  VolunteerHub: { eventId: string };
  /** Kurum profili: reached from an event's organiser row, an opportunity's owner row. */
  Organization: { organizationId: string };
};

/** Gelişim: reachable from Keşfet, Etkinlikler ("Bu etkinliğe hazırlan") and Profil > Kaydedilenler. */
export type SharedLearningParamList = {
  CourseList: undefined;
  CourseDetail: { courseId: string };
  Lesson: { courseId: string; lessonId: string };
};

export type DiscoverStackParamList = SharedEventParamList & SharedLearningParamList & {
  DiscoverHome: undefined;
  Notifications: undefined;
  /** Birleşik arama. `group` + `query`: one group's "Tümünü gör" (the same screen, that group alone). Not deep-linked. */
  Search: { query?: string; group?: SearchGroupKey } | undefined;
};
/** Etkinlikler list filters travel as route params (strings on web); the filter sheet starts from and returns the same shape. */
export type EventsStackParamList = SharedEventParamList & SharedLearningParamList & { EventsList: EventListParams };
export type OpportunitiesStackParamList = {
  OpportunitiesHome: undefined;
  Deadlines: undefined;
  OpportunityDetail: { opportunityId: string };
  OpportunityApply: { opportunityId: string };
  MyApplications: undefined;
  Organization: { organizationId: string };
};
export type CommunityStackParamList = {
  CommunityHome: undefined;
  TeamDetail: { teamId: string };
  /** `tab`: open on İstekler (a join-request notification goes straight to the decision). */
  TeamWorkspace: { teamId: string; tab?: 'İstekler' };
  TeamTaskEditor: { teamId: string; taskId?: string };
  TeamProjectEditor: { teamId: string; projectId?: string };
  RecruitmentPostEditor: { teamId: string; postId?: string };
  CreateTeam: undefined;
};
export type ProfileStackParamList = SharedEventParamList & SharedLearningParamList & {
  /** `segment`: open the profile with that segment selected (Topluluk > "Tüm takımların"). */
  ProfileHome: { segment?: 'Deneyimler' | 'Katılımlar' | 'Takımlar' } | undefined;
  CheckIn: undefined;
  Saved: undefined;
  EditProfile: undefined;
  ExperienceEditor: { experienceId?: string };
  ExperienceDetail: { experienceId: string };
  Notifications: undefined;
  Settings: undefined;
  NotificationSettings: undefined;
  Privacy: undefined;
  ConsentCenter: undefined;
};

export type MainTabParamList = {
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  EventsTab: NavigatorScreenParams<EventsStackParamList>;
  OpportunitiesTab: NavigatorScreenParams<OpportunitiesStackParamList>;
  CommunityTab: NavigatorScreenParams<CommunityStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  AuthEmail: undefined;
  AuthOtp: undefined;
  ProfileBootstrap: undefined;
  /** Etkinlikler filters: a form sheet on the root stack so it covers the tab bar; it edits the Events list's params. */
  EventFilters: EventListParams & EventFiltersTarget;
  /**
   * Native form sheets (presentation 'formSheet'), all on the root stack so they cover the tab bar. The opener passes plain data;
   * the result comes back through query invalidation or the opener's own queries, never through a callback in params.
   */
  ReportSheet: ReportSubject;
  RecruitmentApply: { teamId: string; postId: string; title: string; roleLabel: string | null };
  TeamJoinRequest: { teamId: string };
  ExperienceVerify: { experienceId: string };
  /** Developer-only (`__DEV__ && appEnv === 'local'`): the route is never registered in any other build. */
  DesignPreview: { data?: string; state?: string } | undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
