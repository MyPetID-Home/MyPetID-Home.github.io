import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyPetID Home',
  description: 'Pet ID profiles, NFC/QR scan recovery, and owner dashboards.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
