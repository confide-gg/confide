"use client";

import { motion } from "framer-motion";
import { Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-20 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <h2
          className="font-black uppercase tracking-tighter text-primary"
          style={{
            fontSize: "clamp(4rem, 15vw, 12rem)",
            textShadow: "0 0 100px rgba(201, 237, 123, 0.3)",
          }}
        >
          CONFIDE
        </h2>
      </motion.div>

      <div className="mx-auto max-w-7xl px-4 flex flex-col items-center gap-8">
        <div className="flex gap-6">
          <a
            href="https://x.com/ConfideChat"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://github.com/confide-gg/confide"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-6 w-6" />
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Confide. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
