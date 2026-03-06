import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import './global.css';

export const metadata: Metadata = {
  title: '404 - Page Not Found | Roviq Institute',
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body className="flex min-h-screen items-center justify-center bg-background antialiased">
        <div className="text-center">
          <h1 className="text-4xl font-bold">404</h1>
          <p className="mt-2 text-muted-foreground">Page not found</p>
          <a href="/" className="mt-4 inline-block text-sm underline">
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
