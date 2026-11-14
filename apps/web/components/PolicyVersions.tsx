import { formatPolicyDate, getPublishedPolicies, policyLabel, type PolicyDocument } from '@/lib/policies';

/** "Sürüm …, yayım tarihi …" lines from the server. Renders nothing until a non-draft version is published. */
export async function PolicyVersions({ purposes }: { purposes: PolicyDocument[] }) {
  const published = await getPublishedPolicies(purposes);
  if (published.length === 0) return null;
  return (
    <ul className="muted" style={{ fontSize: 14, marginTop: 12, paddingLeft: 18 }}>
      {published.map((p) => (
        <li key={p.purpose}>{policyLabel(p.purpose)}: sürüm <code>{p.version}</code>, yayım tarihi {formatPolicyDate(p.published_at)}</li>
      ))}
    </ul>
  );
}
