export type PieceInventory = {
  squares: number;
  rectangles: number;
  equilateralTriangles: number;
  isoscelesTriangles: number;
};

export type ChallengeDifficulty = "easy-2d" | "medium-3d" | "hard-3d";

/**
 * Grid-snapped tile for the preview.
 *
 * The preview uses a unit grid where one cell = one square tile side.
 *
 * col / row  — integer grid position (top-left corner of the tile's bounding box)
 * shape      — the tile shape
 * color      — hex color string
 * flip       — for triangles: which orientation
 *
 * Shape bounding boxes on the grid:
 *   square              → 1×1 cell
 *   rectangle           → 2×1 cells (landscape)
 *   equilateralTriangle → 1×1 cell  (flip: "up" | "down")
 *   isoscelesTriangle   → 1×2 cells tall (flip: "up" | "down" | "left" | "right")
 */
export type PreviewTile = {
  shape: "square" | "rectangle" | "equilateralTriangle" | "isoscelesTriangle";
  col: number;   // grid column (x axis, left→right)
  row: number;   // grid row (y axis, front→back in iso view)
  layer: number; // vertical stack height (0 = ground)
  color: string;
  flip?: "up" | "down" | "left" | "right";
};

export type ChallengePreview = {
  caption: string;
  tiles: PreviewTile[];
};

export type BuildingChallenge = {
  difficulty: ChallengeDifficulty;
  name: string;
  emoji: string;
  steps: [string, string, string];
  piecesUsed: PieceInventory;
  preview: ChallengePreview;
};

export type AnalyzeResponse = {
  pieceInventory: PieceInventory;
  challenges: [BuildingChallenge, BuildingChallenge, BuildingChallenge];
};
