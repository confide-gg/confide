export const PRIMARY = "#c9ed7b";
export const BG = "#050507";

export interface ComparisonFeature {
  name: string;
  confide: boolean | string;
  competitor: boolean | string;
  description?: string;
}

export interface ComparisonData {
  slug: string;
  competitor: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroHighlight: string;
  introText: string;
  features: ComparisonFeature[];
  confideAdvantages: string[];
  competitorAdvantages: string[];
  verdict: string;
  ctaText: string;
}

export const comparisons: Record<string, ComparisonData> = {
  discord: {
    slug: "discord",
    competitor: "Discord",
    tagline: "Privacy-first alternative to Discord",
    metaTitle: "Confide vs Discord: Open Source Discord Alternative for Gaming Communities",
    metaDescription: "Compare Confide and Discord for gaming, friends, and communities. Confide is an open source, self-hostable Discord alternative with end-to-end encryption for groups and servers.",
    heroTitle: "Confide vs",
    heroHighlight: "Discord",
    introText: "Looking for a Discord alternative for your gaming community, friend groups, or private servers? Discord added encryption for voice and video in 2024, but your text messages are still unencrypted. Confide is open source, self-hostable, and encrypts everything by default.",
    features: [
      { name: "Encrypted Text Messages", confide: true, competitor: false, description: "Private chats with friends and groups" },
      { name: "Encrypted Voice & Video", confide: true, competitor: "Since 2024", description: "Secure calls for gaming and hanging out" },
      { name: "Servers & Channels", confide: true, competitor: true, description: "Organize gaming communities and friend groups" },
      { name: "File Uploads", confide: "250MB", competitor: "10MB free", description: "Share game clips and files with friends" },
      { name: "Self-Hosted Servers", confide: true, competitor: false, description: "Host your own community server" },
      { name: "Open Source", confide: "GPL-3", competitor: false, description: "Fully open source and auditable" },
      { name: "Disappearing Messages", confide: true, competitor: false, description: "Private messages that auto-delete" },
      { name: "Roles & Permissions", confide: true, competitor: true, description: "Manage your community and groups" },
      { name: "Spotify Integration", confide: true, competitor: true, description: "Share music with friends" },
      { name: "Screen Sharing", confide: true, competitor: true, description: "Stream games to friends" },
      { name: "Data Collection", confide: "Minimal", competitor: "Extensive", description: "Discord tracks your activity" },
      { name: "Animated Avatars", confide: "Free", competitor: "Nitro only", description: "Discord charges $10/month for this" },
      { name: "Custom Emojis", confide: "Free", competitor: "Nitro only", description: "Use custom emojis everywhere for free" },
      { name: "Free Forever", confide: true, competitor: true, description: "No paid tiers for core features" },
    ],
    confideAdvantages: [
      "All messages between you and your friends are end-to-end encrypted",
      "Animated avatars and custom emojis everywhere for free",
      "Open source under GPL-3 so you can verify the code yourself",
      "Self-host your gaming community or friend group server",
      "25x larger file uploads for sharing game clips and media",
      "Disappearing messages for private conversations",
      "No data mining. Your gaming activity stays private.",
    ],
    competitorAdvantages: [
      "Massive gaming community with 150M+ monthly users",
      "Go Live streaming for sharing gameplay",
    ],
    verdict: "Discord works for public gaming communities where privacy does not matter. But if you want encrypted group chats, self-hosted servers, or an open source platform you control, Confide is the better choice. Build your gaming community or friend group on a platform that respects your privacy.",
    ctaText: "Build Your Private Community",
  },
};

export const comparisonSlugs = Object.keys(comparisons);
