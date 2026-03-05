import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roviq Institute Portal',
  description: 'Institute portal for Roviq education platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
