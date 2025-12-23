export const PRIMARY = "#c9ed7b";
export const BG = "#050507";

export const features = [
  {
    id: "messaging",
    title: "Seamless messaging,",
    highlight: "done right.",
    description: "Experience fluid, real-time conversations with end-to-end encryption. Every message is secured the moment you send it, protecting your privacy at all times.",
    video: "/videos/Confide.mp4",
    alt: "Confide encrypted messaging interface showing real-time chat",
  },
  {
    id: "files",
    title: "Share files up to",
    highlight: "250MB.",
    description: "Send documents, images, and videos securely. Files are encrypted before leaving your device and can only be decrypted by the intended recipient.",
    video: "/videos/Confide_Files.mp4",
    alt: "Confide secure file sharing feature demonstration",
  },
  {
    id: "music",
    title: "Listen together with",
    highlight: "Spotify.",
    description: "Share what you're listening to in real-time with your friends. Confide integrates with Spotify to display your current track, letting others see your music taste and join the vibe.",
    video: "/videos/Confide_Music.mp4",
    alt: "Confide Spotify integration showing shared listening activity",
  },
  {
    id: "secret",
    title: "Messages that",
    highlight: "disappear.",
    description: "Set a timer and watch your messages vanish automatically. Choose from 5 seconds to 5 minutes. Once expired, messages are permanently deleted from all devices and our servers. No traces left behind.",
    video: "/videos/Confide_Secret.mp4",
    alt: "Confide disappearing messages feature with timer options",
  },
];

export const faqs = [
  {
    question: "What makes Confide different from Discord or Signal?",
    answer: "Confide combines Discord's community features with Signal's privacy. You get end-to-end encrypted group chats, federated self-hostable servers, and post-quantum cryptography, all while maintaining full control of your data. Unlike Discord, every message is encrypted. Unlike Signal, you get servers, channels, roles, and rich community features.",
  },
  {
    question: "What encryption does Confide use?",
    answer: "Confide uses post-quantum cryptography for future-proof security, along with industry-standard encryption for all messages. All messages, files, and calls are end-to-end encrypted by default with no way to disable it.",
  },
  {
    question: "Can I host my own Confide server?",
    answer: "Yes! Confide uses a federated architecture similar to email or Matrix. While your account lives on the central server for friends and DMs, you can self-host community servers with full control over your data, roles, channels, and moderation. Self-hosted servers communicate seamlessly with the main network.",
  },
  {
    question: "Which platforms are supported?",
    answer: "Confide is currently available on Windows, macOS, and Linux as native desktop apps. The apps are lightweight and fast. Web and mobile versions for iOS and Android are planned for future releases.",
  },
  {
    question: "How do temporary messages work?",
    answer: "Disappearing messages can be set to automatically expire after 5 seconds, 30 seconds, 1 minute, or 5 minutes. Once the timer runs out, messages are permanently deleted from all devices and our servers. This feature is perfect for sensitive conversations where you want no digital trail.",
  },
  {
    question: "Does Confide support voice and video calls?",
    answer: "Yes! Confide supports end-to-end encrypted voice and video calls between users. Your calls are completely private and cannot be intercepted or recorded by anyone, including us.",
  },
  {
    question: "Is Confide really open source?",
    answer: "Yes, Confide is fully open source under the GPL-3 license. You can audit our code, verify our encryption, contribute improvements, or fork the project. Transparency is core to our mission. We believe you shouldn't have to trust us, you should be able to verify.",
  },
  {
    question: "How does Confide protect against metadata collection?",
    answer: "We minimize metadata collection by design. We don't log IP addresses, don't track who talks to whom, and don't store message timestamps longer than necessary. With self-hosted servers, you control even more. Our goal is to know as little about you as possible while still providing the service.",
  },
  {
    question: "What happens if I lose my device?",
    answer: "You can recover your account using your Recovery Key. If you've lost access entirely, you can submit a GDPR deletion request and start fresh. Need help? Reach out to us at support@confide.gg and we'll assist you.",
  },
  {
    question: "Is Confide free to use?",
    answer: "Yes, Confide is completely free for personal use with no ads, no data mining, and no premium tiers that lock essential features. We're funded by donations and optional cosmetic items. Privacy shouldn't be a luxury. Everyone deserves secure communication.",
  },
];
