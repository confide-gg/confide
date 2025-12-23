"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThreeScene } from "@/components/landing/three";
import { Footer } from "@/components/landing/footer";
import Navbar from "@/components/navbar";
import SmoothScroll from "@/components/smooth-scroll";
import { PRIMARY } from "@/components/landing/constants";
import {
  Lock,
  Shield,
  Timer,
  Upload,
  Music,
  Video,
  Server,
  Eye,
  Sparkles,
  Hash,
  Phone,
  Pin,
  Smile,
  Paperclip,
  ChevronDown,
  Settings,
  Plus,
} from "lucide-react";

const features = [
  {
    title: "End-to-End Encryption",
    description:
      "Every message, file, and call is encrypted before leaving your device. Not even we can read them.",
    skeleton: <SkeletonChat />,
    className: "col-span-1 lg:col-span-4 border-b lg:border-r border-white/10",
  },
  {
    title: "Servers & Channels",
    description:
      "Create servers for your gaming community or friend group. Organize with channels and roles.",
    skeleton: <SkeletonServers />,
    className: "border-b col-span-1 lg:col-span-2 border-white/10",
  },
  {
    title: "Voice & Video Calls",
    description:
      "Crystal clear encrypted calls with screen sharing. Perfect for gaming sessions.",
    skeleton: <SkeletonCalls />,
    className: "col-span-1 lg:col-span-3 lg:border-r border-white/10",
  },
  {
    title: "Self-Host Your Server",
    description:
      "Host your own community with full control. Federated architecture connects to the main network.",
    skeleton: <SkeletonSelfHost />,
    className: "col-span-1 lg:col-span-3 border-b lg:border-none border-white/10",
  },
];

const gridFeatures = [
  {
    title: "Disappearing Messages",
    description: "Set messages to auto-delete after 5 seconds to 5 minutes. Gone forever.",
    icon: <Timer className="w-6 h-6" />,
  },
  {
    title: "250MB File Uploads",
    description: "Share game clips, videos, and files with friends. All encrypted.",
    icon: <Upload className="w-6 h-6" />,
  },
  {
    title: "Spotify Integration",
    description: "Share what you're listening to. See your friends' music taste.",
    icon: <Music className="w-6 h-6" />,
  },
  {
    title: "Open Source",
    description: "GPL-3 licensed. Audit the code, verify encryption, contribute.",
    icon: <Server className="w-6 h-6" />,
  },
  {
    title: "Privacy by Design",
    description: "Minimal metadata. No IP logging. No tracking who talks to whom.",
    icon: <Eye className="w-6 h-6" />,
  },
  {
    title: "Custom Emojis & Avatars",
    description: "Animated avatars and custom emojis everywhere. Free, not paid.",
    icon: <Sparkles className="w-6 h-6" />,
  },
  {
    title: "Roles & Permissions",
    description: "Granular control over your server. Custom roles, per-channel perms.",
    icon: <Shield className="w-6 h-6" />,
  },
  {
    title: "Screen Sharing",
    description: "Stream your screen to friends. Perfect for gaming and collaboration.",
    icon: <Video className="w-6 h-6" />,
  },
];

export default function FeaturesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const scrollProgress = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return scrollProgress.on("change", (v) => setProgress(v));
  }, [scrollProgress]);

  return (
    <>
      <SmoothScroll />
      <main className="relative min-h-screen bg-[#050507]">
        <Navbar />
        <div ref={containerRef} className="relative">
          <ThreeScene scrollProgress={progress} />

          <div className="relative z-10">
            <div className="py-20 lg:py-40 max-w-7xl mx-auto pt-32">
              <div className="px-8">
                <h1
                  className="text-4xl lg:text-6xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-black uppercase"
                  style={{ color: PRIMARY, textShadow: `0 0 60px ${PRIMARY}66` }}
                >
                  Features
                </h1>
                <p className="text-base lg:text-lg max-w-2xl my-4 mx-auto text-neutral-400 text-center">
                  Everything you need for private communication with friends, gaming communities, and groups. Open source and self-hostable.
                </p>
              </div>

              <div className="relative">
                <div className="grid grid-cols-1 lg:grid-cols-6 mt-12 border rounded-2xl border-white/10 bg-white/5 backdrop-blur-sm mx-4 lg:mx-8">
                  {features.map((feature) => (
                    <FeatureCard key={feature.title} className={feature.className}>
                      <FeatureTitle>{feature.title}</FeatureTitle>
                      <FeatureDescription>{feature.description}</FeatureDescription>
                      <div className="h-full w-full">{feature.skeleton}</div>
                    </FeatureCard>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 pb-20">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10">
                {gridFeatures.map((feature, index) => (
                  <Feature key={feature.title} {...feature} index={index} />
                ))}
              </div>
            </div>

            <section className="py-24 px-4">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mx-auto max-w-3xl text-center"
              >
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-6">
                  <span className="text-foreground">Ready to </span>
                  <span className="text-primary" style={{ textShadow: `0 0 40px ${PRIMARY}66` }}>
                    Switch?
                  </span>
                </h2>
                <p className="text-muted-foreground mb-8">
                  Join a community that values privacy, open source, and putting users first.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="https://x.com/ConfideChat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-300 hover:scale-105"
                  >
                    Follow for Updates
                  </a>
                  <a
                    href="https://github.com/confide-gg/confide"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-white/20 text-foreground font-semibold hover:bg-white/10 transition-colors"
                  >
                    View on GitHub
                  </a>
                </div>
              </motion.div>
            </section>

            <Footer />
          </div>
        </div>
      </main>
    </>
  );
}

const FeatureCard = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={cn("p-4 sm:p-8 relative overflow-hidden", className)}>{children}</div>
);

const FeatureTitle = ({ children }: { children?: React.ReactNode }) => (
  <p className="max-w-5xl mx-auto text-left tracking-tight text-white text-xl md:text-2xl md:leading-snug font-semibold">
    {children}
  </p>
);

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => (
  <p className="text-sm md:text-base max-w-sm text-left text-neutral-400 my-2">{children}</p>
);

function SkeletonChat() {
  return (
    <div className="relative flex py-6 h-full">
      <div className="w-full rounded-xl overflow-hidden bg-[#18181b] border border-[#27272a] shadow-2xl">
        <div className="flex h-[280px]">
          <div className="w-[72px] bg-[#18181b] border-r border-[#27272a] p-2 flex flex-col gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#c9ed7b] flex items-center justify-center mx-auto">
              <span className="text-[#18181b] font-bold text-lg">C</span>
            </div>
            <div className="w-8 h-[1px] bg-[#27272a] mx-auto" />
            <div className="w-12 h-12 rounded-2xl bg-[#27272a] mx-auto" />
            <div className="w-12 h-12 rounded-2xl bg-[#27272a] mx-auto" />
            <div className="mt-auto w-10 h-10 rounded-xl bg-[#27272a] mx-auto flex items-center justify-center">
              <Plus className="w-4 h-4 text-[#a1a1aa]" />
            </div>
          </div>

          <div className="w-[160px] bg-[#1e1e21] border-r border-[#27272a] flex flex-col">
            <div className="h-12 px-3 flex items-center justify-between border-b border-[#27272a]">
              <span className="text-sm font-semibold text-white truncate">Gaming Squad</span>
              <Settings className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="flex-1 p-2 space-y-1">
              <div className="flex items-center gap-1 px-2 py-0.5">
                <ChevronDown className="w-3 h-3 text-[#a1a1aa]" />
                <span className="text-[10px] font-semibold text-[#a1a1aa] uppercase">Text</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#c9ed7b]">
                <Hash className="w-4 h-4 text-[#18181b]" />
                <span className="text-sm font-medium text-[#18181b]">general</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#27272a]">
                <Hash className="w-4 h-4 text-[#a1a1aa]" />
                <span className="text-sm text-[#a1a1aa]">gaming</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#27272a]">
                <Hash className="w-4 h-4 text-[#a1a1aa]" />
                <span className="text-sm text-[#a1a1aa]">music</span>
              </div>
            </div>
            <div className="h-12 px-2 flex items-center gap-2 bg-[#18181b] border-t border-[#27272a]">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-[#c9ed7b]" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-[#18181b]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">You</div>
                <div className="text-[10px] text-[#a1a1aa]">Online</div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-[#18181b]">
            <div className="h-12 px-4 flex items-center justify-between border-b border-[#27272a]">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-[#a1a1aa]" />
                <span className="font-semibold text-white">general</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="p-2 rounded-lg hover:bg-[#27272a]">
                  <Phone className="w-4 h-4 text-[#a1a1aa]" />
                </div>
                <div className="p-2 rounded-lg hover:bg-[#27272a]">
                  <Pin className="w-4 h-4 text-[#a1a1aa]" />
                </div>
              </div>
            </div>

            <div className="flex-1 px-6 py-3 space-y-3 overflow-hidden">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Alex</span>
                    <span className="text-[10px] text-[#a1a1aa]">12:34 PM</span>
                    <Lock className="w-3 h-3 text-[#c9ed7b]" />
                  </div>
                  <div className="h-4 w-44 bg-[#27272a] rounded mt-1" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Jordan</span>
                    <span className="text-[10px] text-[#a1a1aa]">12:35 PM</span>
                    <Lock className="w-3 h-3 text-[#c9ed7b]" />
                  </div>
                  <div className="h-4 w-36 bg-[#27272a] rounded mt-1" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#c9ed7b] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#c9ed7b]">You</span>
                    <span className="text-[10px] text-[#a1a1aa]">12:36 PM</span>
                    <Lock className="w-3 h-3 text-[#c9ed7b]" />
                  </div>
                  <div className="h-4 w-32 bg-[#c9ed7b]/20 rounded mt-1" />
                </div>
              </div>
            </div>

            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 bg-[#27272a]/50 rounded-md h-9 px-3 border border-[#27272a]">
                <Paperclip className="w-4 h-4 text-[#a1a1aa] shrink-0" />
                <Smile className="w-4 h-4 text-[#a1a1aa] shrink-0" />
                <Timer className="w-4 h-4 text-[#a1a1aa] shrink-0" />
                <div className="flex-1 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 z-40 inset-x-0 h-32 bg-gradient-to-t from-[#050507] via-[#050507]/80 to-transparent pointer-events-none" />
    </div>
  );
}

function SkeletonServers() {
  return (
    <div className="relative flex flex-col p-4 h-full">
      <div className="rounded-xl overflow-hidden bg-[#18181b] border border-[#27272a] p-3">
        <div className="flex gap-3 mb-4">
          {[
            { name: "G", color: "bg-red-500/40" },
            { name: "F", color: "bg-blue-500/40" },
            { name: "W", color: "bg-green-500/40" },
          ].map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white", s.color)}
            >
              {s.name}
            </motion.div>
          ))}
          <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-[#27272a] flex items-center justify-center">
            <Plus className="w-5 h-5 text-[#a1a1aa]" />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 px-2 py-1">
            <ChevronDown className="w-3 h-3 text-[#a1a1aa]" />
            <span className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Channels</span>
          </div>
          {["general", "voice", "clips"].map((ch, i) => (
            <div
              key={ch}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                i === 0 ? "bg-[#c9ed7b] text-[#18181b]" : "text-[#a1a1aa]"
              )}
            >
              <Hash className="w-4 h-4" />
              <span className="text-sm">{ch}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute right-0 z-40 inset-y-0 w-16 bg-gradient-to-l from-[#050507] to-transparent pointer-events-none" />
    </div>
  );
}

function SkeletonCalls() {
  return (
    <div className="relative flex items-center justify-center h-full min-h-[220px] p-4">
      <div className="rounded-xl overflow-hidden bg-[#18181b] border border-[#27272a] p-6 w-full">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="relative mx-auto mb-2">
              <div className="w-16 h-16 rounded-full bg-blue-500/30 ring-2 ring-[#c9ed7b] ring-offset-2 ring-offset-[#18181b]" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#22c55e] border-2 border-[#18181b] flex items-center justify-center">
                <Phone className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div className="text-xs text-white font-medium">Alex</div>
            <div className="text-[10px] text-[#a1a1aa]">Speaking</div>
          </div>

          <div className="text-center">
            <div className="relative mx-auto mb-2">
              <div className="w-16 h-16 rounded-full bg-purple-500/30" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#22c55e] border-2 border-[#18181b]" />
            </div>
            <div className="text-xs text-white font-medium">Jordan</div>
            <div className="text-[10px] text-[#a1a1aa]">Connected</div>
          </div>

          <div className="text-center">
            <div className="relative mx-auto mb-2">
              <div className="w-16 h-16 rounded-full bg-[#c9ed7b] flex items-center justify-center text-[#18181b] font-bold">
                Y
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#22c55e] border-2 border-[#18181b]" />
            </div>
            <div className="text-xs text-[#c9ed7b] font-medium">You</div>
            <div className="text-[10px] text-[#a1a1aa]">Connected</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-6">
          <div className="p-3 rounded-full bg-[#27272a]">
            <Video className="w-4 h-4 text-white" />
          </div>
          <div className="p-3 rounded-full bg-red-500">
            <Phone className="w-4 h-4 text-white" />
          </div>
          <div className="p-3 rounded-full bg-[#27272a]">
            <Lock className="w-4 h-4 text-[#c9ed7b]" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <Lock className="w-3 h-3 text-[#c9ed7b]" />
          <span className="text-[10px] text-[#c9ed7b]">End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}

function SkeletonSelfHost() {
  return (
    <div className="h-60 flex items-center justify-center p-4 relative">
      <div className="w-full max-w-sm rounded-xl overflow-hidden bg-[#0d0d0f] border border-[#27272a] shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#18181b] border-b border-[#27272a]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-xs text-[#a1a1aa] ml-2 font-mono">Terminal</span>
        </div>
        <div className="p-4 font-mono text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[#c9ed7b]">$</span>
            <span className="text-white">curl -fsSL</span>
            <span className="text-[#c9ed7b]">get.confide.gg</span>
            <span className="text-white">| sh</span>
          </div>
          <div className="text-[#a1a1aa] pl-4 space-y-1 pt-1">
            <div>Installing Confide Server...</div>
            <div className="flex items-center gap-2">
              <span className="text-[#28c840]">✓</span>
              <span>Dependencies installed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#28c840]">✓</span>
              <span>Server configured</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-[#28c840]">✓</span>
            <span className="text-white">Running at</span>
            <span className="text-[#c9ed7b]">confide.yourserver.com</span>
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="w-2 h-4 bg-[#c9ed7b] inline-block"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r py-10 relative group/feature border-white/10",
        (index === 0 || index === 4) && "lg:border-l border-white/10",
        index < 4 && "lg:border-b border-white/10"
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-900 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-900 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-400">{icon}</div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-700 group-hover/feature:bg-primary transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-100">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-400 max-w-xs relative z-10 px-10">{description}</p>
    </div>
  );
};
