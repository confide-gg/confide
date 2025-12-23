"use client";

import Navbar from "@/components/navbar";
import { LandingPage } from "@/components/landing";
import SmoothScroll from "@/components/smooth-scroll";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <main className="relative min-h-screen bg-[#050507]">
        <Navbar />
        <LandingPage />
      </main>
    </>
  );
}
