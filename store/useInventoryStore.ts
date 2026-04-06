import { create } from "zustand";

import type { AnalyzeResponse, PieceInventory } from "@/lib/types";

type InventoryState = {
  inventory: PieceInventory;
  challenges: AnalyzeResponse["challenges"] | [];
  setAnalysis: (analysis: AnalyzeResponse) => void;
  reset: () => void;
};

const emptyInventory: PieceInventory = {
  squares: 0,
  rectangles: 0,
  equilateralTriangles: 0,
  isoscelesTriangles: 0
};

export const useInventoryStore = create<InventoryState>((set) => ({
  inventory: emptyInventory,
  challenges: [],
  setAnalysis: (analysis) =>
    set({
      inventory: analysis.pieceInventory,
      challenges: analysis.challenges
    }),
  reset: () =>
    set({
      inventory: emptyInventory,
      challenges: []
    })
}));
