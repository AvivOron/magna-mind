import { NextRequest, NextResponse } from "next/server";

import type { BuildMatrixNode, BuildingChallenge, PieceInventory, TileShape } from "@/lib/types";

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

  const { inventory, completedNames } = (await request.json()) as {
    inventory?: PieceInventory;
    completedNames?: string[];
  };

  if (!inventory) {
    return NextResponse.json({ error: "Missing inventory." }, { status: 400 });
  }

  const avoidList = completedNames?.length
    ? `The child already completed these builds. Do not repeat or closely rename them: ${completedNames.join(", ")}.`
    : "";

  try {
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "A child wants more magnetic tile building ideas.",
                  `Tile inventory: squares=${inventory.squares}, rectangles=${inventory.rectangles}, equilateralTriangles=${inventory.equilateralTriangles}, isoscelesTriangles=${inventory.isoscelesTriangles}.`,
                  avoidList,
                  "Generate 3 new challenges using only the available pieces.",
                  "Return JSON only. No markdown.",
                  'Use this exact shape: { "challenges": [ ...3 items... ] }',
                  "Requirements:",
                  "- difficulty order must be easy-2d, medium-3d, hard-3d",
                  "- each challenge needs a catchy kid-friendly name, exactly one emoji, exactly 3 short build steps",
                  "- add piecesUsed counts and never exceed the inventory",
                  "- add primaryColor as a vivid color name",
                  "- add preview.caption as a short schematic caption",
                  "- add buildMatrix as an array of 2 to 4 sections",
                  '- each buildMatrix item must be: { "section": string, "position": "base|middle|top|left|center|right", "shapes": ["square|rectangle|equilateralTriangle|isoscelesTriangle"] }',
                  "- if the build is house-like, include a triangle roof section",
                  'Each challenge: { "difficulty": "easy-2d|medium-3d|hard-3d", "name": string, "emoji": string, "steps": [string, string, string], "piecesUsed": { "squares": number, "rectangles": number, "equilateralTriangles": number, "isoscelesTriangles": number }, "primaryColor": string, "preview": { "caption": string }, "buildMatrix": [{ "section": string, "position": "base|middle|top|left|center|right", "shapes": ["square|rectangle|equilateralTriangle|isoscelesTriangle"] }] }'
                ].join("\n")
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 1,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 5000 }
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
      return NextResponse.json({ error: "Gemini returned an empty response." }, { status: 502 });
    }

    const parsed = JSON.parse(extractJson(rawText)) as { challenges?: unknown[] };
    const rawChallenges = Array.isArray(parsed.challenges) ? parsed.challenges : [];
    const challenges = rawChallenges
      .slice(0, 3)
      .map((challenge, index) =>
        normalizeChallenge(
          challenge,
          ["easy-2d", "medium-3d", "hard-3d"][index] as BuildingChallenge["difficulty"],
          inventory,
          index
        )
      )
      .filter((challenge): challenge is BuildingChallenge => Boolean(challenge));

    if (challenges.length === 0) {
      return NextResponse.json({ error: "No valid challenges generated." }, { status: 502 });
    }

    return NextResponse.json({ challenges });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected failure.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

function normalizeChallenge(
  value: unknown,
  fallbackDifficulty: BuildingChallenge["difficulty"],
  inventory: PieceInventory,
  index: number
): BuildingChallenge | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const steps = Array.isArray(source.steps)
    ? source.steps.filter((step): step is string => typeof step === "string").slice(0, 3)
    : [];

  while (steps.length < 3) {
    steps.push(`Step ${steps.length + 1}.`);
  }

  return {
    difficulty: normalizeDifficulty(source.difficulty) ?? fallbackDifficulty,
    name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : fallbackName(index),
    emoji: typeof source.emoji === "string" && source.emoji.trim() ? source.emoji.trim() : fallbackEmoji(index),
    steps: [steps[0], steps[1], steps[2]] as [string, string, string],
    piecesUsed: clampPiecesUsed(toPieceInventory(source.piecesUsed), inventory),
    primaryColor:
      typeof source.primaryColor === "string" && source.primaryColor.trim()
        ? source.primaryColor.trim()
        : fallbackPrimaryColor(index),
    preview: {
      caption:
        previewCaption(source.preview) ??
        `Blueprint view for ${typeof source.name === "string" ? source.name : fallbackName(index)}.`
    },
    buildMatrix: normalizeBuildMatrix(source.buildMatrix, source.name, index)
  };
}

function normalizeDifficulty(value: unknown): BuildingChallenge["difficulty"] | null {
  return value === "easy-2d" || value === "medium-3d" || value === "hard-3d" ? value : null;
}

function toPieceInventory(value: unknown): PieceInventory | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  return {
    squares: toNonNegInt(source.squares),
    rectangles: toNonNegInt(source.rectangles),
    equilateralTriangles: toNonNegInt(source.equilateralTriangles),
    isoscelesTriangles: toNonNegInt(source.isoscelesTriangles)
  };
}

function clampPiecesUsed(pieces: PieceInventory | null, inventory: PieceInventory): PieceInventory {
  const value = pieces ?? {
    squares: Math.min(4, inventory.squares),
    rectangles: Math.min(2, inventory.rectangles),
    equilateralTriangles: Math.min(2, inventory.equilateralTriangles),
    isoscelesTriangles: Math.min(1, inventory.isoscelesTriangles)
  };

  return {
    squares: Math.min(value.squares, inventory.squares),
    rectangles: Math.min(value.rectangles, inventory.rectangles),
    equilateralTriangles: Math.min(value.equilateralTriangles, inventory.equilateralTriangles),
    isoscelesTriangles: Math.min(value.isoscelesTriangles, inventory.isoscelesTriangles)
  };
}

function normalizeBuildMatrix(value: unknown, name: unknown, index: number): BuildMatrixNode[] {
  const sections = Array.isArray(value)
    ? value
        .map(normalizeBuildMatrixNode)
        .filter((section): section is BuildMatrixNode => Boolean(section))
        .slice(0, 4)
    : [];

  return sections.length >= 2
    ? sections
    : fallbackBuildMatrix(typeof name === "string" ? name : fallbackName(index), index);
}

function normalizeBuildMatrixNode(value: unknown): BuildMatrixNode | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const position =
    source.position === "base" ||
    source.position === "middle" ||
    source.position === "top" ||
    source.position === "left" ||
    source.position === "center" ||
    source.position === "right"
      ? source.position
      : null;
  const shapes = Array.isArray(source.shapes)
    ? source.shapes.filter((shape): shape is TileShape => isTileShape(shape)).slice(0, 4)
    : [];

  if (!position || shapes.length === 0) return null;

  return {
    section: typeof source.section === "string" && source.section.trim() ? source.section.trim() : position,
    position,
    shapes
  };
}

function isTileShape(value: unknown): value is TileShape {
  return (
    value === "square" ||
    value === "rectangle" ||
    value === "equilateralTriangle" ||
    value === "isoscelesTriangle"
  );
}

function previewCaption(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const preview = value as Record<string, unknown>;
  return typeof preview.caption === "string" && preview.caption.trim() ? preview.caption.trim() : null;
}

function toNonNegInt(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : 0;
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
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
};

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}
