import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confide vs Discord: Open Source Discord Alternative for Gaming Communities",
  description: "Compare Confide and Discord for gaming, friends, and communities. Confide is an open source, self-hostable Discord alternative with end-to-end encryption for groups and servers.",
  keywords: [
    "Discord alternative",
    "open source Discord",
    "self-hosted Discord",
    "Discord for gaming",
    "encrypted Discord alternative",
    "private Discord",
    "Discord alternative for friends",
    "Discord alternative for communities",
    "Discord alternative for groups",
    "self-host Discord",
    "open source chat",
    "gaming community platform",
    "encrypted group chat",
    "private gaming server",
    "Discord replacement",
  ],
  openGraph: {
    title: "Confide vs Discord: Open Source Discord Alternative for Gaming Communities",
    description: "Compare Confide and Discord for gaming, friends, and communities. Open source, self-hostable, with end-to-end encryption.",
    url: "https://confide.gg/compare/discord",
    type: "article",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Confide vs Discord Comparison",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Confide vs Discord: Open Source Discord Alternative",
    description: "Open source, self-hostable Discord alternative for gaming communities and friend groups. End-to-end encrypted.",
    images: ["/images/og-image.png"],
  },
  alternates: {
    canonical: "https://confide.gg/compare/discord",
  },
};

export default function DiscordComparisonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Confide vs Discord: Open Source Discord Alternative for Gaming Communities",
    description: "Compare Confide and Discord for gaming, friends, and communities. Confide is an open source, self-hostable Discord alternative with end-to-end encryption for groups and servers.",
    author: {
      "@type": "Organization",
      name: "Confide",
      url: "https://confide.gg",
    },
    publisher: {
      "@type": "Organization",
      name: "Confide",
      url: "https://confide.gg",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://confide.gg/compare/discord",
    },
    about: [
      {
        "@type": "SoftwareApplication",
        name: "Confide",
        applicationCategory: "CommunicationApplication",
      },
      {
        "@type": "SoftwareApplication",
        name: "Discord",
        applicationCategory: "CommunicationApplication",
      },
    ],
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
