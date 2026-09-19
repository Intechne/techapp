import type { NavigatorScreenParams } from '@react-navigation/native';

/** Screens reachable from more than one tab (event journey). Registered in every stack that needs them. */
export type SharedEventParamList = {
  EventDetail: { eventId: string };
  EventRegistration: { eventId: string };
  RegistrationStatus: { registrationId: string; fresh?: boolean };
  GuardianRequest: { registrationId: string };
  ParticipationCard: { registrationId: string };
  MyRegistrations: undefined;
};

export type DiscoverStackParamList = SharedEventParamList & { DiscoverHome: undefined };
export type EventsStackParamList = SharedEventParamList & { EventsList: undefined };
export type OpportunitiesStackParamList = { OpportunitiesHome: undefined };
export type CommunityStackParamList = { CommunityHome: undefined };
export type ProfileStackParamList = SharedEventParamList & { ProfileHome: undefined; CheckIn: undefined };

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
  AuthOtp: { email: string };
  ProfileBootstrap: undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
