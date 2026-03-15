import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Roviq Institute Portal',
    template: '%s | Roviq',
  },
  description: 'Institute management portal powered by Roviq',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    type: 'website',
    siteName: 'Roviq Institute Portal',
    title: 'Roviq Institute Portal',
    description: 'Institute management portal powered by Roviq',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
