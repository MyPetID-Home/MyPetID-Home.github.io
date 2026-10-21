import { NextResponse, type NextRequest } from 'next/server';

// Vercel-only (the GitHub Pages static build moves this file aside, like app/api).
//
// next.config.mjs sets skipTrailingSlashRedirect so /api routes are served both with
// and without a trailing slash (Stripe does not follow redirects for webhooks).
// This proxy restores the usual "add a trailing slash" redirect for pages.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.endsWith('/')) {
    // Build a plain URL: NextURL re-normalises the pathname and would drop the slash.
    const url = new URL(request.url);
    url.pathname = `${url.pathname}/`;
    return NextResponse.redirect(url.toString(), 308);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: skip /api, Next internals, and any path whose last segment has a
  // file extension (public assets such as /sw.js or /manifest.webmanifest).
  matcher: ['/((?!api(?:/|$)|_next/|.*\\.[^/]+$).+)'],
};
