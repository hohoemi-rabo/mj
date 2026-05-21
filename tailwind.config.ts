import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-jp-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // シニア向けに大きめ・行高広め
        base: ["1.125rem", { lineHeight: "1.8" }],
        lg: ["1.375rem", { lineHeight: "1.7" }],
        xl: ["1.75rem", { lineHeight: "1.5" }],
      },
      // タップ領域 60×60px（REQUIREMENTS §3.7）。min-h-tap / min-w-tap で使う
      spacing: {
        tap: "60px",
      },
      minHeight: {
        tap: "60px",
      },
      minWidth: {
        tap: "60px",
      },
    },
  },
  plugins: [],
} satisfies Config;
