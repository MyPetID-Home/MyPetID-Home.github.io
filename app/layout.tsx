import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaInstallClient } from '../components/pwa-install-client';
import { AppFooter } from '../components/app-footer';

export const metadata: Metadata = {
  title: 'MyPetID Home',
  description: 'Pet ID profiles, NFC/QR scan recovery, and owner dashboards.',
  manifest: '/manifest.webmanifest',
  applicationName: 'MyPetID',
  appleWebApp: { capable: true, title: 'MyPetID', statusBarStyle: 'black-translucent' },
  icons: {
    icon: '/images/logo/MyPetID-Logo_Resized.jpg',
    apple: '/images/logo/MyPetID-Logo_Resized.jpg',
  },
};

export const viewport: Viewport = {
  themeColor: '#101712',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<AppFooter /><PwaInstallClient /></body>
    </html>
  );
}
