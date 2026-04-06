# Magna-Mind — Claude Code Context

## What this app does

Kids scan their magnetic tile collection with a photo. Gemini counts the tiles, generates 3 building challenges matched to the exact inventory, and walks the child through building it step by step.

## Commands

```bash
npm run dev     # start dev server on localhost:3000
npm run build   # production build
npm run lint    # ESLint
```

## Architecture

### API route: `app/api/analyze/route.ts`

Single `POST /api/analyze` endpoint. Takes a base64 image, sends it to Gemini 2.5 Flash with a structured prompt, and returns `AnalyzeResponse` (inventory counts + 3 challenges).

Key design decisions:
- Gemini uses thinking mode (`thinkingBudget: 10000`, `temperature: 1`) for better counting accuracy
- Response is normalized and validated before returning — Gemini output is untrusted
- `normalizeAnalyzeResponse` clamps all piece counts so challenges never exceed inventory

### UI: `components/app-shell.tsx`

Step-based flow managed entirely with local state (`AppStep = "scan" | "pick" | "build" | "celebrate"`). Each step is a separate component — `ScanStep`, `PickStep`, `BuildStep`, `CelebrateStep` — rendered with `AnimatePresence mode="wait"` for slide transitions.

Global state (inventory + challenges) lives in Zustand (`store/useInventoryStore.ts`).

### Preview renderer

Tiles are placed on an integer grid (`col`, `row`, `layer`). The renderer auto-detects:
- `easy-2d` + no layers → flat 2D grid (top-down)
- `medium-3d` / `hard-3d` + `layer > 0` → isometric projection with top/left/right faces

Isometric painter's sort: `row` descending, then `col` ascending, then `layer` ascending.

### Types: `lib/types.ts`

`PreviewTile` uses `col/row/layer` integer coordinates — **not** free-form x/y/size. This is intentional: AI coordinates were unreliable so positioning is now fully deterministic.

## Tile shapes

Four types in `PieceInventory` and `PreviewTile`:
- `square` — 1×1 grid cell
- `rectangle` — 2×1 grid cells
- `equilateralTriangle` — 1×1 cell, `flip: "up" | "down"`
- `isoscelesTriangle` — 1×1 cell, `flip: "up" | "down"`

## Known counting issues

Gemini undercounts triangles. The prompt explicitly:
- Distinguishes equilateral triangles (wide, all sides equal) from isosceles (tall, narrow)
- Instructs to count overlapping and stacked tiles
- Uses thinking mode for careful multi-step reasoning

If counting is still off, the most likely fix is improving the shape descriptions in the prompt (`STEP 1` section of `route.ts`).

## Styling

Custom "soft brutal" design system: `border: 2px solid #222222`, `border-radius: 32px`, soft box shadow. Defined in `globals.css` as `.soft-brutal-card`. Color palette: `cream`, `mint`, `coral`, `sky`, `ink` — all in `tailwind.config.ts`.
