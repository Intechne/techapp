import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Content-Security-Policy for the built admin panel. Injected at build time only (the dev server needs inline
 * scripts and a websocket for hot reload). connect-src is the exact Supabase origin of this build, not a wildcard.
 * frame-ancestors cannot be set from a <meta> tag: public/_headers carries it for the hosting layer.
 */
function csp(supabaseUrl: string | undefined): Plugin {
  return {
    name: 'techapp-admin-csp',
    apply: 'build',
    transformIndexHtml(html) {
      let origin: URL;
      try { origin = new URL(supabaseUrl ?? ''); } catch { throw new Error('VITE_SUPABASE_URL must be set to build the admin panel'); }
      const policy = [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self' https://fonts.googleapis.com",
        'font-src https://fonts.gstatic.com',
        "img-src 'self' data:",
        `connect-src ${origin.origin}`,
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        ...(origin.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
      ].join('; ');
      return html.replace('<meta charset="utf-8">', `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}">`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return { plugins: [react(), csp(env.VITE_SUPABASE_URL)] };
});
