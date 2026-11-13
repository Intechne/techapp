import type { NavigatorScreenParams } from '@react-navigation/native';
import type { EventFiltersTarget, EventListParams } from '../features/events/filters';

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

export type DiscoverStackParamList = SharedEventParamList & { DiscoverHome: undefined };
/** Etkinlikler list filters travel as route params (strings on web); the filter sheet starts from and returns the same shape. */
export type EventsStackParamList = SharedEventParamList & { EventsList: EventListParams };
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
  TeamWorkspace: { teamId: string };
  TeamTaskEditor: { teamId: string; taskId?: string };
  TeamProjectEditor: { teamId: string; projectId?: string };
  RecruitmentPostEditor: { teamId: string; postId?: string };
  CreateTeam: undefined;
};
export type ProfileStackParamList = SharedEventParamList & {
  /** `segment`: open the profile with that segment selected (Topluluk > "Tüm takımların"). */
  ProfileHome: { segment?: 'Deneyimler' | 'Katılımlar' | 'Takımlar' } | undefined;
  CheckIn: undefined;
  Saved: undefined;
  EditProfile: undefined;
  ExperienceEditor: { experienceId?: string };
  ExperienceDetail: { experienceId: string };
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
