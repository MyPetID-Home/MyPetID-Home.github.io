import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { PwaInstallClient } from '../components/pwa-install-client';
import { AppFooter } from '../components/app-footer';
import { RouteLoader } from '../components/bone-loader';
import { ServiceStatusBanner } from '../components/status-screen';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'MyPetID: your dog’s ID, care and lost-pet plan',
  description: 'A smart NFC/QR tag and app for your dog: a public profile finders can scan, care reminders, walks, documents and lost-pet alerts.',
  manifest: '/manifest.webmanifest',
  applicationName: 'MyPetID',
  appleWebApp: { capable: true, title: 'MyPetID', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/images/logo/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/images/logo/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d1020',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}<AppFooter /><PwaInstallClient /><RouteLoader /><ServiceStatusBanner /></body>
    </html>
  );
}
