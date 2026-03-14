import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        hero: ["clamp(3rem, 6vw, 5.75rem)", { lineHeight: "0.95", fontWeight: "600" }],
      },
      boxShadow: {
        panel: "0 16px 48px rgba(0, 0, 0, 0.38)",
      },
      backgroundImage: {
        spotlight:
          "radial-gradient(56rem 24rem at 12% -8%, rgba(45, 90, 240, 0.22), transparent 65%), radial-gradient(44rem 22rem at 88% -12%, rgba(0, 205, 205, 0.16), transparent 70%), linear-gradient(180deg, rgba(7, 10, 19, 0.9) 0%, rgba(5, 7, 13, 1) 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
