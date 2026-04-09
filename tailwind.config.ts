import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — swap hex values to match your design
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
        sidebar: {
          bg:     "#0f172a", // dark navy
          text:   "#94a3b8",
          active: "#3b82f6",
          hover:  "#1e293b",
        },
      },
      backgroundColor: {
        dark: {
          base: "#0f172a",
          surface: "#1e293b",
          hover: "#334155",
        },
      },
      textColor: {
        dark: {
          primary: "#f1f5f9",
          secondary: "#cbd5e1",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
