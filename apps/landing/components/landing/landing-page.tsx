"use client";

import { useRef, useState, useEffect } from "react";
import { useScroll, useTransform } from "framer-motion";
import { ThreeScene } from "./three";
import { Hero } from "./hero";
import { Features } from "./features";
import { FAQ } from "./faq";
import { Footer } from "./footer";

export function LandingPage() {
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

  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -200]);

  return (
    <div ref={containerRef} className="relative">
      <ThreeScene scrollProgress={progress} />

      <div className="relative z-10">
        <Hero heroOpacity={heroOpacity} heroY={heroY} />
        <Features />
        <FAQ />
        <Footer />
      </div>
    </div>
  );
}
