"use client";

import type { BuildingChallenge, BuildMatrixNode, TileShape } from "@/lib/types";

const U = 24; // SVG units per grid unit
const GAP = 2; // gap between tiles in SVG units

type GridCell = {
  col: number;   // in grid units
  row: number;   // in grid units
  colSpan: number; // in grid units
  rowSpan: number; // always 2
  shape: TileShape;
};

// Map descriptive color names to hex fills
const COLOR_MAP: Record<string, string> = {
  red: "#f87171", ruby: "#f87171", coral: "#f87171", crimson: "#f87171", rose: "#fb7185",
  orange: "#fb923c", amber: "#fbbf24", sunburst: "#fbbf24", gold: "#f59e0b",
  yellow: "#fde047", lemon: "#fde047",
  green: "#4ade80", mint: "#6ee7b7", emerald: "#34d399", lime: "#a3e635", forest: "#4ade80",
  teal: "#2dd4bf", cyan: "#22d3ee",
  blue: "#60a5fa", ocean: "#38bdf8", sky: "#38bdf8", cobalt: "#60a5fa",
  indigo: "#818cf8", purple: "#a78bfa", violet: "#a78bfa",
  pink: "#f472b6", magenta: "#e879f9",
  white: "#e2e8f0", silver: "#cbd5e1", gray: "#94a3b8", grey: "#94a3b8",
};

function tileColorFromPrimaryColor(primaryColor: string): string {
  const lower = primaryColor.toLowerCase();
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return hex;
  }
  return "#60a5fa"; // fallback sky blue
}

function darken(hex: string, amount = 40): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function lighten(hex: string, amount = 40): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Map position to grid row (0 = top of display, higher = lower)
const VERTICAL_POSITIONS = ["top", "middle", "base"] as const;
const HORIZONTAL_POSITIONS = ["left", "center", "right"] as const;

function computeGridCells(buildMatrix: BuildMatrixNode[]): GridCell[] {
  if (buildMatrix.length === 0) return [];

  const hasVertical = buildMatrix.some((n) =>
    (VERTICAL_POSITIONS as readonly string[]).includes(n.position)
  );
  const hasHorizontal = buildMatrix.some((n) =>
    (HORIZONTAL_POSITIONS as readonly string[]).includes(n.position)
  );

  const cells: GridCell[] = [];

  if (hasVertical && !hasHorizontal) {
    // Stack rows: top=row0, middle=row2, base=row4
    const rowMap: Record<string, number> = { top: 0, middle: 2, base: 4 };
    for (const node of buildMatrix) {
      const startRow = rowMap[node.position] ?? 4;
      placeShapesInRow(node.shapes, startRow, 0, cells);
    }
  } else if (!hasVertical && hasHorizontal) {
    // Side by side in a single row, column offset per position
    // Compute how many shapes in each horizontal slot to determine col offsets
    const colOffsetMap = computeHorizontalOffsets(buildMatrix);
    for (const node of buildMatrix) {
      const startCol = colOffsetMap[node.position] ?? 0;
      placeShapesInRow(node.shapes, 0, startCol, cells);
    }
  } else {
    // Mixed: group by vertical position first, treat horizontal as sub-columns within each row
    const verticalGroups: Record<string, BuildMatrixNode[]> = {};
    const rowMap: Record<string, number> = { top: 0, middle: 2, base: 4 };
    let fallbackRow = 0;

    for (const node of buildMatrix) {
      if ((VERTICAL_POSITIONS as readonly string[]).includes(node.position)) {
        const key = node.position;
        (verticalGroups[key] ??= []).push(node);
      } else {
        // Orphan horizontal node — treat as base
        (verticalGroups["base"] ??= []).push(node);
      }
    }

    for (const [pos, nodes] of Object.entries(verticalGroups)) {
      const startRow = rowMap[pos] ?? fallbackRow;
      fallbackRow += 2;
      // Lay all shapes in the group sequentially in this row
      const allShapes = nodes.flatMap((n) => n.shapes);
      placeShapesInRow(allShapes, startRow, 0, cells);
    }
  }

  return cells;
}

function shapeColSpan(shape: TileShape): number {
  return shape === "rectangle" ? 4 : 2;
}

function placeShapesInRow(
  shapes: TileShape[],
  startRow: number,
  startCol: number,
  cells: GridCell[],
  maxCols = 12
) {
  let col = startCol;
  for (const shape of shapes) {
    const span = shapeColSpan(shape);
    if (col - startCol + span > maxCols) {
      col = startCol;
      // Increase row by 2 (below existing row) — but we don't track overflow separately
      // Just reset col and continue at the same row (rare edge case)
    }
    cells.push({ col, row: startRow, colSpan: span, rowSpan: 2, shape });
    col += span + 1; // +1 gap unit between tiles
  }
}

function computeHorizontalOffsets(nodes: BuildMatrixNode[]): Record<string, number> {
  const order = ["left", "center", "right"];
  const sorted = [...nodes].sort(
    (a, b) => order.indexOf(a.position) - order.indexOf(b.position)
  );

  const offsets: Record<string, number> = {};
  let col = 0;
  for (const node of sorted) {
    offsets[node.position] = col;
    const totalSpan = node.shapes.reduce((sum, s) => sum + shapeColSpan(s) + 1, 0);
    col += totalSpan + 1; // extra gap between sections
  }
  return offsets;
}

function cellToSvg(cell: GridCell) {
  return {
    x: cell.col * (U + GAP),
    y: cell.row * (U + GAP),
    w: cell.colSpan * U + (cell.colSpan - 1) * GAP,
    h: cell.rowSpan * U + (cell.rowSpan - 1) * GAP,
  };
}

type TileRectProps = {
  cell: GridCell;
  fill: string;
  stroke: string;
  shadow: string;
  is3d: boolean;
};

function TileRect({ cell, fill, stroke, shadow, is3d }: TileRectProps) {
  const { x, y, w, h } = cellToSvg(cell);
  const r = 4;
  const d = 4; // 3D depth offset

  return (
    <g>
      {is3d && (
        <>
          {/* right face */}
          <polygon
            points={`${x + w},${y + r} ${x + w + d},${y - d + r} ${x + w + d},${y - d + h} ${x + w},${y + h}`}
            fill={darken(shadow, 10)}
          />
          {/* top face */}
          <polygon
            points={`${x + r},${y} ${x + w},${y} ${x + w + d},${y - d} ${x + r + d},${y - d}`}
            fill={lighten(fill, 20)}
          />
        </>
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      {/* shine */}
      <rect
        x={x + 4}
        y={y + 4}
        width={w - 8}
        height={4}
        rx={2}
        fill="white"
        opacity={0.3}
      />
    </g>
  );
}

type TileTriangleProps = {
  cell: GridCell;
  fill: string;
  stroke: string;
};

function TileTriangle({ cell, fill, stroke }: TileTriangleProps) {
  const { x, y, w, h } = cellToSvg(cell);
  // equilateral: wide base (0% inset), isosceles: narrow base (20% inset)
  const inset = cell.shape === "isoscelesTriangle" ? w * 0.2 : 0;

  const points = [
    `${x + w / 2},${y + 2}`,         // apex
    `${x + inset},${y + h - 2}`,      // bottom-left
    `${x + w - inset},${y + h - 2}`,  // bottom-right
  ].join(" ");

  return (
    <g>
      <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
      {/* shine */}
      <line
        x1={x + w / 2}
        y1={y + 4}
        x2={x + w / 2 - 4}
        y2={y + h * 0.35}
        stroke="white"
        strokeWidth={2}
        strokeOpacity={0.35}
        strokeLinecap="round"
      />
    </g>
  );
}

export function BuildMatrixPreview({ challenge }: { challenge: BuildingChallenge }) {
  const cells = computeGridCells(challenge.buildMatrix);
  const is3d = challenge.difficulty !== "easy-2d";

  if (cells.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs uppercase tracking-widest text-slate-400">
        No preview
      </div>
    );
  }

  // Compute viewBox from bounding box of all cells
  const padding = is3d ? 12 : 8;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cell of cells) {
    const { x, y, w, h } = cellToSvg(cell);
    const extra = is3d ? 4 : 0; // account for 3D depth
    minX = Math.min(minX, x);
    minY = Math.min(minY, y - extra);
    maxX = Math.max(maxX, x + w + extra);
    maxY = Math.max(maxY, y + h);
  }

  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  const tileColor = tileColorFromPrimaryColor(challenge.primaryColor);
  const strokeColor = darken(tileColor, 30);
  const shadowColor = darken(tileColor, 60);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        <span>Visual Blueprint</span>
        {is3d && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">3D view</span>
        )}
      </div>
      <div className="overflow-hidden rounded-[16px] border border-slate-200/80 bg-[linear-gradient(160deg,#f8faff,#eef3ff)]">
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
          aria-label={`Blueprint for ${challenge.name}`}
          style={{ display: "block" }}
        >
          {/* Grid dots */}
          {Array.from({ length: Math.ceil(vbH / (U + GAP)) + 1 }).map((_, ri) =>
            Array.from({ length: Math.ceil(vbW / (U + GAP)) + 1 }).map((_, ci) => (
              <circle
                key={`${ri}-${ci}`}
                cx={vbX + padding + ci * (U + GAP)}
                cy={vbY + padding + ri * (U + GAP)}
                r={1}
                fill="rgba(59,130,246,0.15)"
              />
            ))
          )}

          {cells.map((cell, i) =>
            cell.shape === "square" || cell.shape === "rectangle" ? (
              <TileRect
                key={i}
                cell={cell}
                fill={tileColor}
                stroke={strokeColor}
                shadow={shadowColor}
                is3d={is3d}
              />
            ) : (
              <TileTriangle
                key={i}
                cell={cell}
                fill={tileColor}
                stroke={strokeColor}
              />
            )
          )}
        </svg>
      </div>
    </div>
  );
}
