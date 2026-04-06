"use client";

import { startTransition, useRef, useState } from "react";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  Layers3,
  RotateCcw,
  Star,
  Trophy,
  Upload
} from "lucide-react";

import type { AnalyzeResponse, BuildingChallenge, PieceInventory, PreviewTile } from "@/lib/types";
import { useInventoryStore } from "@/store/useInventoryStore";

const tiles = [
  { label: "Squares", key: "squares", color: "bg-mint" },
  { label: "Rectangles", key: "rectangles", color: "bg-sky" },
  { label: "Eq. Triangles", key: "equilateralTriangles", color: "bg-coral" },
  { label: "Iso. Triangles", key: "isoscelesTriangles", color: "bg-sky" }
] as const;

const challengeColors = ["bg-mint", "bg-coral", "bg-sky"] as const;
const demoImageSrc = "/tiles.jpeg";

type AppStep = "scan" | "pick" | "build" | "celebrate";

export function AppShell() {
  const { inventory, challenges, reset, setAnalysis } = useInventoryStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string>(demoImageSrc);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState<AppStep>("scan");
  const [selectedChallenge, setSelectedChallenge] = useState<BuildingChallenge | null>(null);
  const [completedChallenge, setCompletedChallenge] = useState<BuildingChallenge | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAnalyze() {
    let screenshot: string | null = null;
    try {
      screenshot = await toDataUrl(capturedImage);
    } catch {
      setErrorMessage("Could not load the image.");
      return;
    }

    if (!screenshot) {
      setErrorMessage("The image is missing.");
      return;
    }

    setCapturedImage(screenshot);
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: screenshot })
      });

      const data = (await response.json()) as AnalyzeResponse & {
        error?: string;
        details?: string;
      };

      if (!response.ok || data.error) {
        throw new Error(data.details || data.error || "Analysis failed.");
      }

      startTransition(() => {
        setAnalysis(data);
      });

      setSelectedChallenge(data.challenges[0] ?? null);
      setStep("pick");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Analysis failed. Please try another photo."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleReset() {
    setCapturedImage(demoImageSrc);
    setErrorMessage(null);
    setSelectedChallenge(null);
    setCompletedChallenge(null);
    setStep("scan");
    reset();
  }

  function handlePickChallenge(challenge: BuildingChallenge) {
    setSelectedChallenge(challenge);
    setStep("build");
  }

  function handleComplete(challenge: BuildingChallenge) {
    setCompletedChallenge(challenge);
    setStep("celebrate");
    confetti({
      particleCount: 160,
      spread: 90,
      startVelocity: 45,
      origin: { y: 0.7 }
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setCapturedImage(reader.result);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  }

  const stepIndex = { scan: 0, pick: 1, build: 2, celebrate: 3 }[step];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-20 pt-4 text-ink sm:max-w-lg">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center justify-between"
      >
        <div className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white/80 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em]">
          <Star className="h-3.5 w-3.5" />
          Magna-Mind
        </div>
        {step !== "scan" && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleReset}
            className="soft-brutal-card flex items-center gap-1.5 bg-white/85 px-3 py-2 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Start Over
          </motion.button>
        )}
      </motion.header>

      {/* Step Progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="mb-5 grid grid-cols-3 gap-2"
      >
        {[
          { label: "Scan", color: "bg-coral" },
          { label: "Pick Build", color: "bg-mint" },
          { label: "Celebrate", color: "bg-sky" }
        ].map((s, i) => {
          const active = stepIndex >= i;
          return (
            <div
              key={s.label}
              className={`flex items-center gap-2 rounded-2xl border-2 border-ink px-3 py-2 transition-colors ${
                active ? s.color : "bg-white/60"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink text-xs font-bold ${
                  active ? "bg-white" : "bg-white/50"
                }`}
              >
                {stepIndex > i ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="text-xs font-bold">{s.label}</span>
            </div>
          );
        })}
      </motion.div>

      {/* Steps */}
      <AnimatePresence mode="wait">
        {step === "scan" && (
          <ScanStep
            key="scan"
            capturedImage={capturedImage}
            isAnalyzing={isAnalyzing}
            errorMessage={errorMessage}
            fileInputRef={fileInputRef}
            onAnalyze={handleAnalyze}
          />
        )}

        {step === "pick" && (
          <PickStep
            key="pick"
            challenges={challenges}
            inventory={inventory}
            onPick={handlePickChallenge}
            onBack={() => setStep("scan")}
          />
        )}

        {step === "build" && selectedChallenge && (
          <BuildStep
            key="build"
            challenge={selectedChallenge}
            inventory={inventory}
            onComplete={handleComplete}
            onBack={() => setStep("pick")}
          />
        )}

        {step === "celebrate" && completedChallenge && (
          <CelebrateStep
            key="celebrate"
            challenge={completedChallenge}
            onKeepBuilding={() => setStep("pick")}
            onReset={handleReset}
          />
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </main>
  );
}

/* ─── Scan Step ─────────────────────────────────────────────────────────── */

function ScanStep({
  capturedImage,
  isAnalyzing,
  errorMessage,
  fileInputRef,
  onAnalyze
}: {
  capturedImage: string;
  isAnalyzing: boolean;
  errorMessage: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAnalyze: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col gap-4"
    >
      <div className="soft-brutal-card bg-[linear-gradient(135deg,#fffaf0,#b9f2de_45%,#daf4ff)] p-5">
        <h1 className="font-display text-3xl font-semibold leading-tight text-balance">
          Show me your tiles!
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Use the demo photo, or snap your own pile of magnetic tiles.
        </p>
      </div>

      <div className="soft-brutal-card overflow-hidden bg-white/85">
        {/* Image preview */}
        <div className="relative h-72 overflow-hidden rounded-t-[30px] bg-cream">
          <img
            src={capturedImage}
            alt="Tile photo"
            className="h-full w-full object-cover"
          />
          {isAnalyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cream/80 backdrop-blur-sm">
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [-6, 6, -6] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-mint"
              >
                <Layers3 className="h-6 w-6" />
              </motion.div>
              <p className="font-display text-xl font-semibold">Counting tiles...</p>
              <p className="text-sm text-ink/65">This takes a few seconds</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4">
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="soft-brutal-card flex flex-1 items-center justify-center gap-2 bg-white px-4 py-4 font-display text-base font-semibold disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Use My Photo
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="soft-brutal-card flex-[2] bg-coral px-5 py-4 font-display text-base font-semibold disabled:opacity-50"
          >
            {isAnalyzing ? "Counting..." : "Count These Tiles →"}
          </motion.button>
        </div>

        {errorMessage && (
          <div className="mx-4 mb-4 rounded-2xl border-2 border-ink bg-coral/60 px-4 py-3 text-sm font-semibold">
            {errorMessage}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-ink/45">
        Demo photo loaded · tap &quot;Use My Photo&quot; to use your own
      </p>
    </motion.div>
  );
}

/* ─── Pick Step ─────────────────────────────────────────────────────────── */

function PickStep({
  challenges,
  inventory,
  onPick,
  onBack
}: {
  challenges: BuildingChallenge[];
  inventory: PieceInventory;
  onPick: (challenge: BuildingChallenge) => void;
  onBack: () => void;
}) {
  const total =
    inventory.squares + inventory.equilateralTriangles + inventory.isoscelesTriangles;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col gap-4"
    >
      {/* Inventory summary */}
      <div className="soft-brutal-card bg-mint/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-display text-xl font-semibold">Your Pieces</p>
            <p className="text-sm text-ink/65">Counted from your photo</p>
          </div>
          <Layers3 className="h-5 w-5 opacity-50" />
        </div>
        <div className="flex gap-2">
          {tiles.map((tile) => (
            <div
              key={tile.key}
              className={`soft-brutal-card flex flex-1 flex-col items-center gap-1 ${tile.color} py-3`}
            >
              <span className="font-display text-2xl font-bold">{inventory[tile.key]}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-ink/60 text-center leading-tight">
                {tile.label}
              </span>
            </div>
          ))}
        </div>
        {total === 0 && (
          <p className="mt-3 rounded-2xl border-2 border-ink bg-white/70 px-4 py-2 text-sm font-semibold text-ink/70">
            No pieces detected — try a clearer photo or check the lighting.
          </p>
        )}
      </div>

      {/* Challenge cards */}
      <div>
        <p className="mb-3 font-display text-xl font-semibold">Pick a build challenge</p>
        <div className="flex flex-col gap-3">
          {challenges.map((challenge, index) => (
            <motion.article
              key={challenge.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
              className={`soft-brutal-card p-4 ${challengeColors[index] ?? "bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl font-semibold">
                      {challenge.emoji} {challenge.name}
                    </p>
                    <span
                      className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] bg-white/70`}
                    >
                      {formatDifficulty(challenge.difficulty)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink/65">{challenge.preview.caption}</p>
                </div>
                <BuildPreview challenge={challenge} compact />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  <UsagePill label="Sq" value={challenge.piecesUsed.squares} total={inventory.squares} />
                  <UsagePill label="Rect" value={challenge.piecesUsed.rectangles} total={inventory.rectangles} />
                  <UsagePill label="Eq△" value={challenge.piecesUsed.equilateralTriangles} total={inventory.equilateralTriangles} />
                  <UsagePill label="Iso△" value={challenge.piecesUsed.isoscelesTriangles} total={inventory.isoscelesTriangles} />
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onPick(challenge)}
                  className="soft-brutal-card bg-ink px-5 py-3 font-display text-sm font-semibold text-white"
                >
                  Pick This →
                </motion.button>
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-sm font-semibold text-ink/55 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to scan
      </button>
    </motion.div>
  );
}

/* ─── Build Step ─────────────────────────────────────────────────────────── */

function BuildStep({
  challenge,
  inventory,
  onComplete,
  onBack
}: {
  challenge: BuildingChallenge;
  inventory: PieceInventory;
  onComplete: (challenge: BuildingChallenge) => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col gap-4"
    >
      {/* Challenge header */}
      <div className="soft-brutal-card bg-[linear-gradient(135deg,#daf4ff,#b9f2de)] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink/50">
          {formatDifficulty(challenge.difficulty)}
        </p>
        <p className="font-display text-3xl font-semibold leading-tight">
          {challenge.emoji} {challenge.name}
        </p>
        <p className="mt-2 text-sm text-ink/65">{challenge.preview.caption}</p>
      </div>

      {/* Preview + pieces */}
      <div className="soft-brutal-card overflow-hidden bg-white/85 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <BuildPreview challenge={challenge} />
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">
              Pieces needed
            </p>
            <div className="flex flex-col gap-2">
              {tiles.map((tile) => (
                <div
                  key={tile.key}
                  className={`soft-brutal-card flex items-center justify-between px-4 py-3 ${tile.color}`}
                >
                  <span className="text-sm font-semibold">{tile.label}</span>
                  <span className="font-display text-lg font-bold">
                    {challenge.piecesUsed[tile.key]}
                    <span className="text-sm font-normal text-ink/45">/{inventory[tile.key]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="soft-brutal-card bg-cream p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink/50">How to build it</p>
        <div className="flex flex-col gap-3">
          {challenge.steps.map((step, index) => (
            <div
              key={index}
              className="flex gap-3 rounded-2xl border-2 border-ink bg-white px-4 py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-coral font-display text-sm font-bold">
                {index + 1}
              </span>
              <span className="text-sm font-semibold leading-6">
                {step.replace(/^\d+\.\s*/, "")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="soft-brutal-card flex items-center gap-2 bg-white px-4 py-4 font-display text-base font-semibold"
        >
          <ChevronLeft className="h-4 w-4" />
          Change Build
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onComplete(challenge)}
          className="soft-brutal-card flex-1 bg-ink px-5 py-4 font-display text-base font-semibold text-white"
        >
          🎉 I Built It!
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Celebrate Step ─────────────────────────────────────────────────────── */

function CelebrateStep({
  challenge,
  onKeepBuilding,
  onReset
}: {
  challenge: BuildingChallenge;
  onKeepBuilding: () => void;
  onReset: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="flex flex-col items-center gap-5 py-8 text-center"
    >
      <motion.div
        animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="flex h-24 w-24 items-center justify-center rounded-[32px] border-2 border-ink bg-mint shadow-card"
      >
        <Trophy className="h-11 w-11" />
      </motion.div>

      <div>
        <p className="font-display text-4xl font-semibold">Master Builder!</p>
        <p className="mt-2 text-base text-ink/65">
          You finished {challenge.emoji} {challenge.name}
        </p>
      </div>

      <div className="soft-brutal-card w-full bg-cream p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/50">Badge Unlocked</p>
        <p className="mt-1 font-display text-xl font-semibold">🏅 Magnetic Architect</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onKeepBuilding}
          className="soft-brutal-card w-full bg-coral px-5 py-4 font-display text-lg font-semibold"
        >
          Try Another Build
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          className="soft-brutal-card w-full bg-white px-5 py-4 font-display text-base font-semibold"
        >
          Scan New Tiles
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Shared helpers ─────────────────────────────────────────────────────── */

function formatDifficulty(difficulty: BuildingChallenge["difficulty"]) {
  if (difficulty === "easy-2d") return "Easy 2D";
  if (difficulty === "medium-3d") return "Medium 3D";
  return "Hard 3D";
}

async function toDataUrl(src: string) {
  if (src.startsWith("data:")) return src;

  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load the demo picture.");
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read the demo picture."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the demo picture."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Isometric magnetic tile preview.
 *
 * Grid: col = right, row = back (depth), layer = up.
 * Isometric projection: X axis goes right+down, Y axis goes left+down, Z axis goes up.
 *
 * iso(col, row, layer) → screen (sx, sy):
 *   sx = (col - row) * (s / 2)
 *   sy = (col + row) * (s / 4) - layer * (s / 2)
 *
 * Tiles are sorted back-to-front (painter's algorithm): higher row first,
 * then lower col, then lower layer.
 */
function isoProject(col: number, row: number, layer: number, s: number) {
  return {
    x: (col - row) * (s / 2),
    y: (col + row) * (s / 4) - layer * (s * 0.6)
  };
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function BuildPreview({
  challenge,
  compact = false
}: {
  challenge: BuildingChallenge;
  compact?: boolean;
}) {
  const rawTiles = challenge.preview.tiles;
  const id = challenge.name.replace(/\s+/g, "-");
  const is3d = challenge.difficulty !== "easy-2d";

  // Auto-detect if any tile has layer > 0 to decide rendering mode
  const hasLayers = rawTiles.some((t) => (t.layer ?? 0) > 0);
  const use3d = is3d && hasLayers;

  // Choose cell size to fit canvas
  const CANVAS = 100;

  if (!use3d) {
    // ── Flat 2D grid renderer ──────────────────────────────────────────────
    const bounds = rawTiles.map((t) => ({
      c0: t.col, c1: t.col + (t.shape === "rectangle" ? 2 : 1),
      r0: t.row, r1: t.row + 1
    }));
    const minC = Math.min(...bounds.map((b) => b.c0));
    const maxC = Math.max(...bounds.map((b) => b.c1));
    const minR = Math.min(...bounds.map((b) => b.r0));
    const maxR = Math.max(...bounds.map((b) => b.r1));
    const gW = Math.max(maxC - minC, 1);
    const gH = Math.max(maxR - minR, 1);
    const s = Math.min((CANVAS - 16) / gW, (CANVAS - 16) / gH, 24);
    const ox = (CANVAS - gW * s) / 2 - minC * s;
    const oy = (CANVAS - gH * s) / 2 - minR * s;

    return (
      <div className={`soft-brutal-card overflow-hidden bg-[#f0f6ff] ${compact ? "h-28 w-28 shrink-0" : ""}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-label={`${challenge.name} preview`}>
          <defs>
            <filter id={`sh-${id}`} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#1a1a2e" floodOpacity="0.2" />
            </filter>
          </defs>
          <rect width="100" height="100" fill="#f0f6ff" />
          {rawTiles.map((tile, i) => {
            const px = ox + tile.col * s;
            const py = oy + tile.row * s;
            const color = /^#[0-9a-fA-F]{6}$/.test(tile.color) ? tile.color : "#7DD3C7";
            return (
              <g key={i} filter={`url(#sh-${id})`}>
                <FlatTile shape={tile.shape} flip={tile.flip ?? "up"} x={px} y={py} s={s} color={color} />
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // ── Isometric 3D renderer ──────────────────────────────────────────────
  // Compute iso bounding box to auto-fit
  const isoPoints = rawTiles.flatMap((t) => {
    const s0 = 1;
    const cols = t.shape === "rectangle" ? [t.col, t.col + 1] : [t.col];
    return cols.flatMap((c) => [
      isoProject(c, t.row, t.layer ?? 0, s0),
      isoProject(c + 1, t.row, t.layer ?? 0, s0),
      isoProject(c, t.row + 1, t.layer ?? 0, s0),
      isoProject(c + 1, t.row + 1, t.layer ?? 0, s0),
      isoProject(c, t.row, (t.layer ?? 0) + 1, s0),
    ]);
  });
  const minX = Math.min(...isoPoints.map((p) => p.x));
  const maxX = Math.max(...isoPoints.map((p) => p.x));
  const minY = Math.min(...isoPoints.map((p) => p.y));
  const maxY = Math.max(...isoPoints.map((p) => p.y));
  const isoW = Math.max(maxX - minX, 0.01);
  const isoH = Math.max(maxY - minY, 0.01);
  const s = Math.min((CANVAS - 20) / isoW, (CANVAS - 20) / isoH, 28);
  const centerX = CANVAS / 2 - (minX + isoW / 2) * s;
  const centerY = CANVAS / 2 - (minY + isoH / 2) * s + 4;

  // Painter's sort: larger row first (back), then smaller col, then smaller layer
  const sorted = [...rawTiles].sort((a, b) => {
    if (b.row !== a.row) return b.row - a.row;
    if (a.col !== b.col) return a.col - b.col;
    return (a.layer ?? 0) - (b.layer ?? 0);
  });

  return (
    <div className={`soft-brutal-card overflow-hidden bg-[#1a1f35] ${compact ? "h-28 w-28 shrink-0" : ""}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-label={`${challenge.name} preview`}>
        <defs>
          <radialGradient id={`ibg-${id}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#2a3050" />
            <stop offset="100%" stopColor="#111628" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#ibg-${id})`} />
        {/* Ground grid dots */}
        {sorted.map((tile, i) => {
          const color = /^#[0-9a-fA-F]{6}$/.test(tile.color) ? tile.color : "#7DD3C7";
          const iso = isoProject(tile.col, tile.row, tile.layer ?? 0, s);
          const sx = iso.x + centerX;
          const sy = iso.y + centerY;
          return (
            <IsoTile
              key={i}
              shape={tile.shape}
              sx={sx}
              sy={sy}
              s={s}
              color={color}
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Flat (2D) tile renderer */
function FlatTile({
  shape, flip, x, y, s, color
}: {
  shape: PreviewTile["shape"]; flip: string;
  x: number; y: number; s: number; color: string;
}) {
  const border = "#22223a";
  const bw = 1.0;
  const ins = s * 0.14;

  if (shape === "square") {
    return (
      <g>
        <rect x={x} y={y} width={s} height={s} rx={s * 0.14} fill={color} stroke={border} strokeWidth={bw} />
        <rect x={x+ins} y={y+ins} width={s-ins*2} height={s-ins*2} rx={s*0.06} fill="white" fillOpacity="0.35" />
      </g>
    );
  }
  if (shape === "rectangle") {
    const w = s * 2;
    return (
      <g>
        <rect x={x} y={y} width={w} height={s} rx={s*0.14} fill={color} stroke={border} strokeWidth={bw} />
        <rect x={x+ins} y={y+ins} width={w-ins*2} height={s-ins*2} rx={s*0.06} fill="white" fillOpacity="0.35" />
      </g>
    );
  }
  if (shape === "equilateralTriangle") {
    const cx = x + s/2, cy = y + s/2, h = s * 0.866;
    const pts = flip === "down"
      ? `${cx},${cy+h/2} ${cx-s/2},${cy-h/2} ${cx+s/2},${cy-h/2}`
      : `${cx},${cy-h/2} ${cx+s/2},${cy+h/2} ${cx-s/2},${cy+h/2}`;
    const f = 0.55, icy = flip === "down" ? cy+h*0.08 : cy+h*0.08;
    const ipts = flip === "down"
      ? `${cx},${icy+h*f/2} ${cx-s*f/2},${icy-h*f/2} ${cx+s*f/2},${icy-h*f/2}`
      : `${cx},${icy-h*f/2} ${cx+s*f/2},${icy+h*f/2} ${cx-s*f/2},${icy+h*f/2}`;
    return (
      <g>
        <polygon points={pts} fill={color} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
        <polygon points={ipts} fill="white" fillOpacity="0.35" strokeLinejoin="round" />
      </g>
    );
  }
  // isosceles — tall narrow triangle in 1×1 cell
  const cx = x + s/2, h = s * 1.3, bh = s * 0.45;
  const pts = flip === "down"
    ? `${cx},${y+h} ${x},${y} ${x+s},${y}`
    : `${cx},${y} ${x+bh},${y+h} ${x+s-bh},${y+h}`;
  return (
    <g>
      <polygon points={pts} fill={color} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
    </g>
  );
}

/** Isometric tile — renders the top face + two visible side faces */
function IsoTile({
  shape, sx, sy, s, color
}: {
  shape: PreviewTile["shape"];
  sx: number; sy: number; s: number; color: string;
}) {
  const border = "#0a0c18";
  const bw = 0.7;
  // Isometric unit vectors at scale s:
  //   right  (+col): [s/2,  s/4]
  //   back   (+row): [-s/2, s/4]
  //   up     (+lay): [0,   -s*0.6]
  const rx = s/2,  ry = s/4;   // right vector
  const bx = -s/2, by = s/4;  // back vector
  const ux = 0,    uy = -s*0.6; // up vector

  const sideH = Math.abs(uy);  // height of the side faces in pixels

  // Top face (parallelogram: origin, +right, +right+back, +back)
  const TL = [sx,         sy        ];         // front-left  = origin
  const TR = [sx+rx,      sy+ry     ];         // front-right
  const BR = [sx+rx+bx,   sy+ry+by  ];         // back-right
  const BL = [sx+bx,      sy+by     ];         // back-left

  const topPts = `${TL[0]},${TL[1]} ${TR[0]},${TR[1]} ${BR[0]},${BR[1]} ${BL[0]},${BL[1]}`;

  // Right face (front-right → front-right-down, back-right-down, back-right)
  const rightFace = [
    TR, [TR[0]+ux, TR[1]+uy],
    [BR[0]+ux, BR[1]+uy], BR
  ];
  const rightPts = rightFace.map((p) => `${p[0]},${p[1]}`).join(" ");

  // Left face (front-left → front-left-down, front-right-down, front-right)
  const leftFace = [
    TL, [TL[0]+ux, TL[1]+uy],
    [TR[0]+ux, TR[1]+uy], TR
  ];
  const leftPts = leftFace.map((p) => `${p[0]},${p[1]}`).join(" ");

  const topColor = color;
  const rightColor = darken(color, 45);
  const leftColor = darken(color, 25);

  // Inner panel for top face (shrunk ~20%)
  const f = 0.65;
  const tcx = (TL[0]+TR[0]+BR[0]+BL[0]) / 4;
  const tcy = (TL[1]+TR[1]+BR[1]+BL[1]) / 4;
  const iPts = [TL, TR, BR, BL]
    .map((p) => `${tcx + (p[0]-tcx)*f},${tcy + (p[1]-tcy)*f}`)
    .join(" ");

  if (shape === "rectangle") {
    // Rectangle is 2 cols wide — same logic but rx doubled
    const rx2 = rx * 2, ry2 = ry * 2;
    const TL2 = [sx,       sy      ];
    const TR2 = [sx+rx2,   sy+ry2  ];
    const BR2 = [sx+rx2+bx, sy+ry2+by];
    const BL2 = [sx+bx,    sy+by   ];
    const top2 = `${TL2[0]},${TL2[1]} ${TR2[0]},${TR2[1]} ${BR2[0]},${BR2[1]} ${BL2[0]},${BL2[1]}`;
    const right2 = [TR2, [TR2[0]+ux, TR2[1]+uy], [BR2[0]+ux, BR2[1]+uy], BR2].map((p) => `${p[0]},${p[1]}`).join(" ");
    const left2 = [TL2, [TL2[0]+ux, TL2[1]+uy], [TR2[0]+ux, TR2[1]+uy], TR2].map((p) => `${p[0]},${p[1]}`).join(" ");
    const tcx2 = (TL2[0]+TR2[0]+BR2[0]+BL2[0])/4;
    const tcy2 = (TL2[1]+TR2[1]+BR2[1]+BL2[1])/4;
    const ipts2 = [TL2, TR2, BR2, BL2].map((p) => `${tcx2+(p[0]-tcx2)*f},${tcy2+(p[1]-tcy2)*f}`).join(" ");
    return (
      <g>
        <polygon points={right2} fill={rightColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
        <polygon points={left2} fill={leftColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
        <polygon points={top2} fill={topColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
        <polygon points={ipts2} fill="white" fillOpacity="0.22" />
      </g>
    );
  }

  if (shape === "equilateralTriangle") {
    // Triangle top face: isometric diamond clipped to triangle shape
    // Simplified: just draw a flat triangle on top
    const tipX = (TL[0] + TR[0]) / 2;
    const tipY = Math.min(TL[1], TR[1]) - s * 0.3;
    const triTop = `${TL[0]},${TL[1]} ${TR[0]},${TR[1]} ${tipX},${tipY}`;
    const triRight = [TR, [TR[0]+ux, TR[1]+uy], [tipX+ux, tipY+uy], [tipX, tipY]].map((p) => `${p[0]},${p[1]}`).join(" ");
    return (
      <g>
        <polygon points={triRight} fill={rightColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
        <polygon points={triTop} fill={topColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
        <polygon points={`${tipX},${tipY} ${tipX+ux*0.6},${tipY+uy*0.6} ${TL[0]},${TL[1]}`} fill="white" fillOpacity="0.15" />
      </g>
    );
  }

  if (shape === "isoscelesTriangle") {
    const tipX = (TL[0] + TR[0]) / 2;
    const tipY = TL[1] - s * 0.55;
    const triTop = `${TL[0]},${TL[1]} ${TR[0]},${TR[1]} ${tipX},${tipY}`;
    const triRight = [TR, [TR[0]+ux*0.6, TR[1]+uy*0.6], [tipX+ux*0.6, tipY+uy*0.6], [tipX, tipY]].map((p) => `${p[0]},${p[1]}`).join(" ");
    return (
      <g>
        <polygon points={triRight} fill={rightColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
        <polygon points={triTop} fill={topColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
      </g>
    );
  }

  // Square (default)
  return (
    <g>
      <polygon points={rightPts} fill={rightColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
      <polygon points={leftPts} fill={leftColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
      <polygon points={topPts} fill={topColor} stroke={border} strokeWidth={bw} strokeLinejoin="round" />
      <polygon points={iPts} fill="white" fillOpacity="0.22" />
    </g>
  );
}

function UsagePill({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-white/85 px-2 py-2 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wide text-ink/50">{label}</div>
      <div className="mt-0.5 font-display text-base font-semibold">
        {value}
        <span className="text-xs text-ink/40">/{total}</span>
      </div>
    </div>
  );
}
