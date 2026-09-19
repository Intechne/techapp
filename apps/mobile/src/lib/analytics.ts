/** Vendor-neutral product analytics. No PII: ids and enums only. A real sink is plugged in at release hardening. */
export type AnalyticsEvent =
  | 'onboarding_started' | 'onboarding_completed' | 'discovery_item_opened' | 'event_opened'
  | 'registration_started' | 'registration_submitted' | 'guardian_required' | 'registration_confirmed'
  | 'opportunity_opened' | 'application_submitted' | 'team_join_requested' | 'experience_created'
  | 'verification_requested' | 'lesson_completed';

type Props = Record<string, string | number | boolean | null>;
export interface AnalyticsSink { track(event: AnalyticsEvent, props: Props): void }

let sink: AnalyticsSink = { track: (event, props) => { if (__DEV__) console.debug('[analytics]', event, props); } };
export const setAnalyticsSink = (next: AnalyticsSink) => { sink = next; };
export const track = (event: AnalyticsEvent, props: Props = {}) => { try { sink.track(event, props); } catch { /* never break UX */ } };
