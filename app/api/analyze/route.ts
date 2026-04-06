import { NextRequest, NextResponse } from "next/server";

import type { AnalyzeResponse } from "@/lib/types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY environment variable." },
      { status: 500 }
    );
  }

  const { image } = (await request.json()) as { image?: string };

  if (!image) {
    return NextResponse.json({ error: "Missing image payload." }, { status: 400 });
  }

  const parsedImage = parseDataUrl(image);

  if (!parsedImage) {
    return NextResponse.json(
      { error: "Image must be a valid base64 data URL." },
      { status: 400 }
    );
  }

  try {
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "You are counting magnetic tiles in a photo taken by a child.",
                  "STEP 1 — COUNT CAREFULLY:",
                  "Scan the entire image systematically. Count EVERY tile you can see, including:",
                  "- tiles that are partially hidden behind other tiles",
                  "- tiles in stacks (count each visible layer)",
                  "- tiles at the edges of the frame",
                  "- tiles that are connected to each other in a structure",
                  "Do NOT skip tiles just because they overlap. Be generous — it is better to count a tile you are unsure about than to miss it.",
                  "Count exactly these 4 shapes:",
                  "  squares — perfectly square tiles (all 4 sides equal, all 4 corners 90°)",
                  "  rectangles — oblong tiles that are exactly twice as long as they are wide (a rectangle, like 2 squares side by side)",
                  "  equilateralTriangles — triangles where ALL THREE sides are the same length; they look roughly as wide as they are tall",
                  "  isoscelesTriangles — tall narrow triangles with a short base; they fit perfectly along the long edge of a rectangle",
                  "HOW TO TELL THEM APART:",
                  "  - A tile that looks like 2 squares joined together = rectangle",
                  "  - A triangle as wide as a square side = equilateralTriangle",
                  "  - A triangle as wide as half a square side (fits 2 per square) = isoscelesTriangle",
                  "Count EVERY visible tile of each type, including stacked and overlapping ones.",
                  "STEP 2 — GENERATE 3 CHALLENGES:",
                  "Create 3 building challenges using only the pieces you counted. Never invent pieces that aren't in the image.",
                  "Return JSON only. No markdown. No explanation text.",
                  "Use this exact top-level shape:",
                  '{ "pieceInventory": { "squares": number, "rectangles": number, "equilateralTriangles": number, "isoscelesTriangles": number }, "challenges": [ ...3 items... ] }',
                  "Requirements for challenges:",
                  "- difficulty order must be easy-2d, medium-3d, hard-3d",
                  "- each challenge needs a catchy kid-friendly name",
                  "- each challenge needs exactly one emoji",
                  "- each challenge needs exactly 3 short steps",
                  "- add piecesUsed counts for each challenge and never exceed the detected inventory",
                  "- prefer options that fit the actual mix of pieces well, not generic builds",
                  "- add a preview object with a short caption and tiles on a 3-axis integer grid",
                  "- col = left-right position (integer >= 0)",
                  "- row = front-back depth position (integer >= 0, 0 is front)",
                  "- layer = vertical height (integer >= 0, 0 is ground level, 1 is one tile up, etc.)",
                  "- square occupies 1×1 footprint",
                  "- rectangle occupies 2×1 footprint (col is left edge)",
                  "- equilateralTriangle occupies 1×1 footprint; flip = 'up' or 'down'",
                  "- isoscelesTriangle occupies 1×1 footprint; flip = 'up' or 'down'",
                  "- for easy-2d challenges: all tiles should have layer=0 (flat layout)",
                  "- for medium-3d and hard-3d: use layer > 0 to show height (e.g. a tower has layer 0,1,2 stacked at same col/row)",
                  "- keep footprint compact: 2–5 cols wide, 2–4 rows deep",
                  "- color must be a bright hex like #F59E0B, use a different color per tile",
                  "- use 4 to 12 tiles in the preview",
                  "Each challenge object must look like:",
                  '{ "difficulty": "easy-2d|medium-3d|hard-3d", "name": string, "emoji": string, "steps": [string, string, string], "piecesUsed": { "squares": number, "rectangles": number, "equilateralTriangles": number, "isoscelesTriangles": number }, "preview": { "caption": string, "tiles": [ { "shape": "square|rectangle|equilateralTriangle|isoscelesTriangle", "col": integer, "row": integer, "layer": integer, "color": "#RRGGBB", "flip": "up|down" } ] } }'
                ].join("\n")
              },
              {
                inlineData: {
                  mimeType: parsedImage.mimeType,
                  data: parsedImage.data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 1,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingBudget: 10000
          }
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return NextResponse.json(
        { error: "Gemini request failed.", details: errorText },
        { status: 502 }
      );
    }

    const payload = (await geminiResponse.json()) as GeminiApiResponse;
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini returned an empty response." },
        { status: 502 }
      );
    }

    const analysis = normalizeAnalyzeResponse(JSON.parse(rawText));

    if (!isAnalyzeResponse(analysis)) {
      return NextResponse.json(
        {
          error: "Gemini response did not match expected structure.",
          details: rawText
        },
        { status: 502 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected analysis failure.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2]
  };
}

function isAnalyzeResponse(value: unknown): value is AnalyzeResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as AnalyzeResponse;
  const inventory = response.pieceInventory;

  if (
    !inventory ||
    typeof inventory.squares !== "number" ||
    typeof inventory.rectangles !== "number" ||
    typeof inventory.equilateralTriangles !== "number" ||
    typeof inventory.isoscelesTriangles !== "number"
  ) {
    return false;
  }

  return (
    Array.isArray(response.challenges) &&
    response.challenges.length === 3 &&
    response.challenges.every(
      (challenge) =>
        typeof challenge.name === "string" &&
        typeof challenge.emoji === "string" &&
        Array.isArray(challenge.steps) &&
        challenge.steps.length === 3 &&
        challenge.piecesUsed &&
        typeof challenge.piecesUsed.squares === "number" &&
        typeof challenge.piecesUsed.rectangles === "number" &&
        typeof challenge.piecesUsed.equilateralTriangles === "number" &&
        typeof challenge.piecesUsed.isoscelesTriangles === "number" &&
        challenge.preview &&
        typeof challenge.preview.caption === "string" &&
        Array.isArray(challenge.preview.tiles) &&
        challenge.preview.tiles.length >= 4
    )
  );
}

function normalizeAnalyzeResponse(value: unknown): AnalyzeResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const inventory = toPieceInventory(source.pieceInventory);
  const rawChallenges = Array.isArray(source.challenges) ? source.challenges : [];

  if (!inventory || rawChallenges.length < 3) {
    return null;
  }

  const difficulties: AnalyzeResponse["challenges"][number]["difficulty"][] = [
    "easy-2d",
    "medium-3d",
    "hard-3d"
  ];

  const normalizedChallenges = rawChallenges.slice(0, 3).map((challenge, index) =>
    normalizeChallenge(challenge, difficulties[index], inventory, index)
  );

  if (normalizedChallenges.some((challenge) => !challenge)) {
    return null;
  }

  return {
    pieceInventory: inventory,
    challenges: normalizedChallenges as AnalyzeResponse["challenges"]
  };
}

function normalizeChallenge(
  value: unknown,
  fallbackDifficulty: AnalyzeResponse["challenges"][number]["difficulty"],
  inventory: AnalyzeResponse["pieceInventory"],
  index: number
) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const steps = Array.isArray(source.steps)
    ? source.steps.filter((step): step is string => typeof step === "string").slice(0, 3)
    : [];

  while (steps.length < 3) {
    steps.push(`Keep building step ${steps.length + 1}.`);
  }

  const piecesUsed = clampPiecesUsed(toPieceInventory(source.piecesUsed), inventory);
  const preview = normalizePreview(source.preview, source.name, index);

  return {
    difficulty: normalizeDifficulty(source.difficulty) ?? fallbackDifficulty,
    name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : fallbackName(index),
    emoji: typeof source.emoji === "string" && source.emoji.trim() ? source.emoji.trim() : fallbackEmoji(index),
    steps: [steps[0], steps[1], steps[2]] as [string, string, string],
    piecesUsed,
    preview
  };
}

function normalizeDifficulty(value: unknown) {
  return value === "easy-2d" || value === "medium-3d" || value === "hard-3d" ? value : null;
}

function toPieceInventory(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  return {
    squares: toNonNegativeInt(source.squares),
    rectangles: toNonNegativeInt(source.rectangles),
    equilateralTriangles: toNonNegativeInt(source.equilateralTriangles),
    isoscelesTriangles: toNonNegativeInt(source.isoscelesTriangles)
  };
}

function clampPiecesUsed(
  value: ReturnType<typeof toPieceInventory> | null,
  inventory: AnalyzeResponse["pieceInventory"]
) {
  const pieces = value ?? {
    squares: Math.min(4, inventory.squares),
    rectangles: Math.min(2, inventory.rectangles),
    equilateralTriangles: Math.min(2, inventory.equilateralTriangles),
    isoscelesTriangles: Math.min(1, inventory.isoscelesTriangles)
  };

  return {
    squares: Math.min(pieces.squares, inventory.squares),
    rectangles: Math.min(pieces.rectangles, inventory.rectangles),
    equilateralTriangles: Math.min(pieces.equilateralTriangles, inventory.equilateralTriangles),
    isoscelesTriangles: Math.min(pieces.isoscelesTriangles, inventory.isoscelesTriangles)
  };
}

function normalizePreview(value: unknown, name: unknown, index: number) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawTiles = Array.isArray(source.tiles) ? source.tiles : [];
  const tiles = rawTiles
    .map(normalizePreviewTile)
    .filter((tile): tile is NonNullable<ReturnType<typeof normalizePreviewTile>> => Boolean(tile))
    .slice(0, 12);

  return {
    caption:
      typeof source.caption === "string" && source.caption.trim()
        ? source.caption.trim()
        : `A playful preview of ${typeof name === "string" ? name : fallbackName(index)}.`,
    tiles: tiles.length >= 2 ? tiles : fallbackPreviewTiles(index)
  };
}

function normalizePreviewTile(value: unknown) {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const shape =
    source.shape === "square" ||
    source.shape === "rectangle" ||
    source.shape === "equilateralTriangle" ||
    source.shape === "isoscelesTriangle"
      ? source.shape
      : null;

  if (!shape) return null;

  const rawFlip = source.flip;
  const flip =
    rawFlip === "up" || rawFlip === "down" || rawFlip === "left" || rawFlip === "right"
      ? rawFlip
      : "up";

  return {
    shape,
    col: toNonNegativeInt(source.col),
    row: toNonNegativeInt(source.row),
    layer: toNonNegativeInt(source.layer),
    color: isHexColor(source.color) ? source.color : fallbackColor(shape),
    flip
  };
}

function toNonNegativeInt(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.round(parsed));
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function fallbackColor(shape: "square" | "rectangle" | "equilateralTriangle" | "isoscelesTriangle") {
  if (shape === "square") return "#7DD3C7";
  if (shape === "rectangle") return "#A78BFA";
  if (shape === "equilateralTriangle") return "#FB923C";
  return "#60A5FA";
}

function fallbackName(index: number) {
  return ["Sunny Stack", "Rocket Hop", "Castle Pop"][index] ?? "Tile Build";
}

function fallbackEmoji(index: number) {
  return ["☀️", "🚀", "🏰"][index] ?? "✨";
}

function fallbackPreviewTiles(index: number) {
  const sets = [
    // Easy 2D: simple house flat layout
    [
      { shape: "equilateralTriangle", col: 0, row: 0, layer: 0, color: "#FB923C", flip: "up" },
      { shape: "equilateralTriangle", col: 1, row: 0, layer: 0, color: "#34D399", flip: "up" },
      { shape: "square", col: 0, row: 1, layer: 0, color: "#7DD3C7", flip: "up" },
      { shape: "square", col: 1, row: 1, layer: 0, color: "#60A5FA", flip: "up" },
      { shape: "square", col: 0, row: 2, layer: 0, color: "#FCD34D", flip: "up" },
      { shape: "square", col: 1, row: 2, layer: 0, color: "#F472B6", flip: "up" }
    ],
    // Medium 3D: tower — squares stacked vertically
    [
      { shape: "square", col: 0, row: 0, layer: 0, color: "#7DD3C7", flip: "up" },
      { shape: "square", col: 0, row: 0, layer: 1, color: "#60A5FA", flip: "up" },
      { shape: "square", col: 0, row: 0, layer: 2, color: "#FCD34D", flip: "up" },
      { shape: "equilateralTriangle", col: 0, row: 0, layer: 3, color: "#FB923C", flip: "up" },
      { shape: "square", col: 1, row: 0, layer: 0, color: "#34D399", flip: "up" },
      { shape: "square", col: 1, row: 0, layer: 1, color: "#A78BFA", flip: "up" }
    ],
    // Hard 3D: castle with two towers at different heights
    [
      { shape: "rectangle", col: 0, row: 1, layer: 0, color: "#7DD3C7", flip: "up" },
      { shape: "square", col: 0, row: 0, layer: 0, color: "#60A5FA", flip: "up" },
      { shape: "square", col: 0, row: 0, layer: 1, color: "#F472B6", flip: "up" },
      { shape: "equilateralTriangle", col: 0, row: 0, layer: 2, color: "#FB923C", flip: "up" },
      { shape: "square", col: 1, row: 0, layer: 0, color: "#34D399", flip: "up" },
      { shape: "square", col: 1, row: 0, layer: 1, color: "#FCD34D", flip: "up" },
      { shape: "equilateralTriangle", col: 1, row: 0, layer: 2, color: "#F59E0B", flip: "up" }
    ]
  ] as const;

  return sets[index] ?? sets[0];
}

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};
