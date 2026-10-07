import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TechIcon, colors, fonts, layout, type TechIconName } from '../design-system';
import { AuthEmailScreen } from '../features/auth/AuthEmailScreen';
import { AuthOtpScreen } from '../features/auth/AuthOtpScreen';
import { ProfileBootstrapScreen } from '../features/auth/ProfileBootstrapScreen';
import { CheckInScreen } from '../features/checkin/CheckInScreen';
import { CommunityScreen } from '../features/community/CommunityScreen';
import { DiscoverScreen } from '../features/discovery/DiscoverScreen';
import { EventDetailScreen } from '../features/events/EventDetailScreen';
import { EventRegistrationScreen } from '../features/events/EventRegistrationScreen';
import { EventsListScreen } from '../features/events/EventsListScreen';
import { MyRegistrationsScreen } from '../features/events/MyRegistrationsScreen';
import { ParticipationCardScreen } from '../features/events/ParticipationCardScreen';
import { RegistrationStatusScreen } from '../features/events/RegistrationStatusScreen';
import { GuardianRequestScreen } from '../features/guardian/GuardianRequestScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { usePrefs } from '../features/onboarding/PrefsProvider';
import { useAccountState, useSession } from '../features/auth/SessionProvider';
import { OpportunitiesScreen } from '../features/opportunities/OpportunitiesScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { EditProfileScreen } from '../features/profile/EditProfileScreen';
import { ExperienceEditorScreen } from '../features/profile/ExperienceEditorScreen';
import { ExperienceDetailScreen } from '../features/profile/ExperienceDetailScreen';
import { TeamDetailScreen } from '../features/teams/TeamDetailScreen';
import { TeamWorkspaceScreen } from '../features/teams/TeamWorkspaceScreen';
import { TeamTaskEditorScreen } from '../features/teams/TeamTaskEditorScreen';
import { CreateTeamScreen } from '../features/teams/CreateTeamScreen';
import { DeadlinesScreen } from '../features/opportunities/DeadlinesScreen';
import { OpportunityDetailScreen } from '../features/opportunities/OpportunityDetailScreen';
import { OpportunityApplyScreen } from '../features/opportunities/OpportunityApplyScreen';
import { MyApplicationsScreen } from '../features/opportunities/MyApplicationsScreen';
import { VolunteerHubScreen } from '../features/volunteers/VolunteerHubScreen';
import { useLayout } from '../design-system';
import type { CommunityStackParamList, DiscoverStackParamList, EventsStackParamList, MainTabParamList, OpportunitiesStackParamList, ProfileStackParamList, RootStackParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const Discover = createNativeStackNavigator<DiscoverStackParamList>();
const Events = createNativeStackNavigator<EventsStackParamList>();
const Opportunities = createNativeStackNavigator<OpportunitiesStackParamList>();
const Community = createNativeStackNavigator<CommunityStackParamList>();
const Profile = createNativeStackNavigator<ProfileStackParamList>();

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: colors.canvas } } as const;

/** The event journey is shared by several tabs; each tab keeps its own history, filters and scroll position. */
function eventJourney<T extends typeof Discover | typeof Events | typeof Profile>(Stack: T) {
  const S = Stack as typeof Events;
  return (
    <>
      <S.Screen name="EventDetail" component={EventDetailScreen} />
      <S.Screen name="EventRegistration" component={EventRegistrationScreen} />
      <S.Screen name="RegistrationStatus" component={RegistrationStatusScreen} />
      <S.Screen name="GuardianRequest" component={GuardianRequestScreen} />
      <S.Screen name="ParticipationCard" component={ParticipationCardScreen} />
      <S.Screen name="MyRegistrations" component={MyRegistrationsScreen} />
      <S.Screen name="VolunteerHub" component={VolunteerHubScreen} />
    </>
  );
}

const DiscoverStack = () => <Discover.Navigator screenOptions={stackOptions}><Discover.Screen name="DiscoverHome" component={DiscoverScreen} />{eventJourney(Discover)}</Discover.Navigator>;
const EventsStack = () => <Events.Navigator screenOptions={stackOptions}><Events.Screen name="EventsList" component={EventsListScreen} />{eventJourney(Events)}</Events.Navigator>;
const OpportunitiesStack = () => <Opportunities.Navigator screenOptions={stackOptions}><Opportunities.Screen name="OpportunitiesHome" component={OpportunitiesScreen} /><Opportunities.Screen name="Deadlines" component={DeadlinesScreen} /><Opportunities.Screen name="OpportunityDetail" component={OpportunityDetailScreen} /><Opportunities.Screen name="OpportunityApply" component={OpportunityApplyScreen} /><Opportunities.Screen name="MyApplications" component={MyApplicationsScreen} /></Opportunities.Navigator>;
const CommunityStack = () => <Community.Navigator screenOptions={stackOptions}><Community.Screen name="CommunityHome" component={CommunityScreen} /><Community.Screen name="TeamDetail" component={TeamDetailScreen} /><Community.Screen name="TeamWorkspace" component={TeamWorkspaceScreen} /><Community.Screen name="TeamTaskEditor" component={TeamTaskEditorScreen} /><Community.Screen name="CreateTeam" component={CreateTeamScreen} /></Community.Navigator>;
const ProfileStack = () => <Profile.Navigator screenOptions={stackOptions}><Profile.Screen name="ProfileHome" component={ProfileScreen} /><Profile.Screen name="CheckIn" component={CheckInScreen} /><Profile.Screen name="EditProfile" component={EditProfileScreen} /><Profile.Screen name="ExperienceEditor" component={ExperienceEditorScreen} /><Profile.Screen name="ExperienceDetail" component={ExperienceDetailScreen} />{eventJourney(Profile)}</Profile.Navigator>;

const TABS: Record<keyof MainTabParamList, { label: string; icon: TechIconName }> = {
  DiscoverTab: { label: 'Keşfet', icon: 'discover' },
  EventsTab: { label: 'Etkinlikler', icon: 'event' },
  OpportunitiesTab: { label: 'Fırsatlar', icon: 'opportunity' },
  CommunityTab: { label: 'Topluluk', icon: 'community' },
  ProfileTab: { label: 'Profil', icon: 'profile' },
};

function MainTabs() {
  const { sideNavigation } = useLayout();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarPosition: sideNavigation ? 'left' : 'bottom',
        tabBarVariant: sideNavigation ? 'material' : 'uikit',
        tabBarLabelPosition: sideNavigation ? 'below-icon' : undefined,
        tabBarLabel: TABS[route.name].label, // always visible: icons never stand alone
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.bodySemibold, fontSize: 12 },
        tabBarAllowFontScaling: false,
        tabBarStyle: sideNavigation
          ? { backgroundColor: colors.surface, borderRightColor: colors.border, borderRightWidth: 1, minWidth: 96, paddingTop: 24 }
          : { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: layout.bottomNavHeight, paddingTop: 6 },
        tabBarIcon: ({ color }) => <TechIcon name={TABS[route.name].icon} color={color} size={22} />,
      })}
    >
      <Tab.Screen name="DiscoverTab" component={DiscoverStack} />
      <Tab.Screen name="EventsTab" component={EventsStack} />
      <Tab.Screen name="OpportunitiesTab" component={OpportunitiesStack} />
      <Tab.Screen name="CommunityTab" component={CommunityStack} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { prefs, update } = usePrefs();
  const { userId } = useSession(); const account = useAccountState();
  // A signed-in person whose server profile is complete has been onboarded already (e.g. on another device).
  const serverOnboarded = !!userId && account.data?.profile_complete === true;
  useEffect(() => { if (serverOnboarded && !prefs.onboarded) update({ onboarded: true }); }, [serverOnboarded, prefs.onboarded, update]);
  return (
    <Root.Navigator screenOptions={stackOptions}>
      {!(prefs.onboarded || serverOnboarded) ? <Root.Screen name="Onboarding" component={OnboardingScreen} /> : (
        <>
          <Root.Screen name="Main" component={MainTabs} />
          <Root.Group screenOptions={{ presentation: 'modal' }}>
            <Root.Screen name="AuthEmail" component={AuthEmailScreen} />
            <Root.Screen name="AuthOtp" component={AuthOtpScreen} />
            <Root.Screen name="ProfileBootstrap" component={ProfileBootstrapScreen} />
          </Root.Group>
        </>
      )}
    </Root.Navigator>
  );
}
