/** @type {import('next').NextConfig} */
const isStaticExport = process.env.BUILD_STATIC_EXPORT === '1';

// Static GitHub Pages copies of the app that call this (Vercel) app's /api routes.
// Override with a comma-separated CORS_ALLOWED_ORIGINS env var at build time.
const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://mypetid-home.github.io,https://mypetid.github.io')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const nextConfig = {
  ...(isStaticExport ? { output: 'export' } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
  ...(isStaticExport ? {} : {
    // Next's automatic trailing-slash redirect (308) would also apply to /api routes,
    // and webhook senders such as Stripe do not follow redirects. Disable it here and
    // re-apply it for pages only in proxy.ts, so /api/stripe/webhook and
    // /api/stripe/webhook/ are both served directly.
    skipTrailingSlashRedirect: true,
    async headers() {
      // CORS for the browser-called API routes, only for the listed origins. Bearer
      // tokens are sent in the Authorization header (no cookies), so credentials are
      // not allowed. Webhooks and OAuth callbacks are server-to-server/redirects and
      // are unaffected.
      return corsOrigins.map((origin) => ({
        source: '/api/:path*',
        has: [{ type: 'header', key: 'origin', value: escapeRegex(origin) }],
        headers: [
          { key: 'Access-Control-Allow-Origin', value: origin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
          { key: 'Access-Control-Max-Age', value: '600' },
          { key: 'Vary', value: 'Origin' },
        ],
      }));
    },
  }),
};

export default nextConfig;
