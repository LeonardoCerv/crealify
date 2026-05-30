import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette — near-white surfaces, deep ink type, bright blue accent.
        ink: {
          DEFAULT: "#1f2937",
          50: "#f5f6f8",
          100: "#e6e8ec",
          200: "#c8ccd3",
          300: "#a3a8b2",
          400: "#6c7280",
          500: "#3c424c",
          600: "#1f2937",
          700: "#161d27",
          900: "#0d1116",
        },
        paper: {
          DEFAULT: "#fafbfc",
          50: "#ffffff",
          100: "#f6f7f9",
          200: "#eceff3",
        },
        // Bright medium blue — primary highlight / focus / link.
        accent: {
          DEFAULT: "#2f7bff",
          50: "#eff5ff",
          100: "#dceaff",
          300: "#7fa9ff",
          400: "#4a8cff",
          500: "#2f7bff",
          600: "#1e63e0",
          700: "#1450b8",
        },
        // Back-compat alias so anything still referencing `sparkle` keeps working.
        sparkle: "#2f7bff",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
