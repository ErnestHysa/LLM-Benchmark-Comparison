import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        background: "hsl(var(--background))",
        surface: "hsl(var(--surface))",
        "surface-hover": "hsl(var(--surface-hover))",
        // Border colors
        border: "hsl(var(--border))",
        "border-hover": "hsl(var(--border-hover))",
        input: "hsl(var(--border))",
        // Foreground/text colors
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        // Primary accent
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          fg: "hsl(var(--primary-fg))",
        },
        // Semantic colors
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",
        info: "hsl(var(--info))",
        // Chart colors
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        // Shadcn/ui compatibility
        card: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--surface-hover))",
          foreground: "hsl(var(--foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-fg))",
        },
        destructive: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--background))",
        },
        ring: "hsl(var(--primary))",
      },
      fontFamily: {
        sans: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        // Fluid typography scale
        xs: ["clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)", { lineHeight: "1.5" }],
        sm: ["clamp(0.875rem, 0.8rem + 0.375vw, 1rem)", { lineHeight: "1.5" }],
        base: ["clamp(1rem, 0.925rem + 0.375vw, 1.125rem)", { lineHeight: "1.5" }],
        lg: ["clamp(1.125rem, 1rem + 0.625vw, 1.25rem)", { lineHeight: "1.5" }],
        xl: ["clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)", { lineHeight: "1.25" }],
        "2xl": ["clamp(1.5rem, 1.3rem + 1vw, 1.875rem)", { lineHeight: "1.25" }],
        "3xl": ["clamp(2rem, 1.7rem + 1.5vw, 2.5rem)", { lineHeight: "1.25" }],
        "4xl": ["clamp(2.5rem, 2rem + 2.5vw, 3.5rem)", { lineHeight: "1.1" }],
        "5xl": ["clamp(3rem, 2.2rem + 4vw, 4.5rem)", { lineHeight: "1" }],
      },
      spacing: {
        // 4px base grid system
        0: "0",
        1: "0.25rem", // 4px
        2: "0.5rem", // 8px
        3: "0.75rem", // 12px
        4: "1rem", // 16px
        5: "1.25rem", // 20px
        6: "1.5rem", // 24px
        8: "2rem", // 32px
        10: "2.5rem", // 40px
        12: "3rem", // 48px
        16: "4rem", // 64px
        20: "5rem", // 80px
        24: "6rem", // 96px
        32: "8rem", // 128px
      },
      borderRadius: {
        sm: "0.375rem", // 6px
        DEFAULT: "0.5rem", // 8px
        md: "0.75rem", // 12px
        lg: "1rem", // 16px
        xl: "1.25rem", // 20px
        "2xl": "1.5rem", // 24px
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
      },
      animationDuration: {
        instant: "50ms",
        fast: "100ms",
        normal: "200ms",
        slow: "300ms",
        slower: "500ms",
      },
      keyframes: {
        // Framer motion will handle most animations via spring physics
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
