import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai, Prompt } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';

const bodyFont = IBM_Plex_Sans_Thai({
  subsets: ['latin', 'thai'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const displayFont = Prompt({
  subsets: ['latin', 'thai'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SomDun',
  description: 'Track your daily calories and protein with beauty.',
};

import { Providers } from '@/context/Providers';
import BottomNav from '@/components/BottomNav';
import OfflineIndicator from '@/components/OfflineIndicator';
import PaywallModal from '@/components/PaywallModal';

function BottomNavWrapper() {
  return (
    <Suspense fallback={null}>
      <BottomNav />
    </Suspense>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        {/* SVG Defs injected here globally */}
        <svg style={{ width: 0, height: 0, position: 'absolute' }} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="cal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e4e4e7" />
              <stop offset="100%" stopColor="#a1a1aa" />
            </linearGradient>
            <linearGradient id="pro-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f4f4f5" />
              <stop offset="100%" stopColor="#d4d4d8" />
            </linearGradient>
            <linearGradient id="fat-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fafafa" />
              <stop offset="100%" stopColor="#e4e4e7" />
            </linearGradient>
            <linearGradient id="water-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e4e4e7" />
              <stop offset="100%" stopColor="#a1a1aa" />
            </linearGradient>
          </defs>
        </svg>
        <Providers>
          <OfflineIndicator />
          <PaywallModal />
          {children}
          <BottomNavWrapper />
        </Providers>
      </body>
    </html>
  );
}
