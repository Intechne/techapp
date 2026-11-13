import type { NavigatorScreenParams } from '@react-navigation/native';
import type { EventFiltersTarget, EventListParams } from '../features/events/filters';
import type { SearchGroupKey } from '../features/search/api';

/** Screens reachable from more than one tab (event journey). Registered in every stack that needs them. */
export type SharedEventParamList = {
  EventDetail: { eventId: string };
  EventRegistration: { eventId: string };
  RegistrationStatus: { registrationId: string; fresh?: boolean };
  GuardianRequest: { registrationId: string };
  ParticipationCard: { registrationId: string };
  MyRegistrations: undefined;
  VolunteerHub: { eventId: string };
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
  /** Developer-only (`__DEV__ && appEnv === 'local'`): the route is never registered in any other build. */
  DesignPreview: { data?: string; state?: string } | undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
