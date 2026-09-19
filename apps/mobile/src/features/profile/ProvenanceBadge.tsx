import React from 'react';
import { Tag } from '../../design-system';
import type { CvAttestation } from './cvSchema';
import { PROVENANCE_VIEW } from './labels';
import { provenanceOf } from './logic';

/** Shows where an entry's credibility comes from. Only a currently valid verification gets the verified look and the organisation's name. */
export function ProvenanceBadge({ attestation }: { attestation: CvAttestation | null }) {
  const provenance = provenanceOf(attestation);
  const view = PROVENANCE_VIEW[provenance];
  const label = provenance === 'verified' && attestation?.organization ? `${view.label} · ${attestation.organization.toLocaleUpperCase('tr')}` : view.label;
  return <Tag label={label} tone={view.tone} icon={view.icon} />;
}
