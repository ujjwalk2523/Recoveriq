import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppStateProvider } from '@/lib/store/app-state-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RecoverIQ • Revenue Recovery & Decision Platform',
  description:
    'Payment recovery platform for merchants. Maximize expected recovery value, simulate strategy yields, and automate approval workflows.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-slate-200 selection:text-slate-900`}
      >
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
