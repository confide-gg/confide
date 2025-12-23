import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features - End-to-End Encrypted Messaging for Gaming Communities",
  description: "Explore Confide features: end-to-end encryption, servers and channels, disappearing messages, 250MB file uploads, voice and video calls, Spotify integration, self-hosting, and more. Free and open source.",
  keywords: [
    "encrypted messaging features",
    "Discord alternative features",
    "end-to-end encryption",
    "disappearing messages",
    "self-hosted chat",
    "open source chat",
    "gaming community features",
    "encrypted voice calls",
    "encrypted video calls",
    "file sharing encrypted",
    "Spotify integration chat",
    "private messaging",
    "secure group chat",
    "encrypted servers",
  ],
  openGraph: {
    title: "Confide Features - Encrypted Messaging for Gaming Communities",
    description: "End-to-end encryption, servers and channels, disappearing messages, 250MB uploads, voice and video calls, and more. Free and open source.",
    url: "https://confide.gg/features",
    type: "website",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Confide Features",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Confide Features - Encrypted Messaging",
    description: "End-to-end encryption, servers, disappearing messages, 250MB uploads, calls, and more. Free and open source.",
    images: ["/images/og-image.png"],
  },
  alternates: {
    canonical: "https://confide.gg/features",
  },
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Confide Features",
    description: "Explore all features of Confide - the encrypted messaging platform for gaming communities, friends, and groups.",
    url: "https://confide.gg/features",
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Confide",
      applicationCategory: "CommunicationApplication",
      operatingSystem: ["Windows", "macOS", "Linux"],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "End-to-end encryption",
        "Servers and channels",
        "Disappearing messages",
        "250MB file uploads",
        "Voice and video calls",
        "Screen sharing",
        "Spotify integration",
        "Self-hosted servers",
        "Open source (GPL-3)",
        "Custom emojis",
        "Animated avatars",
        "Role-based permissions",
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
