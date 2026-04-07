import { create } from "zustand";

import type { AnalyzeResponse, BuildingChallenge, PieceInventory } from "@/lib/types";

type InventoryState = {
  inventory: PieceInventory;
  detectedColors: string[];
  challenges: BuildingChallenge[];
  completedNames: string[];
  setAnalysis: (analysis: AnalyzeResponse) => void;
  addChallenges: (challenges: BuildingChallenge[]) => void;
  removeChallenge: (name: string) => void;
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
  detectedColors: [],
  challenges: [],
  completedNames: [],
  setAnalysis: (analysis) =>
    set({
      inventory: analysis.pieceInventory,
      detectedColors: analysis.detectedColors,
      challenges: analysis.challenges,
      completedNames: []
    }),
  addChallenges: (newChallenges) =>
    set((state) => ({
      challenges: [...state.challenges, ...newChallenges]
    })),
  removeChallenge: (name) =>
    set((state) => ({
      challenges: state.challenges.filter((c) => c.name !== name),
      completedNames: [...state.completedNames, name]
    })),
  reset: () =>
    set({
      inventory: emptyInventory,
      detectedColors: [],
      challenges: [],
      completedNames: []
    })
}));
