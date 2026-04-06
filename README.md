# Magna-Mind

An AI-powered web app for kids that scans magnetic tile collections (Magna-Tiles, Playmager, etc.) and generates personalized building challenges.

## How it works

1. **Scan** — take or upload a photo of your pile of magnetic tiles
2. **Pick** — AI counts the tiles and suggests 3 building challenges tailored to exactly what you have
3. **Build** — follow the step-by-step instructions and earn a badge when you're done

## Tech stack

- **Next.js 15** + **React 19** (App Router)
- **Google Gemini 2.5 Flash** — vision model for tile counting and challenge generation
- **Zustand** — lightweight state management
- **Framer Motion** — animations
- **Tailwind CSS** — styling with a custom "soft brutal" design system
- **TypeScript** throughout

## Getting started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/) API key with Gemini access

### Setup

```bash
git clone https://github.com/your-username/magna-mind.git
cd magna-mind
npm install
```

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_key_here
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  api/analyze/route.ts   # Gemini API integration — tile counting + challenge generation
  layout.tsx
  page.tsx
components/
  app-shell.tsx          # Entire UI — step flow, SVG preview renderer
lib/
  types.ts               # Shared TypeScript types
store/
  useInventoryStore.ts   # Zustand store for inventory + challenges
public/
  tiles.jpeg             # Demo image
```

## Tile types supported

| Shape | Description |
|---|---|
| Square | Standard square tile |
| Rectangle | 2:1 oblong tile |
| Equilateral Triangle | All sides equal |
| Isosceles Triangle | Tall narrow triangle |

## Preview rendering

The challenge preview uses a deterministic grid-based renderer — the AI outputs integer `col`/`row`/`layer` coordinates, and the frontend projects them into either a flat 2D layout (easy challenges) or an isometric 3D view (medium/hard challenges). No free-form coordinates from the AI.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
