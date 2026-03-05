import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roviq Admin Portal',
  description: 'Admin portal for Roviq education platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
