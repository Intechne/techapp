/**
 * The one public web origin of TechApp. The marketing site, shareable content links, the guardian consent page and
 * the universal-link association files all live under it. Change it here, in supabase/config.toml and in docs/DOMAIN.md.
 */
export const WEB_ORIGIN = 'https://techapp.intechne.com.tr';

/** Pages on WEB_ORIGIN the app links to (Yardım, Yasal). The app itself holds no legal text: it opens WEB_ORIGIN + path. */
export const WEB_PATHS = { support: '/destek', privacy: '/gizlilik', terms: '/kosullar', deleteAccount: '/hesap-silme' } as const;
