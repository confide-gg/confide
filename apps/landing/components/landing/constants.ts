export const PRIMARY = "#c9ed7b";
export const BG = "#050507";

export const features = [
  {
    id: "messaging",
    title: "Seamless messaging,",
    highlight: "done right.",
    description: "Experience fluid, real-time conversations with end-to-end encryption.",
    video: "/videos/Confide.mp4",
  },
  {
    id: "files",
    title: "Share files up to",
    highlight: "250MB.",
    description: "Send documents, images, and videos with military-grade encryption.",
    video: "/videos/Confide_Files.mp4",
  },
  {
    id: "music",
    title: "Listen together with",
    highlight: "Spotify.",
    description: "Share what you're listening to in real-time with your friends.",
    video: "/videos/Confide_Music.mp4",
  },
  {
    id: "secret",
    title: "Messages that",
    highlight: "disappear.",
    description: "Set a timer and watch your messages vanish. Perfect for sensitive conversations.",
    video: "/videos/Confide_Secret.mp4",
  },
];

export const faqs = [
  {
    question: "What makes Confide different from Discord or Signal?",
    answer: "Confide combines Discord's community features with Signal's privacy. You get end-to-end encrypted group chats, federated self-hostable servers, and post-quantum cryptography, all while maintaining full control of your data.",
  },
  {
    question: "What encryption does Confide use?",
    answer: "Confide uses post-quantum cryptography (ML-DSA-87) for future-proof security, the Double Ratchet Algorithm for forward secrecy in DMs, and ChaCha20-Poly1305 for message encryption. All messages, files, and calls are end-to-end encrypted.",
  },
  {
    question: "Can I host my own Confide server?",
    answer: "Yes! Confide uses a federated architecture. While your account lives on the central server for friends and DMs, you can self-host community servers with full control over your data, roles, and channels.",
  },
  {
    question: "Which platforms are supported?",
    answer: "Confide is currently available on Windows, macOS, and Linux as native desktop apps built with Tauri. Web and mobile versions are planned for future releases.",
  },
  {
    question: "How do temporary messages work?",
    answer: "Messages can be set to automatically expire after 5 seconds, 30 seconds, 1 minute, or 5 minutes. Once expired, they're permanently deleted from all devices and the server.",
  },
  {
    question: "Does Confide support voice and video calls?",
    answer: "Yes! Confide supports end-to-end encrypted voice and video calls between users. All call signaling and media are encrypted to ensure your conversations stay private.",
  },
];
