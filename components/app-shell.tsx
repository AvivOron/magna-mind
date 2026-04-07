"use client";

import { startTransition, useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";

import confetti from "canvas-confetti";
import { AnimatePresence, LazyMotion, domAnimation, m as motion } from "framer-motion";
import {
  Camera,
  ChevronRight,
  Layers3,
  RotateCcw,
  SkipForward,
  Sparkles,
  Upload
} from "lucide-react";

import { MiniPreview } from "@/components/mini-preview";
import { Tile } from "@/components/tile";
import type { AnalyzeResponse, BuildingChallenge } from "@/lib/types";
import { useInventoryStore } from "@/store/useInventoryStore";

const demoImageSrc = "/magna-mind/tiles.jpeg";

type AppStep = "scan" | "build";

export function AppShell() {
  const {
    inventory,
    detectedColors,
    challenges,
    completedNames,
    addChallenges,
    removeChallenge,
    reset,
    setAnalysis
  } = useInventoryStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string>(demoImageSrc);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [step, setStep] = useState<AppStep>("scan");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const currentChallenge = challenges[0] ?? null;

  useEffect(() => {
    if (step !== "build" || challenges.length > 1 || isFetchingMore) return;
    if (inventory.squares === 0 && inventory.rectangles === 0) return;

    setIsFetchingMore(true);
    fetch("/magna-mind/api/more-challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventory, completedNames })
    })
      .then((response) => response.json())
      .then((data: { challenges?: BuildingChallenge[] }) => {
        if (data.challenges?.length) addChallenges(data.challenges);
      })
      .catch(() => {})
      .finally(() => setIsFetchingMore(false));
  }, [addChallenges, challenges.length, completedNames, inventory, isFetchingMore, step]);

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
    setErrorDetails(null);

    try {
      const response = await fetch("/magna-mind/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: screenshot })
      });
      const data = (await response.json()) as AnalyzeResponse & { error?: string; details?: string };

      if (!response.ok || data.error) {
        setErrorDetails(data.details ?? null);
        throw new Error(data.error || "Analysis failed.");
      }

      startTransition(() => {
        setAnalysis(data);
      });
      setStep("build");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed. Please try another photo.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleReset() {
    setCapturedImage(demoImageSrc);
    setErrorMessage(null);
    setErrorDetails(null);
    setStep("scan");
    reset();
  }

  function handleComplete(challenge: BuildingChallenge) {
    launchConfetti(detectedColors);
    setDirection(1);
    removeChallenge(challenge.name);
  }

  function handleSkip(challenge: BuildingChallenge) {
    setDirection(1);
    removeChallenge(challenge.name);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
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

  function handleOpenCamera() {
    pulseHaptics();
    setShowCamera(true);
  }

  return (
    <LazyMotion features={domAnimation}>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-20 pt-5 text-slate-900 sm:max-w-lg">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/35 border-t-white/50 bg-white/20 shadow-[0_12px_30px_rgba(14,165,233,0.12)] backdrop-blur-xl">
              <Sparkles className="h-4 w-4 text-sky-700" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700/70">Physical Blueprint</p>
              <span className="font-display text-base font-bold tracking-tight">Magna-Mind</span>
            </div>
          </div>
          {step !== "scan" && (
            <motion.button
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
              onClick={handleReset}
              className="rounded-[20px] border border-white/25 border-t-white/40 bg-white/20 px-4 py-2 text-xs font-semibold text-slate-700 backdrop-blur-xl"
            >
              <span className="flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                New Scan
              </span>
            </motion.button>
          )}
        </header>

        <AnimatePresence mode="wait">
          {step === "scan" ? (
            <ScanStep
              key="scan"
              capturedImage={capturedImage}
              isAnalyzing={isAnalyzing}
              errorMessage={errorMessage}
              errorDetails={errorDetails}
              fileInputRef={fileInputRef}
              onOpenCamera={handleOpenCamera}
              onAnalyze={handleAnalyze}
            />
          ) : (
            <BuildQueueStep
              key="build"
              currentChallenge={currentChallenge}
              totalRemaining={challenges.length}
              isFetchingMore={isFetchingMore}
              direction={direction}
              detectedColors={detectedColors}
              onComplete={handleComplete}
              onSkip={handleSkip}
            />
          )}
        </AnimatePresence>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <AnimatePresence>
          {showCamera && (
            <CameraModal
              onCapture={(dataUrl) => {
                setCapturedImage(dataUrl);
                setShowCamera(false);
                setErrorMessage(null);
              }}
              onClose={() => setShowCamera(false)}
            />
          )}
        </AnimatePresence>
      </main>
    </LazyMotion>
  );
}

function ScanStep({
  capturedImage,
  isAnalyzing,
  errorMessage,
  errorDetails,
  fileInputRef,
  onOpenCamera,
  onAnalyze
}: {
  capturedImage: string;
  isAnalyzing: boolean;
  errorMessage: string | null;
  errorDetails: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onOpenCamera: () => void;
  onAnalyze: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="flex flex-col gap-5"
    >
      <div className="px-1">
        <h1 className="font-display text-4xl font-bold leading-none tracking-tight text-slate-950">
          Turn the pile into a physical blueprint.
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
          Scan the magnetic tiles, then build from crisp schematics instead of noisy image cards.
        </p>
      </div>

      <Tile className="overflow-hidden">
        <div className="relative h-72 overflow-hidden bg-white/15">
          <img src={capturedImage} alt="Tile photo" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/35 to-transparent" />
          {isAnalyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/22 backdrop-blur-md">
              <motion.div
                animate={{ scale: [1, 1.08, 1], y: [0, -4, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/40 border-t-white/60 bg-white/20"
              >
                <Layers3 className="h-7 w-7 text-white" />
              </motion.div>
              <p className="font-display text-lg font-bold text-white">Generating build matrix...</p>
              <p className="text-xs tracking-[0.18em] text-white/70 uppercase">Counting shape by shape</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onOpenCamera}
            disabled={isAnalyzing}
            className="flex flex-1 items-center justify-center gap-2 rounded-[20px] border border-white/25 border-t-white/40 bg-white/16 px-4 py-3.5 text-sm font-semibold text-slate-800 backdrop-blur-xl disabled:opacity-40"
          >
            <motion.span
              animate={{ boxShadow: ["0 0 0 0 rgba(14,165,233,0.22)", "0 0 0 12px rgba(14,165,233,0)", "0 0 0 0 rgba(14,165,233,0)"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100"
            >
              <Camera className="h-4 w-4 text-sky-700" />
            </motion.span>
            Take Photo
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="flex flex-1 items-center justify-center gap-2 rounded-[20px] border border-white/25 border-t-white/40 bg-white/16 px-4 py-3.5 text-sm font-semibold text-slate-800 backdrop-blur-xl disabled:opacity-40"
          >
            <Upload className="h-4 w-4 text-slate-700" />
            Upload
          </motion.button>
        </div>

        {errorMessage && (
          <div className="px-3 pb-3">
            <div className="rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-900">
              <p className="font-semibold">{errorMessage}</p>
              {errorDetails && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-rose-800/70">Details</summary>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs text-rose-900/75">
                    {errorDetails}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}
      </Tile>

      <motion.button
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
        onClick={onAnalyze}
        disabled={isAnalyzing}
        className="rounded-[24px] border border-sky-500/40 border-t-white/40 bg-gradient-to-r from-sky-600 to-sky-400 px-5 py-4 font-display text-lg font-bold text-slate-950 shadow-[0_20px_60px_rgba(15,23,42,0.35)] disabled:opacity-50"
      >
        {isAnalyzing ? "Analyzing…" : "Build My Blueprint"}
      </motion.button>

      <p className="text-center text-xs uppercase tracking-[0.18em] text-slate-500">
        Demo photo loaded. Replace it with your own pile at any time.
      </p>
    </motion.div>
  );
}

function BuildQueueStep({
  currentChallenge,
  totalRemaining,
  isFetchingMore,
  direction,
  detectedColors,
  onComplete,
  onSkip
}: {
  currentChallenge: BuildingChallenge | null;
  totalRemaining: number;
  isFetchingMore: boolean;
  direction: 1 | -1;
  detectedColors: string[];
  onComplete: (challenge: BuildingChallenge) => void;
  onSkip: (challenge: BuildingChallenge) => void;
}) {
  if (!currentChallenge) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-4 py-16 text-center"
      >
        <Tile className="w-full max-w-sm px-8 py-10">
          {isFetchingMore ? (
            <div className="flex flex-col items-center gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/35 border-t-white/50 bg-white/20"
              >
                <Sparkles className="h-7 w-7 text-sky-700" />
              </motion.div>
              <p className="font-display text-2xl font-bold">Drafting more blueprints…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="text-5xl">🎉</div>
              <p className="font-display text-2xl font-bold">Blueprint queue complete</p>
              <p className="text-sm leading-6 text-slate-600">You cleared every build from this scan.</p>
            </div>
          )}
        </Tile>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="flex flex-col gap-4"
    >
      <Tile className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {totalRemaining} build{totalRemaining !== 1 ? "s" : ""} queued
            {isFetchingMore ? " · generating more" : ""}
          </p>
          <div className="flex gap-2">
            {Array.from({ length: Math.min(totalRemaining, 5) }).map((_, index) => (
              <div
                key={index}
                className={`h-2 w-9 rounded-full ${index === 0 ? "bg-sky-600" : "bg-sky-200/80"}`}
              />
            ))}
          </div>
        </div>
      </Tile>

      <AnimatePresence mode="wait">
        <ChallengeCard
          key={currentChallenge.name}
          challenge={currentChallenge}
          direction={direction}
          detectedColors={detectedColors}
          onComplete={onComplete}
          onSkip={onSkip}
        />
      </AnimatePresence>
    </motion.div>
  );
}

const difficultyMeta = {
  "easy-2d": { label: "Easy", accent: "text-emerald-700", pill: "bg-emerald-100/90" },
  "medium-3d": { label: "Medium", accent: "text-sky-700", pill: "bg-sky-100/90" },
  "hard-3d": { label: "Hard", accent: "text-rose-700", pill: "bg-rose-100/90" }
};

function ChallengeCard({
  challenge,
  direction,
  detectedColors,
  onComplete,
  onSkip
}: {
  challenge: BuildingChallenge;
  direction: 1 | -1;
  detectedColors: string[];
  onComplete: (challenge: BuildingChallenge) => void;
  onSkip: (challenge: BuildingChallenge) => void;
}) {
  const meta = difficultyMeta[challenge.difficulty];

  useEffect(() => {
    launchConfetti(detectedColors, 70);
  }, [challenge.name, detectedColors]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, x: direction * 56 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: direction * -56 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="flex flex-col gap-4"
    >
      <Tile className="overflow-hidden p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${meta.pill} ${meta.accent}`}>
              {meta.label}
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-slate-950">
              {challenge.emoji} {challenge.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{challenge.preview.caption}</p>
            <div className="mt-3 inline-flex rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-xs font-semibold text-slate-700">
              Vibe: {challenge.primaryColor}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <MiniPreview challenge={challenge} />
        </div>
      </Tile>

      <PiecesNeeded challenge={challenge} />

      <Tile className="p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Build sequence</p>
        <div className="flex flex-col gap-3">
          {challenge.steps.map((step, index) => (
            <div key={index} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-slate-700">{step.replace(/^\d+\.\s*/, "")}</p>
            </div>
          ))}
        </div>
      </Tile>

      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          onClick={() => onSkip(challenge)}
          className="flex items-center gap-2 rounded-[24px] border border-white/25 border-t-white/40 bg-white/35 px-5 py-4 font-display text-sm font-semibold text-slate-700 backdrop-blur-xl"
        >
          <SkipForward className="h-4 w-4" />
          Skip
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.985 }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          onClick={() => onComplete(challenge)}
          className="flex flex-1 items-center justify-center gap-2 rounded-[24px] bg-slate-950 px-5 py-4 font-display text-base font-bold text-white shadow-[0_18px_36px_rgba(15,23,42,0.24)]"
        >
          I Built It
          <ChevronRight className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}

const tilesMeta = [
  { label: "Squares", key: "squares" as const },
  { label: "Rects", key: "rectangles" as const },
  { label: "Eq △", key: "equilateralTriangles" as const },
  { label: "Iso △", key: "isoscelesTriangles" as const }
] as const;

function PiecesNeeded({ challenge }: { challenge: BuildingChallenge }) {
  const nonZero = tilesMeta.filter((tile) => challenge.piecesUsed[tile.key] > 0);
  if (nonZero.length === 0) return null;

  return (
    <Tile className="px-4 py-3">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Pieces needed</p>
      <div className="flex flex-wrap gap-2">
        {nonZero.map((tile) => (
          <div
            key={tile.key}
            className="rounded-[18px] border border-white/25 border-t-white/40 bg-white/30 px-3 py-2 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold text-slate-950">{challenge.piecesUsed[tile.key]}</span>
              <span className="text-xs font-semibold text-slate-600">{tile.label}</span>
            </div>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function CameraModal({
  onCapture,
  onClose
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setError("Camera not available. Use HTTPS or upload a photo instead.");
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
          });
        } catch (cameraError) {
          if (cameraError instanceof DOMException && cameraError.name === "OverconstrainedError") {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else {
            throw cameraError;
          }
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (cameraError) {
        if (cancelled) return;

        if (cameraError instanceof DOMException) {
          if (cameraError.name === "NotAllowedError" || cameraError.name === "PermissionDeniedError") {
            setError("Camera access denied. Allow permissions and try again.");
          } else if (cameraError.name === "NotFoundError" || cameraError.name === "DevicesNotFoundError") {
            setError("No camera found on this device.");
          } else if (cameraError.name === "NotReadableError" || cameraError.name === "TrackStartError") {
            setError("Camera is already in use by another app.");
          } else {
            setError(`Camera error: ${cameraError.message}`);
          }
        } else {
          setError("Could not start camera. Try uploading a photo instead.");
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function handleCapture() {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/20 border-t-white/40 bg-slate-950/80 backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative aspect-video overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-white/70">Starting camera…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-center text-sm leading-6 text-white/80">{error}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-[20px] border border-white/20 border-t-white/35 bg-white/10 py-3 font-display text-sm font-semibold text-white"
          >
            Cancel
          </button>
          <motion.button
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            onClick={handleCapture}
            disabled={!ready}
            className="flex-[2] rounded-[20px] bg-sky-400 py-3 font-display text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            Capture
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function launchConfetti(colors: string[], particleCount = 140) {
  const options: Parameters<typeof confetti>[0] & { colors?: string[] } = {
    particleCount,
    spread: 78,
    startVelocity: 42,
    origin: { y: 0.68 },
    colors: colors.length ? colors : ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444"]
  };

  confetti(options);
}

function pulseHaptics() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.([18, 24, 18]);
  }
}

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load the demo picture.");
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Read failed."));
    };
    reader.onerror = () => reject(new Error("Could not read the demo picture."));
    reader.readAsDataURL(blob);
  });
}
