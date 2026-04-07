"use client";

import { BuildMatrixPreview } from "@/components/build-matrix-preview";
import type { BuildingChallenge } from "@/lib/types";

export function MiniPreview({ challenge }: { challenge: BuildingChallenge }) {
  return (
    <div className="rounded-[22px] border border-sky-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(236,243,255,0.95))] px-3 pt-3 pb-2">
      <div className="mb-2 flex items-center justify-between text-slate-700">
        <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-700/80">
          Physical Blueprint
        </div>
        <div className="text-[10px] font-semibold text-slate-400">
          {challenge.buildMatrix.length} section{challenge.buildMatrix.length !== 1 ? "s" : ""}
        </div>
      </div>
      <BuildMatrixPreview challenge={challenge} />
    </div>
  );
}
