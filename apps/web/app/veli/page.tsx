import type { Metadata } from 'next';
import { Header } from '@/components/Chrome';
import { GuardianConsent } from './GuardianConsent';

export const metadata: Metadata = { title: 'Veli onayı', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function GuardianPage() {
  return (<><Header /><main className="page"><GuardianConsent /></main></>);
}
