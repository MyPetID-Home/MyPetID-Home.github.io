import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { PwaInstallClient } from '../components/pwa-install-client';
import { AppFooter } from '../components/app-footer';
import { RouteLoader } from '../components/bone-loader';
import { ServiceStatusBanner } from '../components/status-screen';
import { SkipLink } from '../components/skip-link';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'MyPetID: your dog’s ID, care and lost-pet plan',
  description: 'A smart NFC/QR tag and app for your dog: a public profile finders can scan, care reminders, walks, documents and lost-pet alerts.',
  manifest: '/manifest.webmanifest',
  applicationName: 'MyPetID',
  appleWebApp: { capable: true, title: 'MyPetID', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/images/logo/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/images/logo/favicon-48.png', sizes: '48x48', type: 'image/png' }, { url: '/images/logo/favicon-96.png', sizes: '96x96', type: 'image/png' }, { url: '/images/logo/favicon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/images/logo/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d1020',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// The light/dark theme and palette are chosen in App settings and saved in this browser
// ('mypetid.dashboard'). Apply them before first paint on every page, including the public
// tag/profile pages, so they match the app and don't flash dark first. <html> gets
// suppressHydrationWarning because this sets data-theme/data-palette before React hydrates.
const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('mypetid.dashboard')||'{}');var d=document.documentElement;if(s.theme==='light'||s.theme==='dark')d.setAttribute('data-theme',s.theme);if(typeof s.palette==='string'&&/^[a-z]{1,20}$/.test(s.palette))d.setAttribute('data-palette',s.palette);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body><Script id="mypetid-theme" strategy="beforeInteractive">{THEME_SCRIPT}</Script><SkipLink />{children}<AppFooter /><PwaInstallClient /><RouteLoader /><ServiceStatusBanner /></body>
    </html>
  );
}
