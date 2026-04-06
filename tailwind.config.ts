import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        cream: "#fff7ea",
        mint: "#b9f2de",
        coral: "#ffb8a9",
        ink: "#222222",
        sky: "#daf4ff"
      },
      borderRadius: {
        brutal: "32px"
      },
      boxShadow: {
        card: "0 14px 0 0 rgba(34, 34, 34, 0.12)",
        soft: "0 20px 60px rgba(34, 34, 34, 0.12)"
      },
      fontFamily: {
        display: [
          "\"Avenir Next Rounded\"",
          "\"Nunito\"",
          "\"Trebuchet MS\"",
          "sans-serif"
        ],
        body: [
          "\"Avenir Next Rounded\"",
          "\"Nunito\"",
          "\"Trebuchet MS\"",
          "sans-serif"
        ]
      },
      backgroundImage: {
        paper:
          "radial-gradient(circle at 1px 1px, rgba(34, 34, 34, 0.06) 1px, transparent 0), linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.2))"
      },
      animation: {
        bounceTile: "bounceTile 1s ease-in-out infinite"
      },
      keyframes: {
        bounceTile: {
          "0%, 100%": { transform: "translateY(0) rotate(-6deg)" },
          "50%": { transform: "translateY(-10px) rotate(6deg)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
