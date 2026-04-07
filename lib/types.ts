export type PieceInventory = {
  squares: number;
  rectangles: number;
  equilateralTriangles: number;
  isoscelesTriangles: number;
};

export type ChallengeDifficulty = "easy-2d" | "medium-3d" | "hard-3d";
export type TileShape = "square" | "rectangle" | "equilateralTriangle" | "isoscelesTriangle";

export type BuildMatrixPosition =
  | "base"
  | "middle"
  | "top"
  | "left"
  | "center"
  | "right";

export type BuildMatrixNode = {
  section: string;
  position: BuildMatrixPosition;
  shapes: TileShape[];
};

export type ChallengePreview = {
  caption: string;
};

export type BuildingChallenge = {
  difficulty: ChallengeDifficulty;
  name: string;
  emoji: string;
  steps: [string, string, string];
  piecesUsed: PieceInventory;
  primaryColor: string;
  buildMatrix: BuildMatrixNode[];
  preview: ChallengePreview;
};

export type AnalyzeResponse = {
  pieceInventory: PieceInventory;
  detectedColors: string[];
  challenges: [BuildingChallenge, BuildingChallenge, BuildingChallenge];
};
