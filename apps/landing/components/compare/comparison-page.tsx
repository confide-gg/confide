"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { ThreeScene } from "@/components/landing/three";
import { Footer } from "@/components/landing/footer";
import Navbar from "@/components/navbar";
import SmoothScroll from "@/components/smooth-scroll";
import { ComparisonTable } from "./comparison-table";
import { PRIMARY } from "./constants";
import type { ComparisonData } from "./constants";

interface ComparisonPageProps {
  data: ComparisonData;
}

export function ComparisonPage({ data }: ComparisonPageProps) {
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
            <div className="pt-32 pb-20">
              <article className="mx-auto max-w-4xl px-4">
                <motion.header
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-center mb-16"
                >
                  <h1
                    className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight mb-6"
                    style={{ color: PRIMARY, textShadow: `0 0 60px ${PRIMARY}66` }}
                  >
                    {data.heroTitle} {data.heroHighlight}
                  </h1>
                  <p className="max-w-2xl mx-auto text-base md:text-lg text-[#a1a1aa] leading-relaxed">
                    {data.introText}
                  </p>
                </motion.header>

                <section className="mb-20">
                  <ComparisonTable features={data.features} competitorName={data.competitor} />
                </section>

                <section className="mb-20">
                  <div className="grid md:grid-cols-2 gap-12">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                    >
                      <h3
                        className="text-lg font-bold mb-6 flex items-center gap-2"
                        style={{ color: PRIMARY }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ background: PRIMARY }} />
                        Why Confide
                      </h3>
                      <ul className="space-y-3">
                        {data.confideAdvantages.map((advantage, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="flex gap-3 text-sm text-[#a1a1aa]"
                          >
                            <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: PRIMARY }} />
                            <span>{advantage}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#a1a1aa]">
                        <div className="w-2 h-2 rounded-full bg-[#a1a1aa]" />
                        {data.competitor} Strengths
                      </h3>
                      <ul className="space-y-3">
                        {data.competitorAdvantages.map((advantage, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="flex gap-3 text-sm text-[#71717a]"
                          >
                            <Check className="w-4 h-4 text-[#71717a] shrink-0 mt-0.5" />
                            <span>{advantage}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  </div>
                </section>

                <motion.section
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="mb-20 py-12 border-y border-white/10"
                >
                  <p className="text-base md:text-lg text-[#a1a1aa] leading-relaxed text-center max-w-3xl mx-auto">
                    {data.verdict}
                  </p>
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="text-center pb-12"
                >
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-4">
                    <span className="text-white">Ready to </span>
                    <span style={{ color: PRIMARY, textShadow: `0 0 40px ${PRIMARY}66` }}>
                      Switch?
                    </span>
                  </h2>
                  <p className="text-[#a1a1aa] mb-8 text-sm">
                    Join a community that values privacy and open source.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                      href="https://x.com/ConfideChat"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105"
                      style={{ background: PRIMARY, color: "#18181b" }}
                    >
                      {data.ctaText}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </a>
                    <a
                      href="/features"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
                    >
                      View Features
                    </a>
                  </div>
                </motion.section>
              </article>
            </div>

            <Footer />
          </div>
        </div>
      </main>
    </>
  );
}
