import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Agroesusu — Grow Your Farm, Grow Your Money',
  description: 'An agricultural fintech platform empowering farmers with seamless saving, low-interest micro-loans, and automated secure wallet services.',
  openGraph: {
    title: 'Agroesusu — Grow Your Farm, Grow Your Money',
    description: 'An agricultural fintech platform empowering farmers with seamless saving, low-interest micro-loans, and automated secure wallet services.',
    url: 'https://agroesusu.com',
    siteName: 'Agroesusu',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
