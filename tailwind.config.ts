import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Rathinam Brand Palette ──────────────────────────────────────────
      // Mild, calming palette: LIGHT GREEN is the primary brand colour,
      // LIGHT BLUE is the secondary accent. The two are never blended into
      // each other — green leads, blue supports.
      colors: {
        // Official Rathinam LIME GREEN (primary), applied in light tints.
        brand: {
          DEFAULT: "#4E9A2F",   // readable green for text/icons + solid buttons
          dark:    "#3E7D25",
          light:   "#9AD24D",
          50:      "#F5FBEA",
          100:     "#E8F6CE",
          200:     "#D2ECA3",
          300:     "#B7E077",
          400:     "#9AD24D",
          500:     "#82C232",
          600:     "#6AA528",
          700:     "#4E7C1E",
          800:     "#3B5D18",
          900:     "#273E10",
        },
        // Official Rathinam SKY BLUE (accent), light tints.
        accent: {
          DEFAULT: "#27AAE1",
          dark:    "#1E86B4",
          light:   "#63C6EC",
          50:      "#E8F7FD",
          100:     "#C6ECF9",
          200:     "#97DBF3",
          300:     "#63C6EC",
          400:     "#3DB4E6",
          500:     "#27AAE1",
          600:     "#1E86B4",
          700:     "#18688C",
          800:     "#124D67",
          900:     "#0C3344",
        },
        // Semantic surface / text tokens
        surface: {
          DEFAULT: "#FFFFFF",
          muted:   "#F9FAFB",
          subtle:  "#F3F4F6",
          border:  "#E5E7EB",
        },
        ink: {
          DEFAULT: "#111827",
          muted:   "#6B7280",
          faint:   "#9CA3AF",
        },
        success: {
          DEFAULT: "#16A34A",
          light:   "#DCFCE7",
        },
        warning: {
          DEFAULT: "#D97706",
          light:   "#FEF3C7",
        },
        error: {
          DEFAULT: "#DC2626",
          light:   "#FEE2E2",
        },
      },

      // ── Typography ─────────────────────────────────────────────────────
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },

      // ── Spacing / sizing ───────────────────────────────────────────────
      minHeight: {
        touch: "44px",  // minimum touch target
      },
      minWidth: {
        touch: "44px",
      },

      // ── Border radius ──────────────────────────────────────────────────
      borderRadius: {
        "4xl": "2rem",
      },

      // ── Box shadow ─────────────────────────────────────────────────────
      boxShadow: {
        "card":    "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-md": "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        "card-lg": "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)",
        "brand":   "0 4px 14px 0 rgba(78, 154, 47, 0.20)",
        "accent":  "0 4px 14px 0 rgba(46, 155, 214, 0.22)",
      },

      // ── Animation / keyframes ──────────────────────────────────────────
      transitionTimingFunction: {
        // House-style easing — snappy, premium feel
        "brand":       "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        "brand-in":    "cubic-bezier(0.55, 0.06, 0.68, 0.19)",
        "brand-out":   "cubic-bezier(0.22, 0.61, 0.36, 1.00)",
        "brand-inout": "cubic-bezier(0.65, 0.05, 0.35, 0.95)",
        "spring":      "cubic-bezier(0.34, 1.56, 0.64, 1.00)",
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%":      { transform: "translateX(-4px)" },
          "75%":      { transform: "translateX(4px)" },
        },
        "pulse-brand": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(78, 154, 47, 0.4)" },
          "50%":      { boxShadow: "0 0 0 8px rgba(78, 154, 47, 0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%":      { transform: "translate(3%, -4%) scale(1.05)" },
          "66%":      { transform: "translate(-3%, 3%) scale(0.97)" },
        },
        "aurora-drift": {
          "0%, 100%": { transform: "translate(-8%, 0) rotate(0deg)" },
          "50%":      { transform: "translate(8%, -6%) rotate(8deg)" },
        },
        "checkmark": {
          from: { strokeDashoffset: "30" },
          to:   { strokeDashoffset: "0" },
        },
        "progress-fill": {
          from: { width: "0%" },
          to:   { width: "var(--progress-width)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "ink-dry": {
          "0%":   { filter: "blur(2px)", opacity: "0.7" },
          "100%": { filter: "blur(0)",   opacity: "1" },
        },
        "celebration": {
          "0%":   { transform: "scale(0.8)", opacity: "0" },
          "60%":  { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)",   opacity: "1" },
        },
      },
      animation: {
        "fade-in":      "fade-in 250ms ease-brand-out both",
        "slide-up":     "slide-up 300ms ease-brand-out both",
        "slide-down":   "slide-down 300ms ease-brand-out both",
        "shake":        "shake 350ms ease-brand-inout",
        "pulse-brand":  "pulse-brand 2s ease-brand infinite",
        "checkmark":    "checkmark 400ms ease-spring forwards",
        "ink-dry":      "ink-dry 600ms ease-brand forwards",
        "celebration":  "celebration 500ms ease-spring forwards",
        "count-up":     "count-up 400ms ease-brand-out both",
        "float-slow":   "float-slow 18s ease-in-out infinite",
        "aurora-drift": "aurora-drift 24s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
