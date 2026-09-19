import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/destek', '/hesap-silme'].map((path) => ({ url: `${SITE.origin}${path}`, changeFrequency: 'weekly' as const }));
}
