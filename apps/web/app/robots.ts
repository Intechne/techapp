import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/veli', '/auth-callback', '/cv/'] }], sitemap: `${SITE.origin}/sitemap.xml` };
}
