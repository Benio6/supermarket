import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#14532D",
          light: "#1E6B3C",
          dark: "#0E3A1F",
          soft: "#DCE9DF",
        },
        sand: "#E8E3D8",
        prio1: "#DC2626",
        prio2: "#EAB308",
        prio3: "#16A34A",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,83,45,0.06), 0 4px 14px rgba(20,83,45,0.06)",
        sheet: "0 -8px 30px rgba(0,0,0,0.18)",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        growIn: {
          "0%": { opacity: "0", maxHeight: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", maxHeight: "80px", transform: "translateY(0)" },
        },
      },
      animation: {
        slideUp: "slideUp 220ms cubic-bezier(0.22,1,0.36,1)",
        fadeIn: "fadeIn 180ms ease-out",
        growIn: "growIn 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
