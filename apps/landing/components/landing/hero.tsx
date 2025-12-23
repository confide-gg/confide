"use client";

import { motion, MotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Github, ArrowRight } from "lucide-react";
import { PRIMARY } from "./constants";

interface HeroProps {
  heroOpacity: MotionValue<number>;
  heroY: MotionValue<number>;
}

export function Hero({ heroOpacity, heroY }: HeroProps) {
  return (
    <motion.section
      style={{ opacity: heroOpacity, y: heroY }}
      className="min-h-screen flex flex-col items-center justify-center px-4 select-none"
    >
      <div className="flex flex-col items-center text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="text-7xl sm:text-8xl md:text-9xl font-black uppercase tracking-tighter mb-6"
          style={{
            color: PRIMARY,
            textShadow: `0 0 80px ${PRIMARY}66, 0 0 120px ${PRIMARY}33, 0 0 160px ${PRIMARY}22`,
          }}
        >
          Confide
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="max-w-md text-lg text-muted-foreground mb-10"
        >
          Where your words stay yours. End-to-end encrypted messaging for friends, groups, and communities.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="flex flex-col items-center gap-6 w-full max-w-lg"
        >
          <Button
            asChild
            size="lg"
            className="h-12 sm:h-14 gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(201,237,123,0.4)]"
          >
            <a
              href="https://x.com/ConfideChat"
              target="_blank"
              rel="noopener noreferrer"
            >
              Follow for Launch Updates
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>

          <div className="flex items-center gap-3 text-sm text-muted-foreground/60">
            <a
              href="https://github.com/confide-gg/confide"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              Open Source
            </a>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
