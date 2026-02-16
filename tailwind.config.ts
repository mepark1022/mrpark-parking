import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1428A0", light: "#1E3CB5", dark: "#0F1F7A" },
        gold: { DEFAULT: "#F5B731", light: "#F7C85A", dark: "#D99E1B" },
        success: "#43A047",
        error: "#E53935",
        dark: "#222222",
        "mr-gray": "#666666",
        "light-gray": "#E8E8E8",
        "mr-blue": "#156082",
        "sky-blue": "#0F9ED5",
        "mr-orange": "#E97132",
        "mr-purple": "#7B1FA2",
        "page-bg": "#F7F8FC",
      },
      fontFamily: {
        sans: [
          "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui",
          "Roboto", "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo",
          "Noto Sans KR", "Malgun Gothic", "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;