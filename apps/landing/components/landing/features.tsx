"use client";

import { motion } from "framer-motion";
import { VideoPlayer } from "./video-player";
import { features } from "./constants";

export function Features() {
  return (
    <section id="features" className="min-h-screen py-32" aria-labelledby="features-heading">
      <div className="mx-auto max-w-7xl px-4 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2
            id="features-heading"
            className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight mb-6"
          >
            <span className="text-foreground">Powerful </span>
            <span className="text-primary" style={{ textShadow: "0 0 60px rgba(201, 237, 123, 0.4)" }}>
              Features
            </span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
            Everything you need for private communication. Built from the ground up with security and privacy as the foundation, not an afterthought.
          </p>
        </motion.div>
      </div>

      {features.map((feature, index) => (
        <motion.article
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
              <h3 className="text-4xl font-black uppercase tracking-tight md:text-5xl lg:text-6xl">
                <span className="text-foreground">{feature.title}</span>
                <br />
                <span
                  className="text-primary"
                  style={{ textShadow: "0 0 60px rgba(201, 237, 123, 0.4)" }}
                >
                  {feature.highlight}
                </span>
              </h3>
              <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
            <div className="w-full flex-1 lg:max-w-2xl">
              <VideoPlayer src={feature.video} alt={feature.alt} />
            </div>
          </div>
        </motion.article>
      ))}
    </section>
  );
}
