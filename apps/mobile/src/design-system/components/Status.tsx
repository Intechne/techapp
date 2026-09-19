import React from 'react';
import { Tag } from './Chips';
import type { TechIconName } from '../TechIcon';
import type { RegistrationStatus as RegStatus, GuardianStatus } from '../../lib/database.types';

type Tone = 'iris' | 'moss' | 'neutral' | 'danger' | 'apricot';
interface StatusView { label: string; tone: Tone; icon?: TechIconName }

/** Single source for status wording: status strings are never re-typed in screens. */
export const registrationStatusView: Record<RegStatus, StatusView> = {
  confirmed: { label: 'KATILIMIN ONAYLANDI', tone: 'moss', icon: 'check' },
  waitlisted: { label: 'BEKLEME LİSTESİNDESİN', tone: 'apricot', icon: 'clock' },
  pending_guardian: { label: 'VELİ ONAYI BEKLENİYOR', tone: 'iris', icon: 'shield' },
  pending_review: { label: 'DEĞERLENDİRMEDE', tone: 'iris', icon: 'clock' },
  cancelled: { label: 'İPTAL EDİLDİ', tone: 'neutral' },
  rejected: { label: 'UYGUN BULUNMADI', tone: 'danger' },
  expired: { label: 'SÜRESİ DOLDU', tone: 'neutral' },
};

export const guardianStatusView: Record<GuardianStatus | 'not_sent', StatusView> = {
  not_sent: { label: 'VELİ ONAYI GEREKLİ', tone: 'apricot', icon: 'shield' },
  pending: { label: 'VELİ ONAYI GÖNDERİLDİ · BEKLENİYOR', tone: 'iris', icon: 'clock' },
  approved: { label: 'VELİ ONAYLADI', tone: 'moss', icon: 'check' },
  denied: { label: 'VELİ REDDETTİ', tone: 'danger' },
  expired: { label: 'BAĞLANTININ SÜRESİ DOLDU', tone: 'neutral' },
  revoked: { label: 'ONAY GERİ ÇEKİLDİ', tone: 'neutral' },
};

export const applicationStatusView = {
  draft: { label: 'TASLAK', tone: 'neutral' },
  submitted: { label: 'GÖNDERİLDİ', tone: 'iris' },
  in_review: { label: 'İNCELEMEDE', tone: 'iris' },
  info_requested: { label: 'EK BİLGİ İSTENİYOR', tone: 'apricot' },
  accepted: { label: 'KABUL EDİLDİ', tone: 'moss' },
  declined: { label: 'UYGUN BULUNMADI', tone: 'danger' },
  withdrawn: { label: 'GERİ ÇEKİLDİ', tone: 'neutral' },
  closed: { label: 'KAPANDI', tone: 'neutral' },
} as const satisfies Record<string, StatusView>;

export function StatusBadge({ view }: { view: StatusView }) {
  return <Tag label={view.label} tone={view.tone} icon={view.icon} />;
}
export const RegistrationStatus = ({ status }: { status: RegStatus }) => <StatusBadge view={registrationStatusView[status]} />;
export const ApplicationStatus = ({ status }: { status: keyof typeof applicationStatusView }) => <StatusBadge view={applicationStatusView[status]} />;
