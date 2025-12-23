"use client";

import { Check, X } from "lucide-react";
import type { ComparisonFeature } from "./constants";

interface ComparisonTableProps {
  features: ComparisonFeature[];
  competitorName: string;
}

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-5 h-5 text-[#c9ed7b]" />;
  if (value === false) return <X className="w-5 h-5 text-[#52525b]" />;
  return <span className="text-sm text-[#a1a1aa]">{value}</span>;
}

export function ComparisonTable({ features, competitorName }: ComparisonTableProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-6 py-4 text-sm font-medium text-[#a1a1aa]">Feature</th>
            <th className="px-6 py-4 text-sm font-semibold text-[#c9ed7b] text-center w-32">Confide</th>
            <th className="px-6 py-4 text-sm font-medium text-[#a1a1aa] text-center w-32">{competitorName}</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature, index) => (
            <tr key={feature.name} className={index !== features.length - 1 ? "border-b border-white/5" : ""}>
              <td className="px-6 py-4 text-sm text-white">{feature.name}</td>
              <td className="px-6 py-4 text-center">
                <div className="flex justify-center">
                  <FeatureValue value={feature.confide} />
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <div className="flex justify-center">
                  <FeatureValue value={feature.competitor} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
