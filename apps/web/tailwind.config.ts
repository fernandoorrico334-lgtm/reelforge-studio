import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        ember: "#f97316",
        sand: "#f5efe6",
        slate: "#475569"
      },
      boxShadow: {
        panel: "0 28px 80px rgba(15, 23, 42, 0.12)"
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(circle at top, rgba(249, 115, 22, 0.25), transparent 38%), linear-gradient(135deg, #fff7ed 0%, #f8fafc 48%, #ecfeff 100%)"
      }
    }
  },
  plugins: []
};

export default config;