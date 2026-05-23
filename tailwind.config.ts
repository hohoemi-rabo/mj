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
        // セマンティック色（高コントラスト固定hex／白文字でWCAG AA ≥4.5:1）。
        // ダークモード自動切替は背景/文字のみで、操作色は予測可能に固定する。
        primary: {
          DEFAULT: "#1d6f42", // 主要アクション・「はい」（緑）
          dark: "#175a36", // hover
        },
        danger: {
          DEFAULT: "#b3261e", // 取消・警告（赤）
          dark: "#8f1e18", // hover
        },
      },
      fontFamily: {
        sans: ["var(--font-jp-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // シニア向けに大きめ・行高広め
        sm: ["1rem", { lineHeight: "1.7" }], // 用語の補足など（基準18pxなので約18px）
        base: ["1.125rem", { lineHeight: "1.8" }],
        lg: ["1.375rem", { lineHeight: "1.7" }],
        xl: ["1.75rem", { lineHeight: "1.5" }],
        "2xl": ["2.25rem", { lineHeight: "1.3" }], // タイトル・大見出し
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
