import React from 'react';
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
import { OpportunitiesScreen } from '../features/opportunities/OpportunitiesScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
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
    </>
  );
}

const DiscoverStack = () => <Discover.Navigator screenOptions={stackOptions}><Discover.Screen name="DiscoverHome" component={DiscoverScreen} />{eventJourney(Discover)}</Discover.Navigator>;
const EventsStack = () => <Events.Navigator screenOptions={stackOptions}><Events.Screen name="EventsList" component={EventsListScreen} />{eventJourney(Events)}</Events.Navigator>;
const OpportunitiesStack = () => <Opportunities.Navigator screenOptions={stackOptions}><Opportunities.Screen name="OpportunitiesHome" component={OpportunitiesScreen} /></Opportunities.Navigator>;
const CommunityStack = () => <Community.Navigator screenOptions={stackOptions}><Community.Screen name="CommunityHome" component={CommunityScreen} /></Community.Navigator>;
const ProfileStack = () => <Profile.Navigator screenOptions={stackOptions}><Profile.Screen name="ProfileHome" component={ProfileScreen} /><Profile.Screen name="CheckIn" component={CheckInScreen} />{eventJourney(Profile)}</Profile.Navigator>;

const TABS: Record<keyof MainTabParamList, { label: string; icon: TechIconName }> = {
  DiscoverTab: { label: 'Keşfet', icon: 'discover' },
  EventsTab: { label: 'Etkinlikler', icon: 'event' },
  OpportunitiesTab: { label: 'Fırsatlar', icon: 'opportunity' },
  CommunityTab: { label: 'Topluluk', icon: 'community' },
  ProfileTab: { label: 'Profil', icon: 'profile' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabel: TABS[route.name].label, // always visible: icons never stand alone
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.bodySemibold, fontSize: 12 },
        tabBarAllowFontScaling: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: layout.bottomNavHeight, paddingTop: 6 },
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
  const { prefs } = usePrefs();
  return (
    <Root.Navigator screenOptions={stackOptions}>
      {!prefs.onboarded ? <Root.Screen name="Onboarding" component={OnboardingScreen} /> : (
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
