import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./providers/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211b",
        linen: "#f7f3ea",
        graphite: "#2d3430",
        carloha: {
          red: "#b51f2b",
          gold: "#c6923a",
          leaf: "#1c6b55",
          sky: "#dbeafe"
        }
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 33, 27, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
