import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { TechIcon, colors, fonts, layout, radius, space, type, type TechIconName } from '../design-system';
import { AuthEmailScreen } from '../features/auth/AuthEmailScreen';
import { AuthOtpScreen } from '../features/auth/AuthOtpScreen';
import { ProfileBootstrapScreen } from '../features/auth/ProfileBootstrapScreen';
import { CheckInScreen } from '../features/checkin/CheckInScreen';
import { CommunityScreen } from '../features/community/CommunityScreen';
import { DiscoverScreen } from '../features/discovery/DiscoverScreen';
import { SearchScreen } from '../features/search/SearchScreen';
import { EventDetailScreen } from '../features/events/EventDetailScreen';
import { EventRegistrationScreen } from '../features/events/EventRegistrationScreen';
import { EventsListScreen } from '../features/events/EventsListScreen';
import { EventFiltersScreen } from '../features/events/EventFiltersScreen';
import { MyRegistrationsScreen } from '../features/events/MyRegistrationsScreen';
import { ParticipationCardScreen } from '../features/events/ParticipationCardScreen';
import { RegistrationStatusScreen } from '../features/events/RegistrationStatusScreen';
import { GuardianRequestScreen } from '../features/guardian/GuardianRequestScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { usePrefs } from '../features/onboarding/PrefsProvider';
import { useAccountState, useSession } from '../features/auth/SessionProvider';
import { OpportunitiesScreen } from '../features/opportunities/OpportunitiesScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { NotificationSettingsScreen } from '../features/settings/NotificationSettingsScreen';
import { PrivacyScreen } from '../features/settings/PrivacyScreen';
import { ConsentCenterScreen } from '../features/settings/ConsentCenterScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { SavedScreen } from '../features/saved/SavedScreen';
import { EditProfileScreen } from '../features/profile/EditProfileScreen';
import { ExperienceEditorScreen } from '../features/profile/ExperienceEditorScreen';
import { ExperienceDetailScreen } from '../features/profile/ExperienceDetailScreen';
import { TeamDetailScreen } from '../features/teams/TeamDetailScreen';
import { TeamWorkspaceScreen } from '../features/teams/TeamWorkspaceScreen';
import { TeamTaskEditorScreen } from '../features/teams/TeamTaskEditorScreen';
import { TeamProjectEditorScreen } from '../features/teams/TeamProjectEditorScreen';
import { RecruitmentPostEditorScreen } from '../features/teams/RecruitmentPostEditorScreen';
import { CreateTeamScreen } from '../features/teams/CreateTeamScreen';
import { DeadlinesScreen } from '../features/opportunities/DeadlinesScreen';
import { OrganizationScreen } from '../features/organizations/OrganizationScreen';
import { OpportunityDetailScreen } from '../features/opportunities/OpportunityDetailScreen';
import { OpportunityApplyScreen } from '../features/opportunities/OpportunityApplyScreen';
import { MyApplicationsScreen } from '../features/opportunities/MyApplicationsScreen';
import { CourseListScreen } from '../features/learning/CourseListScreen';
import { CourseDetailScreen } from '../features/learning/CourseDetailScreen';
import { LessonScreen } from '../features/learning/LessonScreen';
import { VolunteerHubScreen } from '../features/volunteers/VolunteerHubScreen';
import { useLayout } from '../design-system';
import { env } from '../lib/env';
import type { CommunityStackParamList, DiscoverStackParamList, EventsStackParamList, MainTabParamList, OpportunitiesStackParamList, ProfileStackParamList, RootStackParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const Discover = createNativeStackNavigator<DiscoverStackParamList>();
const Events = createNativeStackNavigator<EventsStackParamList>();
const Opportunities = createNativeStackNavigator<OpportunitiesStackParamList>();
const Community = createNativeStackNavigator<CommunityStackParamList>();
const Profile = createNativeStackNavigator<ProfileStackParamList>();

/**
 * Developer-only design preview. The condition is written out (not wrapped in a helper) and the module is `require`d
 * only inside it, so Metro folds `__DEV__` to false in release exports and leaves the preview and its fixtures out of
 * the bundle. `npm run check:no-dev-preview` proves it on a real export.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DesignPreviewScreen: React.ComponentType | null = __DEV__ && env.appEnv === 'local' ? require('../dev/DesignPreviewScreen').DesignPreviewScreen : null;

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: colors.canvas } } as const;

/** Gelişim (course list → course → lesson) is shared by Keşfet, Etkinlikler and Profil (Kaydedilenler); each tab keeps its own history. */
function learningJourney<T extends typeof Discover | typeof Events | typeof Profile>(Stack: T) {
  const S = Stack as typeof Events;
  return (
    <>
      <S.Screen name="CourseList" component={CourseListScreen} />
      <S.Screen name="CourseDetail" component={CourseDetailScreen} />
      <S.Screen name="Lesson" component={LessonScreen} />
    </>
  );
}

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
      <S.Screen name="Organization" component={OrganizationScreen} />
    </>
  );
}

const DiscoverStack = () => <Discover.Navigator screenOptions={stackOptions}><Discover.Screen name="DiscoverHome" component={DiscoverScreen} /><Discover.Screen name="Notifications" component={NotificationsScreen} /><Discover.Screen name="Search" component={SearchScreen} />{eventJourney(Discover)}{learningJourney(Discover)}</Discover.Navigator>;
/**
 * Etkinlikler filters: a native form sheet resting at 60 % or full height (react-native-screens 4.26). On the root stack, not
 * in the Events tab: inside a tab Android draws the tab bar over the sheet and it stays tappable.
 */
const filterSheetOptions: NativeStackNavigationOptions = { presentation: 'formSheet', sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, sheetCornerRadius: radius.hero, contentStyle: { backgroundColor: colors.surface } };
const EventsStack = () => <Events.Navigator screenOptions={stackOptions}><Events.Screen name="EventsList" component={EventsListScreen} />{eventJourney(Events)}{learningJourney(Events)}</Events.Navigator>;
const OpportunitiesStack = () => <Opportunities.Navigator screenOptions={stackOptions}><Opportunities.Screen name="OpportunitiesHome" component={OpportunitiesScreen} /><Opportunities.Screen name="Deadlines" component={DeadlinesScreen} /><Opportunities.Screen name="OpportunityDetail" component={OpportunityDetailScreen} /><Opportunities.Screen name="OpportunityApply" component={OpportunityApplyScreen} /><Opportunities.Screen name="MyApplications" component={MyApplicationsScreen} /><Opportunities.Screen name="Organization" component={OrganizationScreen} /></Opportunities.Navigator>;
const CommunityStack = () => <Community.Navigator screenOptions={stackOptions}><Community.Screen name="CommunityHome" component={CommunityScreen} /><Community.Screen name="TeamDetail" component={TeamDetailScreen} /><Community.Screen name="TeamWorkspace" component={TeamWorkspaceScreen} /><Community.Screen name="TeamTaskEditor" component={TeamTaskEditorScreen} /><Community.Screen name="TeamProjectEditor" component={TeamProjectEditorScreen} /><Community.Screen name="RecruitmentPostEditor" component={RecruitmentPostEditorScreen} /><Community.Screen name="CreateTeam" component={CreateTeamScreen} /></Community.Navigator>;
const ProfileStack = () => <Profile.Navigator screenOptions={stackOptions}><Profile.Screen name="ProfileHome" component={ProfileScreen} /><Profile.Screen name="CheckIn" component={CheckInScreen} /><Profile.Screen name="Saved" component={SavedScreen} /><Profile.Screen name="Notifications" component={NotificationsScreen} /><Profile.Screen name="EditProfile" component={EditProfileScreen} /><Profile.Screen name="Settings" component={SettingsScreen} /><Profile.Screen name="NotificationSettings" component={NotificationSettingsScreen} /><Profile.Screen name="Privacy" component={PrivacyScreen} /><Profile.Screen name="ConsentCenter" component={ConsentCenterScreen} /><Profile.Screen name="ExperienceEditor" component={ExperienceEditorScreen} /><Profile.Screen name="ExperienceDetail" component={ExperienceDetailScreen} />{eventJourney(Profile)}{learningJourney(Profile)}</Profile.Navigator>;

/** Bottom tab label cap (dp): wide enough for "Etkinlikler" at the 12 pt minimum (57 dp) with a little slack, narrow enough for 5 tabs at 320 dp. */
const TAB_LABEL_MAX_WIDTH = 64;

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
        // 5 tabs at 320 dp leave 54 dp of label width after the item's 5 dp padding, but "Etkinlikler" needs 57 dp at the 12 pt minimum:
        // let the label use the padding (negative margin) instead of shrinking the font or hiding the text.
        tabBarLabelStyle: { fontFamily: fonts.bodySemibold, fontSize: type.caption.fontSize, ...(sideNavigation ? null : { alignSelf: 'stretch' as const, maxWidth: TAB_LABEL_MAX_WIDTH, textAlign: 'center' as const, marginHorizontal: -space[1] }) },
        tabBarAllowFontScaling: false,
        tabBarStyle: sideNavigation
          ? { backgroundColor: colors.surface, borderRightColor: colors.border, borderRightWidth: 1, minWidth: 96, paddingTop: 24 }
          : { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: layout.bottomNavHeight, paddingTop: 6 },
        tabBarIcon: ({ color, focused }) => <TechIcon name={TABS[route.name].icon} color={color} size={22} filled={focused} />,
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
          {DesignPreviewScreen && <Root.Screen name="DesignPreview" component={DesignPreviewScreen} />}
          <Root.Screen name="EventFilters" component={EventFiltersScreen} options={filterSheetOptions} />
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
