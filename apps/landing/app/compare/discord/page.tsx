"use client";

import { ComparisonPage, comparisons } from "@/components/compare";
import Navbar from "@/components/navbar";
import SmoothScroll from "@/components/smooth-scroll";

const data = comparisons.discord;

export default function DiscordComparisonPage() {
  return (
    <>
      <SmoothScroll />
      <main className="relative min-h-screen bg-[#050507]">
        <Navbar />
        <ComparisonPage data={data} />
      </main>
    </>
  );
}
