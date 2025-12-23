"use client";

import { motion } from "framer-motion";
import { VideoPlayer } from "./video-player";
import { features } from "./constants";

export function Features() {
  return (
    <section id="features" className="min-h-screen py-32">
      {features.map((feature, index) => (
        <motion.div
          key={feature.id}
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mx-auto max-w-7xl px-4 py-24"
        >
          <div
            className={`flex flex-col items-center gap-12 lg:gap-16 ${
              index % 2 !== 0 ? "lg:flex-row-reverse" : "lg:flex-row"
            }`}
          >
            <div className="flex-1 space-y-6">
              <h2 className="text-4xl font-black uppercase tracking-tight md:text-5xl lg:text-6xl">
                <span className="text-foreground">{feature.title}</span>
                <br />
                <span
                  className="text-primary"
                  style={{ textShadow: "0 0 60px rgba(201, 237, 123, 0.4)" }}
                >
                  {feature.highlight}
                </span>
              </h2>
              <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
            <div className="w-full flex-1 lg:max-w-2xl">
              <VideoPlayer src={feature.video} />
            </div>
          </div>
        </motion.div>
      ))}
    </section>
  );
}
