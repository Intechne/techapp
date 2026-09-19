import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import { WEB_ORIGIN } from '../lib/domain';
import type { RootStackParamList } from './types';

/** techapp://events/<id> and https://techapp.intechne.com.tr/events/<id> (universal links need store/domain setup, see docs/RELEASE.md). */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), WEB_ORIGIN],
  config: {
    // A deep-linked detail still gets the list underneath, so Back lands somewhere sensible.
    initialRouteName: 'Main',
    screens: {
      Main: {
        screens: {
          DiscoverTab: { screens: { DiscoverHome: '' } },
          EventsTab: { screens: { EventsList: 'events', EventDetail: 'events/:eventId', RegistrationStatus: 'registrations/:registrationId' } },
          OpportunitiesTab: { screens: { OpportunitiesHome: 'opportunities' } },
          CommunityTab: { screens: { CommunityHome: 'community' } },
          ProfileTab: { screens: { ProfileHome: 'profile' } },
        },
      },
    },
  },
};
