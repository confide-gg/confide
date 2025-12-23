"use client";

import { useRef, useState, useEffect } from "react";

interface VideoPlayerProps {
  src: string;
  alt?: string;
}

export function VideoPlayer({ src, alt }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (isVisible) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isVisible]);

  return (
    <figure
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl shadow-black/50"
    >
      <video
        ref={videoRef}
        src={src}
        loop
        muted
        playsInline
        aria-label={alt}
        className="h-full w-full object-cover"
      />
      {alt && <figcaption className="sr-only">{alt}</figcaption>}
    </figure>
  );
}
