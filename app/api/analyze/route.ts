import { NextRequest, NextResponse } from "next/server";

import type { AnalyzeResponse, BuildMatrixNode, BuildingChallenge, TileShape } from "@/lib/types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const fallbackDetectedColors = ["#ef4444", "#0ea5e9", "#f59e0b", "#22c55e"];

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
                  "You are analyzing a real photo of Magna-Tiles style magnetic tiles taken by a child.",
                  "STEP 1 — COUNT CAREFULLY:",
                  "Count EVERY visible tile in the image, including partially occluded tiles, stacked tiles, edge tiles, and tiles already assembled in a build.",
                  "Only count these shapes: squares, rectangles, equilateralTriangles, isoscelesTriangles.",
                  "STEP 2 — DETECT TILE COLORS:",
                  "Identify the main tile colors actually visible in the photo. Return 3 to 6 bright hex colors in detectedColors.",
                  "STEP 3 — GENERATE 3 BUILDS:",
                  "Generate 3 build ideas using only the counted inventory. Never invent extra pieces.",
                  "Return JSON only. No markdown. No explanation text.",
                  "Use this exact top-level shape:",
                  '{ "pieceInventory": { "squares": number, "rectangles": number, "equilateralTriangles": number, "isoscelesTriangles": number }, "detectedColors": ["#RRGGBB"], "challenges": [ ...3 items... ] }',
                  "Challenge requirements:",
                  "- difficulty order must be easy-2d, medium-3d, hard-3d",
                  "- each challenge needs a catchy kid-friendly name",
                  "- each challenge needs exactly one emoji",
                  "- each challenge needs exactly 3 short steps",
                  "- add piecesUsed counts and never exceed the detected inventory",
                  "- add primaryColor as a vivid color name like Ruby Red, Ocean Blue, Sunburst Yellow, Mint Glow",
                  "- add preview.caption as a short schematic caption",
                  "- add buildMatrix as an array of sections describing shape placement",
                  "- each buildMatrix item must be: { section: string, position: \"base\"|\"middle\"|\"top\"|\"left\"|\"center\"|\"right\", shapes: [\"square\"|\"rectangle\"|\"equilateralTriangle\"|\"isoscelesTriangle\"] }",
                  "- keep buildMatrix compact with 2 to 4 sections and 1 to 4 shapes per section",
                  "- if the build is house-like, include a base section of squares/rectangles and a top section with triangles",
                  'Each challenge object must look like: { "difficulty": "easy-2d|medium-3d|hard-3d", "name": string, "emoji": string, "steps": [string, string, string], "piecesUsed": { "squares": number, "rectangles": number, "equilateralTriangles": number, "isoscelesTriangles": number }, "primaryColor": string, "preview": { "caption": string }, "buildMatrix": [{ "section": string, "position": "base|middle|top|left|center|right", "shapes": ["square|rectangle|equilateralTriangle|isoscelesTriangle"] }] }'
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
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const rawText = parts.find((part) => !part.thought && typeof part.text === "string")?.text;

    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini returned an empty response." },
        { status: 502 }
      );
    }

    const analysis = normalizeAnalyzeResponse(JSON.parse(extractJson(rawText)));

    if (!analysis) {
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

function normalizeAnalyzeResponse(value: unknown): AnalyzeResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const inventory = toPieceInventory(source.pieceInventory);
  const rawChallenges = Array.isArray(source.challenges) ? source.challenges : [];
  const detectedColors = normalizeDetectedColors(source.detectedColors);

  if (!inventory || rawChallenges.length < 3) {
    return null;
  }

  const difficulties: BuildingChallenge["difficulty"][] = ["easy-2d", "medium-3d", "hard-3d"];
  const challenges = rawChallenges.slice(0, 3).map((challenge, index) =>
    normalizeChallenge(challenge, difficulties[index], inventory, index)
  );

  if (challenges.some((challenge) => !challenge)) {
    return null;
  }

  return {
    pieceInventory: inventory,
    detectedColors,
    challenges: challenges as AnalyzeResponse["challenges"]
  };
}

function normalizeChallenge(
  value: unknown,
  fallbackDifficulty: BuildingChallenge["difficulty"],
  inventory: AnalyzeResponse["pieceInventory"],
  index: number
): BuildingChallenge | null {
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
  const buildMatrix = normalizeBuildMatrix(source.buildMatrix, source.name, index);

  return {
    difficulty: normalizeDifficulty(source.difficulty) ?? fallbackDifficulty,
    name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : fallbackName(index),
    emoji: typeof source.emoji === "string" && source.emoji.trim() ? source.emoji.trim() : fallbackEmoji(index),
    steps: [steps[0], steps[1], steps[2]] as [string, string, string],
    piecesUsed,
    primaryColor:
      typeof source.primaryColor === "string" && source.primaryColor.trim()
        ? source.primaryColor.trim()
        : fallbackPrimaryColor(index),
    preview: {
      caption:
        valuePreviewCaption(source.preview) ??
        `Blueprint view for ${typeof source.name === "string" ? source.name : fallbackName(index)}.`
    },
    buildMatrix
  };
}

function valuePreviewCaption(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const preview = value as Record<string, unknown>;
  return typeof preview.caption === "string" && preview.caption.trim() ? preview.caption.trim() : null;
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

function normalizeBuildMatrix(value: unknown, name: unknown, index: number): BuildMatrixNode[] {
  const rawSections = Array.isArray(value) ? value : [];
  const sections = rawSections
    .map(normalizeBuildMatrixNode)
    .filter((section): section is BuildMatrixNode => Boolean(section))
    .slice(0, 4);

  return sections.length >= 2
    ? sections
    : fallbackBuildMatrix(typeof name === "string" ? name : fallbackName(index), index);
}

function normalizeBuildMatrixNode(value: unknown): BuildMatrixNode | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const position = normalizePosition(source.position);
  const shapes = Array.isArray(source.shapes)
    ? source.shapes.filter((shape): shape is TileShape => isTileShape(shape)).slice(0, 4)
    : [];

  if (!position || shapes.length === 0) {
    return null;
  }

  return {
    section: typeof source.section === "string" && source.section.trim() ? source.section.trim() : position,
    position,
    shapes
  };
}

function normalizePosition(value: unknown) {
  return value === "base" ||
    value === "middle" ||
    value === "top" ||
    value === "left" ||
    value === "center" ||
    value === "right"
    ? value
    : null;
}

function isTileShape(value: unknown): value is TileShape {
  return (
    value === "square" ||
    value === "rectangle" ||
    value === "equilateralTriangle" ||
    value === "isoscelesTriangle"
  );
}

function normalizeDetectedColors(value: unknown) {
  if (!Array.isArray(value)) {
    return fallbackDetectedColors;
  }

  const colors = value.filter((entry): entry is string => isHexColor(entry)).slice(0, 6);
  return colors.length >= 3 ? colors : fallbackDetectedColors;
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

function fallbackName(index: number) {
  return ["Sun House", "Rocket Tower", "Castle Gate"][index] ?? "Tile Build";
}

function fallbackEmoji(index: number) {
  return ["🏠", "🚀", "🏰"][index] ?? "✨";
}

function fallbackPrimaryColor(index: number) {
  return ["Ruby Red", "Ocean Blue", "Sunburst Yellow"][index] ?? "Mint Glow";
}

function fallbackBuildMatrix(name: string, index: number): BuildMatrixNode[] {
  if (/house|home|cabin|barn|hut/i.test(name)) {
    return [
      { section: "base", position: "base", shapes: ["square", "square"] },
      { section: "roof", position: "top", shapes: ["equilateralTriangle"] }
    ];
  }

  const sets: BuildMatrixNode[][] = [
    [
      { section: "base", position: "base", shapes: ["square", "square"] },
      { section: "roof", position: "top", shapes: ["equilateralTriangle"] }
    ],
    [
      { section: "core", position: "middle", shapes: ["rectangle"] },
      { section: "boosters", position: "base", shapes: ["square", "square"] },
      { section: "nose", position: "top", shapes: ["equilateralTriangle"] }
    ],
    [
      { section: "towers", position: "left", shapes: ["square", "square"] },
      { section: "bridge", position: "center", shapes: ["rectangle"] },
      { section: "spire", position: "top", shapes: ["equilateralTriangle", "equilateralTriangle"] }
    ]
  ];

  return sets[index] ?? sets[0];
}

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        thought?: boolean;
      }>;
    };
  }>;
};

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}
