import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://confide.gg'),
  title: {
    default: 'Confide - Secure Encrypted Messaging for Communities',
    template: '%s | Confide'
  },
  description: 'End-to-end encrypted messaging platform combining Discord\'s community features with Signal\'s privacy. Self-hostable, open-source, with post-quantum cryptography. Available on Windows, macOS, and Linux.',
  keywords: [
    'encrypted messaging',
    'secure chat',
    'end-to-end encryption',
    'privacy',
    'open source messaging',
    'self-hosted chat',
    'Discord alternative',
    'Signal alternative',
    'post-quantum cryptography',
    'federated messaging',
    'secure communities',
    'encrypted voice calls',
    'disappearing messages',
    'private messaging',
    'E2EE chat',
    'Confide'
  ],
  authors: [{ name: 'Confide Team' }],
  creator: 'Confide',
  publisher: 'Confide',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://confide.gg',
    siteName: 'Confide',
    title: 'Confide - Secure Encrypted Messaging for Communities',
    description: 'End-to-end encrypted messaging platform with Discord-like communities and Signal-level privacy. Self-hostable, open-source, post-quantum secure.',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Confide - Secure Encrypted Messaging',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Confide - Secure Encrypted Messaging for Communities',
    description: 'End-to-end encrypted messaging with Discord features and Signal privacy. Open-source, self-hostable, post-quantum secure.',
    images: ['/images/og-image.png'],
    creator: '@confide_gg',
  },
  icons: {
    icon: '/icons/favicon.ico',
    shortcut: '/icons/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://confide.gg',
  },
  verification: {
    google: 'your-google-verification-code',
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Confide',
    applicationCategory: 'CommunicationApplication',
    operatingSystem: ['Windows', 'macOS', 'Linux'],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'End-to-end encrypted messaging platform combining Discord\'s community features with Signal\'s privacy. Self-hostable, open-source, with post-quantum cryptography.',
    url: 'https://confide.gg',
    downloadUrl: 'https://github.com/confide-gg/confide/releases',
    softwareVersion: '0.24.0',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      ratingCount: '100',
    },
    featureList: [
      'End-to-end encryption',
      'Post-quantum cryptography',
      'Self-hosted servers',
      'Voice and video calls',
      'Disappearing messages',
      'File sharing',
      'Open source',
    ],
    creator: {
      '@type': 'Organization',
      name: 'Confide',
      url: 'https://confide.gg',
    },
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
