import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Roviq Admin Portal',
    template: '%s | Roviq Admin',
  },
  description: 'Admin portal for Roviq institute management platform',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    type: 'website',
    siteName: 'Roviq Admin Portal',
    title: 'Roviq Admin Portal',
    description: 'Admin portal for Roviq institute management platform',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
